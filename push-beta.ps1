# push-beta.ps1
# ============================================================
# Alur rilis kasol-beta (BETA):
#   folder kerja (main) -> mirror kasol-beta (fetch langsung, TANPA branch preview)
#                         -> squash ke 1 commit bersih (orphan _release -> main)
#                         -> push GitHub kasol-beta (main)
# Semua push GitHub selalu ke branch MAIN — tidak ada branch preview.
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

# Drift detector: bandingkan pohon REF sumber vs STAGED INDEX mirror.
# Index (ls-files --cached) = isi persis yang akan di-commit — pengecekan
# dilakukan SEBELUM commit, saat branch main baru memang belum ada (orphan).
# Mengembalikan $true jika ada drift (file hilang / nyasar).
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
Write-Host "==> [1/6] Fetch folder kerja -> mirror kasol-beta" -ForegroundColor Cyan
Invoke-Git $BetaDir @("fetch", "--prune", "work")

Write-Host "==> [2/6] Simpan SHA rilis sebelumnya (untuk version-bump check)" -ForegroundColor Cyan
$prevMainSha = & git -C $BetaDir rev-parse main 2>$null
if ($prevMainSha) { Write-Host "     Rilis sebelumnya: $prevMainSha" }

Write-Host "==> [3/6] Bangun snapshot squash bersih dari work/main" -ForegroundColor Cyan
# Tanpa branch preview: snapshot dibangun di branch sementara `_release`
# (orphan — tanpa history), lalu di-rename jadi `main` setelah commit.
# `checkout work/main -- .` menyalin pohon folder kerja apa adanya —
# semua file tracked pasti ikut.
& git -C $BetaDir branch -D _release 2>$null
Invoke-Git $BetaDir @("switch", "--orphan", "_release")
Invoke-Git $BetaDir @("checkout", "work/main", "--", ".")
Invoke-Git $BetaDir @("add", "-A")

Write-Host "==> [4/6] Verifikasi snapshot (drift + secret + version bump)" -ForegroundColor Cyan
# Drift guard: staged index HARUS identik dengan work HEAD
if (Test-SnapshotDrift -SrcRepo $WorkDir -SrcRef "HEAD" -TgtRepo $BetaDir) {
  Write-Host "[FAIL] Snapshot beta kehilangan/menambah file dibanding work HEAD." -ForegroundColor Red
  Write-Host "       Biasanya karena file nyasar/untracked di mirror kasol-beta." -ForegroundColor Red
  exit 1
}
# Verifikasi secret di snapshot (cached)
if (Test-TreeSecret $BetaDir -Cached) {
  Write-Host "[FAIL] Snapshot mengandung pola secret:" -ForegroundColor Red
  $script:secretHits | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
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
$fileCount = (git -C $BetaDir diff --cached --name-only | Measure-Object -Line).Lines
Write-Host "     Snapshot berisi $fileCount file."
Invoke-Git $BetaDir @("commit", "-m", "chore: rilis beta $stamp (snapshot bersih, squash dari folder kerja)", "--trailer", "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>")

Write-Host "==> [5/6] Ganti `main` & push ke GitHub kasol-beta" -ForegroundColor Cyan
& git -C $BetaDir branch -D main 2>$null
Invoke-Git $BetaDir @("branch", "-m", "main")
$ans = Read-Host "     Squash snapshot siap. Push --force-with-lease ke GitHub main? (y/N)"
if ($ans -ne "y") {
  Write-Host "     Batal. Snapshot tetap tersimpan di branch main lokal kasol-beta." -ForegroundColor Yellow
  exit 0
}
Invoke-Git $BetaDir @("push", "origin", "main", "--force-with-lease")

Write-Host "==> [6/6] Selesai" -ForegroundColor Green
Write-Host "     GitHub: https://github.com/mcfuryamen/kasol-beta" -ForegroundColor Green
