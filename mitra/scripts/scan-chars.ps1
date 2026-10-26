param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string[]]$Paths
)
$ErrorActionPreference = 'Stop'

# Scan karakter asing (CJK / Cyrillic / Hangul / Vietnam / fullwidth) pada file teks apa pun.
# Pemakaian: powershell -File scan-chars.ps1 <path1> <path2> ...

$files = @()
foreach ($p in $Paths) {
  if (Test-Path $p -PathType Container) {
    $files += Get-ChildItem -Path $p -Recurse -File |
      Where-Object { $_.Extension -in '.astro', '.ts', '.js', '.mjs', '.json', '.md', '.css', '.sql', '.txt', '.yml', '.yaml' -and $_.FullName -notmatch 'node_modules|\.astro\\|\\dist\\|\\\.vercel\\' }
  } elseif (Test-Path $p -PathType Leaf) {
    $files += Get-Item $p
  }
}

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
      elseif ($c -eq 0xFF0C -or $c -eq 0xFF1A -or $c -eq 0xFF1B) { $hit = $true }  # fullwidth , : ;
      if ($hit) {
        $bad++
        Write-Output ('  {0}:{1}  U+{2:X4}  [{3}]' -f $f.FullName, ($i + 1), $c, $ch)
        break
      }
    }
  }
}
Write-Output ('file discan: {0} | karakter asing: {1}' -f $files.Count, $bad)
