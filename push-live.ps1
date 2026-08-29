# push-live.ps1
# ============================================================
# Alur rilis kasol LIVE:
#   kasol-beta (main, snapshot stabil) -> kasol live (main)
#   -> squash ke 1 commit bersih -> push GitHub kasol (main)
# Hanya rilis BETA yang stabil yang boleh naik ke LIVE.
# Semua push GitHub selalu ke branch MAIN.
# ============================================================
param(
  [string]$LiveDir = "C:\Users\Admin\Documents\GitHub\kasol",
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

# Drift detector: pastikan snapshot live main identik dengan beta main.
# Sumber snapshot push-live = beta main, target = live main index. Mengembalikan
# $true jika ada drift. Lihat Test-TreeDrift di push-beta.ps1 untuk konteks.
function Test-TreeDrift([string]$SourceDir, [string]$TargetDir) {
  $src = & git -C $SourceDir ls-tree -r --name-only main 2>$null | Sort-Object
  $tgt = & git -C $TargetDir ls-tree -r --name-only HEAD 2>$null | Sort-Object
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
Write-Host "==> [1/6] Ambil snapshot stabil dari kasol-beta (main)" -ForegroundColor Cyan
Invoke-Git $LiveDir @("fetch", $BetaDir, "main:refs/beta/main")

Write-Host "==> [2/6] Sync kasol live (main) ke snapshot beta" -ForegroundColor Cyan
Invoke-Git $LiveDir @("switch", "main")
Invoke-Git $LiveDir @("reset", "--hard", "refs/beta/main")
# Pindah dari main supaya bisa hapus branch main nanti (git tidak bisa hapus branch aktif)
Invoke-Git $LiveDir @("switch", "preview")

# Verifikasi secret di working tree
if (Test-TreeSecret $LiveDir) {
  Write-Host "[FAIL] Working tree kasol live mengandung pola secret:" -ForegroundColor Red
  $script:secretHits | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}

Write-Host "==> [3/6] Buat snapshot squash bersih di branch main" -ForegroundColor Cyan
& git -C $LiveDir branch -D main 2>$null
Invoke-Git $LiveDir @("switch", "--orphan", "main")
# Orphan checkout mengosongkan working tree — restore semua file dari pohon beta/main
Invoke-Git $LiveDir @("checkout", "refs/beta/main", "--", ".")
# Index orphan sekarang terisi file dari snapshot beta — staging semua
Invoke-Git $LiveDir @("add", "-A")

# Drift guard: snapshot live main harus identik dengan beta main (sumber snapshot)
if (Test-TreeDrift -SourceDir $BetaDir -TargetDir $LiveDir) {
  Write-Host "[FAIL] Snapshot live main tidak identik dengan beta main." -ForegroundColor Red
  Write-Host "       Pastikan beta main stabil sebelum menjalankan push-live.ps1." -ForegroundColor Red
  exit 1
}

# Verifikasi ulang index (cached)
if (Test-TreeSecret $LiveDir -Cached) {
  Write-Host "[FAIL] Snapshot main mengandung pola secret:" -ForegroundColor Red
  $script:secretHits | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}

$fileCount = (git -C $LiveDir diff --cached --name-only | Measure-Object -Line).Lines
Write-Host "     Snapshot berisi $fileCount file."

Invoke-Git $LiveDir @("commit", "-m", "chore: rilis live $stamp (snapshot bersih, squash dari beta stabil)", "--trailer", "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>")

Write-Host "==> [4/6] Push ke GitHub kasol live (main)" -ForegroundColor Cyan
$ans = Read-Host "     Squash snapshot siap. Push --force-with-lease ke GitHub main? (y/N)"
if ($ans -ne "y") {
  Write-Host "     Batal. Snapshot main lokal tetap tersimpan di kasol live." -ForegroundColor Yellow
  exit 0
}
Invoke-Git $LiveDir @("push", "origin", "main", "--force-with-lease")

Write-Host "==> [5/6] Kembalikan working branch kasol live ke main" -ForegroundColor Cyan
Invoke-Git $LiveDir @("switch", "main")

Write-Host "==> [6/6] Selesai" -ForegroundColor Green
Write-Host "     GitHub: https://github.com/mcfuryamen/kasol" -ForegroundColor Green