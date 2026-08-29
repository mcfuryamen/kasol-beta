# push-beta.ps1
# ============================================================
# Alur rilis kasol-beta (BETA):
#   folder kerja (preview) -> kasol-beta preview
#                            -> squash ke 1 commit bersih (main)
#                            -> push GitHub kasol-beta (main)
# Semua push GitHub selalu ke branch MAIN.
# ============================================================
param(
  [string]$WorkDir = "C:\Users\Admin\Documents\kasol",
  [string]$BetaDir = "C:\Users\Admin\Documents\GitHub\kasol-beta"
)

$ErrorActionPreference = "Continue"

# Pola secret (prefix token) yang memicu GitHub push protection.
# Nilai secret asli tidak disimpan di repo — hanya prefix yang dideteksi.
$secretPatterns = @(
  "vca_", "ghp_", "github_pat_", "sbp_", "sk_live_", "sk_sb_"
)

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Akumulasi hit secret (bukan placeholder)
$script:secretHits = @()

function Invoke-Git([string]$dir, [string[]]$gitArgs) {
  $out = & git -C $dir @gitArgs 2>&1 | ForEach-Object { $_ -replace "^git : ", "" }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] git $($gitArgs -join ' ') di $dir" -ForegroundColor Red
    $out | ForEach-Object { Write-Host "  $_" }
    exit 1
  }
  return $out
}

function Test-TreeSecret([string]$dir, [switch]$Cached) {
  $found = @()
  foreach ($p in $secretPatterns) {
    if ($Cached) {
      $m = & git -C $dir grep --cached -n $p 2>$null
    } else {
      $m = & git -C $dir grep -n $p 2>$null
    }
    if ($LASTEXITCODE -eq 0) {
      # Abaikan placeholder contoh (mis. sbp_xxx...) — hanya nilai asli yang memblokir
      $m | ForEach-Object {
        if ($_ -notmatch "$p(?:xxx|x{3,}|\.\.\.|placeholder)") {
          $script:secretHits += $_
        }
      }
    }
  }
  return ($script:secretHits.Count -gt 0)
}

# Drift detector: pastikan snapshot beta main identik dengan work HEAD.
# Mode orphan-squash bisa men-drop file kalau push dilakukan dari revisi
# yang tidak sinkron dengan work tree (lihat insiden 2026-08-29: 13 file
# kaki5/ hilang di kq5beta.vercel.app karena snapshot 761b7cc dibuat
# sebelum file di-add di work tree). Mengembalikan $true jika ada drift.
function Test-TreeDrift([string]$SourceDir, [string]$TargetDir) {
  $src = & git -C $SourceDir ls-tree -r --name-only HEAD 2>$null | Sort-Object
  $tgt = & git -C $TargetDir ls-tree -r --name-only main 2>$null | Sort-Object
  if (-not $tgt) {
    Write-Host ('     [DRIFT] Target {0} belum punya branch main — lewati cek.' -f $TargetDir) -ForegroundColor Yellow
    return $false
  }
  $onlySrc = @($src | Where-Object { $_ -notin $tgt })
  $onlyTgt = @($tgt | Where-Object { $_ -notin $src })
  if ($onlySrc.Count -eq 0 -and $onlyTgt.Count -eq 0) {
    $srcLen = $src.Count
    Write-Host ('     Drift check OK: {0} file identik.' -f $srcLen) -ForegroundColor Green
    return $false
  }
  Write-Host ('[DRIFT] Snapshot tidak identik antara {0} dan {1}' -f $SourceDir, $TargetDir) -ForegroundColor Yellow
  if ($onlySrc.Count -gt 0) {
    $onlySrcLen = $onlySrc.Count
    Write-Host ('  Ada di source tapi TIDAK di target ({0} file, max 50):' -f $onlySrcLen) -ForegroundColor Yellow
    $onlySrc | Select-Object -First 50 | ForEach-Object { Write-Host ('    + {0}' -f $_) }
  }
  if ($onlyTgt.Count -gt 0) {
    $onlyTgtLen = $onlyTgt.Count
    Write-Host ('  Ada di target tapi TIDAK di source ({0} file, max 50):' -f $onlyTgtLen) -ForegroundColor Yellow
    $onlyTgt | Select-Object -First 50 | ForEach-Object { Write-Host ('    - {0}' -f $_) }
  }
  return $true
}

# ------------------------------------------------------------
Write-Host "==> [1/6] Push folder kerja (preview) -> kasol-beta" -ForegroundColor Cyan
Invoke-Git $WorkDir @("push", "beta", "preview")

Write-Host "==> [2/6] Sync kasol-beta preview ke HEAD folder kerja" -ForegroundColor Cyan
Invoke-Git $BetaDir @("fetch", "work")
Invoke-Git $BetaDir @("switch", "preview")
Invoke-Git $BetaDir @("reset", "--hard", "work/preview")

# Capture SHA main lama (rilis terakhir) SEBELUM dihapus di langkah [3/6] —
# dipakai version-bump check di bawah.
$prevMainSha = & git -C $BetaDir rev-parse main 2>$null

# Verifikasi secret di working tree preview
if (Test-TreeSecret $BetaDir) {
  Write-Host "[FAIL] Working tree kasol-beta mengandung pola secret:" -ForegroundColor Red
  $script:secretHits | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}

Write-Host "==> [3/6] Buat snapshot squash bersih di branch main" -ForegroundColor Cyan
& git -C $BetaDir branch -D main 2>$null
Invoke-Git $BetaDir @("switch", "--orphan", "main")
# Orphan checkout mengosongkan working tree — restore semua file dari pohon preview
Invoke-Git $BetaDir @("checkout", "preview", "--", ".")
# Index orphan sekarang terisi file dari preview — staging semua
Invoke-Git $BetaDir @("add", "-A")

# Drift guard: snapshot beta main harus identik dengan work HEAD
if (Test-TreeDrift -SourceDir $WorkDir -TargetDir $BetaDir) {
  Write-Host "[FAIL] Snapshot beta main kehilangan/menambah file dibanding work HEAD." -ForegroundColor Red
  Write-Host "       Biasanya ini karena push-beta.ps1 tidak dijalankan setelah file baru di-add." -ForegroundColor Red
  Write-Host "       Lihat DEPLOYMENT.md alur 'work -> beta'." -ForegroundColor Red
  exit 1
}

# Version-bump reminder: rilis kaki5 yang mengubah kode tapi lupa bump
# kaki5/js/version.json membuat overlay update mati & cache SW tak invalid
# (insiden v100, 2026-08-29). Non-blocking — hanya peringatan.
if ($prevMainSha) {
  $kaki5Changes = @(git -C $BetaDir diff --name-only $prevMainSha --cached -- kaki5/ 2>$null)
  $verChanges = @(git -C $BetaDir diff --name-only $prevMainSha --cached -- kaki5/js/version.json 2>$null)
  if ($kaki5Changes.Count -gt 0 -and $verChanges.Count -eq 0) {
    $changedCount = $kaki5Changes.Count
    Write-Host ("[WARN] kaki5/ berubah ({0} file) tapi kaki5/js/version.json TIDAK di-bump." -f $changedCount) -ForegroundColor Yellow
    Write-Host "       Overlay update tidak akan muncul untuk user & cache SW lama tetap valid." -ForegroundColor Yellow
    Write-Host "       Bump 4 tempat sekaligus: version.js CACHE_BUST, version.json cacheBust," -ForegroundColor Yellow
    Write-Host "       sw.js CACHE_NAME, index.html ?v= (lihat komentar KONVENSI RILIS di version.js)." -ForegroundColor Yellow
  }
}

# Verifikasi ulang index (cached)
if (Test-TreeSecret $BetaDir -Cached) {
  Write-Host "[FAIL] Snapshot main mengandung pola secret:" -ForegroundColor Red
  $script:secretHits | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}

$fileCount = (git -C $BetaDir diff --cached --name-only | Measure-Object -Line).Lines
Write-Host "     Snapshot berisi $fileCount file."

Invoke-Git $BetaDir @("commit", "-m", "chore: rilis beta $stamp (snapshot bersih, squash dari preview)", "--trailer", "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>")

Write-Host "==> [4/6] Push ke GitHub kasol-beta (main)" -ForegroundColor Cyan
$ans = Read-Host "     Squash snapshot siap. Push --force-with-lease ke GitHub main? (y/N)"
if ($ans -ne "y") {
  Write-Host "     Batal. Snapshot main lokal tetap tersimpan di kasol-beta." -ForegroundColor Yellow
  exit 0
}
Invoke-Git $BetaDir @("push", "origin", "main", "--force-with-lease")

Write-Host "==> [5/6] Kembalikan working branch kasol-beta ke preview" -ForegroundColor Cyan
Invoke-Git $BetaDir @("switch", "preview")

Write-Host "==> [6/6] Selesai" -ForegroundColor Green
Write-Host "     GitHub: https://github.com/mcfuryamen/kasol-beta" -ForegroundColor Green