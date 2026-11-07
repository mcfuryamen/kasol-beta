$ErrorActionPreference = 'Stop'
$root = if ($args.Count -ge 1) { $args[0] } else { 'C:\Users\Admin\Documents\kasol\mitra' }
$dictPath = Join-Path $root 'src\i18n\dictionary.ts'
Write-Output ('=== ROOT: ' + $root + ' ===')

# ---------- 1. SCAN KARAKTER ASING (CJK / Cyrillic / Hangul / Vietnam) ----------
Write-Output '=== SCAN KARAKTER ASING ==='
$files = Get-ChildItem -Path $root -Recurse -File -Include *.astro,*.ts,*.js,*.mjs,*.json,*.md,*.css |
  Where-Object { $_.FullName -notmatch 'node_modules|\.astro\\|\\dist\\' }
$bad = 0
foreach ($f in $files) {
  $lines = [System.IO.File]::ReadAllLines($f.FullName)
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $l = $lines[$i]
    foreach ($ch in $l.ToCharArray()) {
      $c = [int][char]$ch
      $hit = $false
      if ($c -ge 0x0400 -and $c -le 0x04FF) { $hit = $true }          # Cyrillic
      elseif ($c -ge 0x0590 -and $c -le 0x05FF) { $hit = $true }      # Hebrew
      elseif ($c -ge 0x1EA0 -and $c -le 0x1EF9) { $hit = $true }      # Vietnam
      elseif ($c -ge 0x3000 -and $c -le 0x30FF) { $hit = $true }      # CJK simbol + Kana
      elseif ($c -ge 0x3400 -and $c -le 0x4DBF) { $hit = $true }      # CJK ext A
      elseif ($c -ge 0x4E00 -and $c -le 0x9FFF) { $hit = $true }      # CJK unified
      elseif ($c -ge 0xAC00 -and $c -le 0xD7AF) { $hit = $true }      # Hangul
      elseif ($c -ge 0xF900 -and $c -le 0xFAFF) { $hit = $true }      # CJK compat
      elseif ($c -eq 0xFF0C) { $hit = $true }                        # fullwidth comma
      if ($hit) {
        $bad++
        Write-Output ('  {0}:{1}  U+{2:X4}  [{3}]' -f $f.FullName.Replace($root, 'mitra'), ($i + 1), $c, $ch)
        break
      }
    }
  }
}
Write-Output ('  total file discan: {0} | karakter asing: {1}' -f $files.Count, $bad)

# ---------- 2. CEK i18n: missing + orphan ----------
Write-Output ''
Write-Output '=== CEK i18n ==='
$dictTxt = [System.IO.File]::ReadAllText($dictPath)
$dictKeys = [regex]::Matches($dictTxt, "(?m)^\s*'([A-Za-z0-9_.]+)'\s*:") | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

$bt = [string][char]96
$used = New-Object System.Collections.Generic.List[string]

# 2a. atribut di file .astro
$astroFiles = Get-ChildItem -Path (Join-Path $root 'src') -Recurse -File -Include *.astro
foreach ($f in $astroFiles) {
  $t = [System.IO.File]::ReadAllText($f.FullName)
  foreach ($m in [regex]::Matches($t, 'data-i18n(?:-aria|-ph)?="([A-Za-z0-9_.]+)"')) { $used.Add($m.Groups[1].Value) }
  # data-i18n={`mitra.adv${i + 1}T`}  -> pattern dengan wildcard
  foreach ($m in [regex]::Matches($t, 'data-i18n=\{' + $bt + '([^' + $bt + ']+)' + $bt + '\}')) {
    $used.Add(($m.Groups[1].Value -replace '\$\{[^}]+\}', '*'))
  }
  # data-i18n="${key}" -> pattern dengan wildcard
  foreach ($m in [regex]::Matches($t, 'data-i18n="' + $bt + '([^' + $bt + ']+)' + $bt + '"')) {
    $used.Add(($m.Groups[1].Value -replace '\$\{[^}]+\}', '*'))
  }
  # data-i18n={expr} -> key literal di dalam ekspresi, mis.
  #   data-i18n={key === 'PHYSICAL' ? 'por.terpasang' : 'por.dikerjakan'}
  # Hanya string ber-namespace (ada titiknya) yang dianggap key — supaya nilai
  # pembanding seperti 'PHYSICAL' nggak ikut terhitung.
  foreach ($m in [regex]::Matches($t, 'data-i18n(?:-aria|-ph)?=\{[^}]*\}')) {
    foreach ($k in [regex]::Matches($m.Value, "'([A-Za-z0-9_]+\.[A-Za-z0-9_.]+)'")) { $used.Add($k.Groups[1].Value) }
  }
}

# 2b. key yang muncul sebagai string literal di kode (.ts/.astro), DIKECUALIKAN dictionary.ts
$codeFiles = Get-ChildItem -Path (Join-Path $root 'src') -Recurse -File -Include *.ts,*.astro |
  Where-Object { $_.FullName -ne $dictPath }
foreach ($f in $codeFiles) {
  $t = [System.IO.File]::ReadAllText($f.FullName)
  foreach ($m in [regex]::Matches($t, "['`"]((?:m|mitra|nav|tab)\.[A-Za-z0-9_.]+)['`"]")) {
    $used.Add(($m.Groups[1].Value -replace '\$\{[^}]+\}', '*'))
  }
}

$allUsed = $used | Sort-Object -Unique
$patterns = @($allUsed | Where-Object { $_.Contains('*') })
$concrete = @($allUsed | Where-Object { -not $_.Contains('*') })

# pola wildcard -> regex
$patternRx = @()
foreach ($p in $patterns) {
  $esc = [regex]::Escape($p) -replace '\\\*', '.*'
  $patternRx += ,([regex]::new('^' + $esc + '$'))
}

function Test-Match([string]$key, $concreteList, $rxList) {
  foreach ($c in $concreteList) { if ($c -eq $key) { return $true } }
  foreach ($r in $rxList) { if ($r.IsMatch($key)) { return $true } }
  return $false
}

$missing = @()
foreach ($k in $concrete) { if ($dictKeys -notcontains $k) { $missing += $k } }

$orphan = @()
foreach ($k in $dictKeys) { if (-not (Test-Match $k $concrete $patternRx)) { $orphan += $k } }

Write-Output ('  key di kamus      : {0}' -f $dictKeys.Count)
Write-Output ('  key terpakai     : {0} konkret + {1} pola' -f $concrete.Count, $patterns.Count)
Write-Output ('  MISSING (dipakai, nggak ada di kamus): {0}' -f $missing.Count)
$missing | ForEach-Object { Write-Output ('     - ' + $_) }
Write-Output ('  ORPHAN  (ada di kamus, nggak dipakai)  : {0}' -f $orphan.Count)
$orphan | ForEach-Object { Write-Output ('     - ' + $_) }
