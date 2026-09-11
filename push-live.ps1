# push-live.ps1
# ============================================================
# Alur rilis kasol LIVE:
#   kasol-beta (main, snapshot stabil) -> mirror kasol live (fetch, TANPA branch preview)
#   -> squash ke 1 commit bersih (orphan _release -> main)
#   -> push GitHub kasol (main)
# Hanya rilis BETA yang stabil yang boleh naik ke LIVE.
# Semua push GitHub selalu ke branch MAIN — tidak ada branch preview.
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
  # Kecualikan skrip push itu sendiri — pola prefix token terliteral di
  # $secretPatterns-nya, tanpa ini guard selalu self-match dan gagal sendiri.
  $selfExclude = @("--", ".", ":(exclude)push-beta.ps1", ":(exclude)push-live.ps1")
  foreach ($p in $secretPatterns) {
    if ($Cached) {
      $m = & git -C $dir grep --cached -n $p @selfExclude 2>$null
    } else {
      $m = & git -C $dir grep -n $p @selfExclude 2>$null
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

# Drift detector: bandingkan pohon REF sumber vs STAGED INDEX mirror
# (isi persis yang akan di-commit — pengecekan sebelum commit).
# Mengembalikan $true jika ada drift. Lihat push-beta.ps1 untuk konteks.
function Test-SnapshotDrift([string]$SrcRepo, [string]$SrcRef, [string]$TgtRepo) {
  $src = & git -C $SrcRepo ls-tree -r --name-only $SrcRef 2>$null | Sort-Object
  $tgt = & git -C $TgtRepo ls-files --cached 2>$null | Sort-Object
  if (-not $tgt) {
    Write-Host "     [DRIFT] Index target $TgtRepo kosong — lewati cek." -ForegroundColor Yellow
    return $false
  }
  $onlySrc = @($src | Where-Object { $_ -notin $tgt })
  $onlyTgt = @($tgt | Where-Object { $_ -notin $src })
  if ($onlySrc.Count -eq 0 -and $onlyTgt.Count -eq 0) {
    $srcLen = $src.Count
    Write-Host ('     Drift check OK: {0} file identik.' -f $srcLen) -ForegroundColor Green
    return $false
  }
  Write-Host ('[DRIFT] Snapshot tidak identik: {0} ({1}) vs index {2}' -f $SrcRepo, $SrcRef, $TgtRepo) -ForegroundColor Yellow
  if ($onlySrc.Count -gt 0) {
    $onlySrcLen = $onlySrc.Count
    Write-Host ('  Ada di source tapi TIDAK di snapshot ({0} file, max 50):' -f $onlySrcLen) -ForegroundColor Yellow
    $onlySrc | Select-Object -First 50 | ForEach-Object { Write-Host ('    + {0}' -f $_) }
  }
  if ($onlyTgt.Count -gt 0) {
    $onlyTgtLen = $onlyTgt.Count
    Write-Host ('  Ada di snapshot tapi TIDAK di source ({0} file, max 50):' -f $onlyTgtLen) -ForegroundColor Yellow
    $onlyTgt | Select-Object -First 50 | ForEach-Object { Write-Host ('    - {0}' -f $_) }
  }
  return $true
}

# ------------------------------------------------------------
Write-Host "==> [1/6] Ambil snapshot stabil dari kasol-beta (main)" -ForegroundColor Cyan
# Prefix '+' = paksa update refs/beta/main — squash rilis selalu non-fast-forward,
# tanpa ini fetch ditolak ("non-fast-forward") tiap rilis (ditemukan 2026-09-06).
Invoke-Git $LiveDir @("fetch", $BetaDir, "+main:refs/beta/main")

Write-Host "==> [2/6] Simpan SHA rilis sebelumnya (referensi rollback)" -ForegroundColor Cyan
$prevMainSha = & git -C $LiveDir rev-parse main 2>$null
if ($prevMainSha) { Write-Host "     Rilis sebelumnya: $prevMainSha" }

Write-Host "==> [3/6] Bangun snapshot squash bersih dari beta main" -ForegroundColor Cyan
# Tanpa branch preview: snapshot dibangun di branch sementara `_release`
# (orphan), lalu di-rename jadi `main` setelah commit.
& git -C $LiveDir branch -D _release 2>$null
Invoke-Git $LiveDir @("switch", "--orphan", "_release")
Invoke-Git $LiveDir @("checkout", "refs/beta/main", "--", ".")
Invoke-Git $LiveDir @("add", "-A")

Write-Host "==> [4/6] Verifikasi snapshot (drift + secret)" -ForegroundColor Cyan
# Drift guard: staged index HARUS identik dengan beta main (sumber snapshot)
if (Test-SnapshotDrift -SrcRepo $BetaDir -SrcRef "main" -TgtRepo $LiveDir) {
  Write-Host "[FAIL] Snapshot live tidak identik dengan beta main." -ForegroundColor Red
  Write-Host "       Pastikan beta main stabil sebelum menjalankan push-live.ps1." -ForegroundColor Red
  exit 1
}
# Verifikasi secret di snapshot (cached)
if (Test-TreeSecret $LiveDir -Cached) {
  Write-Host "[FAIL] Snapshot mengandung pola secret:" -ForegroundColor Red
  $script:secretHits | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}
$fileCount = (git -C $LiveDir diff --cached --name-only | Measure-Object -Line).Lines
Write-Host "     Snapshot berisi $fileCount file."
Invoke-Git $LiveDir @("commit", "-m", "chore: rilis live $stamp (snapshot bersih, squash dari beta stabil)", "--trailer", "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>")

Write-Host "==> [5/6] Ganti `main` & push ke GitHub kasol live" -ForegroundColor Cyan
& git -C $LiveDir branch -D main 2>$null
Invoke-Git $LiveDir @("branch", "-m", "main")
$ans = Read-Host "     Squash snapshot siap. Push --force-with-lease ke GitHub main? (y/N)"
if ($ans -ne "y") {
  Write-Host "     Batal. Snapshot tetap tersimpan di branch main lokal kasol live." -ForegroundColor Yellow
  exit 0
}
Invoke-Git $LiveDir @("push", "origin", "main", "--force-with-lease")

Write-Host "==> [6/6] Selesai" -ForegroundColor Green
Write-Host "     GitHub: https://github.com/mcfuryamen/kasol" -ForegroundColor Green
