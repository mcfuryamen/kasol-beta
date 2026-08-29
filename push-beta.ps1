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

# ------------------------------------------------------------
Write-Host "==> [1/6] Push folder kerja (preview) -> kasol-beta" -ForegroundColor Cyan
Invoke-Git $WorkDir @("push", "beta", "preview")

Write-Host "==> [2/6] Sync kasol-beta preview ke HEAD folder kerja" -ForegroundColor Cyan
Invoke-Git $BetaDir @("fetch", "work")
Invoke-Git $BetaDir @("switch", "preview")
Invoke-Git $BetaDir @("reset", "--hard", "work/preview")

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