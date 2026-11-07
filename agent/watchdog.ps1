<#
 * Penjaga Proses Agent Kasol - agent/watchdog.ps1
 * =============================================================================
 * Menjaga dua proses tetap hidup di PC ini (Windows PowerShell 5.1+):
 *   1. OTAK Omniroute  - cek GET http://127.0.0.1:20128/models dgn timeout
 *      singkat; kalau tidak hidup -> start ulang node (background, jendela
 *      tersembunyi). Lihat konstanta $OmniEntries di bawah utk path entry
 *      point + komentar "CARA CEK ENTRY POINT".
 *   2. RUNNER agent    - cari proses node dgn argumen "runner.mjs --watch";
 *      kalau tidak ada -> start "node agent/runner.mjs --watch" dgn
 *      WorkingDirectory root repo.
 *
 * Script ini TIDAK PERNAH mematikan proses apa pun (tidak ada Stop-Process /
 * taskkill) - hanya menyalakan yang mati. Kalau Omniroute belum balas tapi
 * prosesnya masih ada (mis. masih warm-up ~25-30 dtk, lihat agent/callAI.js),
 * dia TIDAK start ganda supaya tidak menabrak proses yang sedang hidup.
 *
 * Log ringkas ditulis ke agent\watchdog.log (rotate otomatis > 1 MB menjadi
 * watchdog.log.1).
 *
 * CARA PAKAI:
 *   - Mode loop (proses jangka panjang, cek tiap 60 dtk):
 *       powershell -ExecutionPolicy Bypass -File agent\watchdog.ps1
 *   - Mode sekali jalan (utk Task Scheduler tiap 1 menit):
 *       powershell -ExecutionPolicy Bypass -File agent\watchdog.ps1 -OneShot
 * =============================================================================

.SYNOPSIS
  Watchdog proses Omniroute + runner agent kasol.

.PARAMETER OneShot
  Jalankan satu siklus cek lalu keluar (pasangan Task Scheduler interval 1 menit).
  Tanpa flag ini script berjalan sebagai loop tiap $LoopSec detik.
#>
param(
  [switch]$OneShot
)

$ErrorActionPreference = 'Continue'

# ── Konfigurasi ──────────────────────────────────────────────────────────────
$RepoRoot = Split-Path $PSScriptRoot -Parent        # root repo (folder induk agent/)
$LogFile  = Join-Path $PSScriptRoot 'watchdog.log'  # log ringkas
$RotBytes = 1MB                                     # rotate kalau log lewat 1 MB
$LoopSec  = 60                                      # jeda antar-cek (mode loop)
$OmniURL  = 'http://127.0.0.1:20128/models'         # WAJIB 127.0.0.1, bukan 'localhost'
#   (localhost timeout krn bind ganda IPv4+IPv6 - lihat komentar agent/callAI.js)
$OmniTimeoutSec = 20                                # timeout cek dlm detik (tetap "singkat",
#   tapi cukup longgar utk warm-up otak yang idle ~25-30 dtk; kalau sering false
#   negative saat warm-up, naikkan ke 45 - sama dgn omniHealthy() di callAI.js)
$OmniMemMB = 2313                                   # --max-old-space-size utk proses omniroute
#   (disamakan dgn proses omniroute eksisting yang hidup di PC ini)

# ── Entry point Omniroute ────────────────────────────────────────────────────
# CARA CEK ENTRY POINT (lakukan kalau omniroute di-upgrade dan path berubah):
#   1. dir "%APPDATA%\npm\node_modules\omniroute"          -> lihat isi paket
#   2. type "%APPDATA%\npm\node_modules\omniroute\package.json" -> bagian "bin"
#   3. powershell: Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
#        Where-Object { $_.CommandLine -like '*omniroute*' }
#      -> lihat command line persis proses omniroute yang sedang hidup.
# HASIL PENGECEKAN DI DISK (2026-09-18): file "server.js" di root paket TIDAK
# ADA; yang ada dan terbukti dipakai proses hidup adalah
#   node --max-old-space-size=2313 ...\omniroute\dist\server-ws.mjs
# Kandidat di bawah dicek berurutan - dipakai yang PERTAMA ditemukan di disk.
$OmniEntries = @(
  @{ Path = "$env:APPDATA\npm\node_modules\omniroute\dist\server-ws.mjs"; AppArgs = @() },
  @{ Path = "$env:APPDATA\npm\node_modules\omniroute\dist\server.js";     AppArgs = @() },
  @{ Path = "$env:APPDATA\npm\node_modules\omniroute\bin\omniroute.mjs";  AppArgs = @('serve', '--no-open') }
)

# ── Helper ───────────────────────────────────────────────────────────────────
function Write-Log([string]$Msg) {
  $line = '[{0:yyyy-MM-dd HH:mm:ss}] {1}' -f (Get-Date), $Msg
  # Rotate sederhana: log penuh > 1 MB digeser jadi watchdog.log.1 (timpa lama)
  if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt $RotBytes)) {
    Move-Item -Force -Path $LogFile -Destination "$($LogFile).1"
  }
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

# Cek otak Omniroute hidup: GET /models dgn timeout singkat.
# PAKAI HttpWebRequest (bukan Invoke-WebRequest): PS 5.1 membawa proxy sistem
# (WinINET/WPAD) yang bikin request ke 127.0.0.1 TIMEOUT walau otak hidup -
# terbukti saat pengujian (Invoke-WebRequest timeout 10 dtk, HttpWebRequest
# dengan Proxy=$null balas 200 dalam ~300 ms). Proxy=$null WAJIB.
function Test-Omni {
  try {
    $req = [System.Net.HttpWebRequest]::Create($OmniURL)
    $req.Timeout = $OmniTimeoutSec * 1000
    $req.ReadWriteTimeout = $OmniTimeoutSec * 1000
    $req.Proxy = $null                    # bypass proxy sistem utk localhost
    $req.UserAgent = 'kasol-watchdog'
    $req.Headers.Add('Authorization', 'Bearer omniroute')
    $resp = $req.GetResponse()
    $ok = ([int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 300)
    $resp.Close()
    return $ok
  } catch { return $false }   # timeout / connection refused / 5xx = dianggap mati
}

# Semua proses node.exe yang hidup (CommandLine bisa $null - di-guard).
function Get-NodeProcs {
  return @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine })
}

# ── Satu siklus cek ──────────────────────────────────────────────────────────
function Invoke-Cek {
  # 1) OTAK OMNIROUTE ---------------------------------------------------------
  $omniProc = @(Get-NodeProcs | Where-Object { $_.CommandLine -like '*omniroute*' })
  if (Test-Omni) {
    Write-Log 'omni oke'
  } elseif ($omniProc.Count -gt 0) {
    # Proses masih ada tapi belum balas -> kemungkinan masih warm-up.
    # JANGAN start ganda: proses kedua akan gagal bind port / menabrak yang hidup.
    Write-Log 'omni tidak balas (timeout) tapi proses masih ada - tunggu, tidak start ganda'
  } else {
    $entry = $OmniEntries | Where-Object { Test-Path $_.Path } | Select-Object -First 1
    if ($entry) {
      Write-Log ("omni MATI -> start ulang: node --max-old-space-size={0} {1} {2}" -f `
        $OmniMemMB, $entry.Path, ($entry.AppArgs -join ' '))
      # --max-old-space-size harus SEBELUM path script; AppArgs (kl. CLI) sesudahnya.
      $nodeArgs = @("--max-old-space-size=$OmniMemMB", "`"$($entry.Path)`"") + $entry.AppArgs
      Start-Process -FilePath 'node.exe' -ArgumentList $nodeArgs `
        -WorkingDirectory (Split-Path $entry.Path -Parent) -WindowStyle Hidden
    } else {
      Write-Log 'omni MATI tapi TIDAK ADA entry point ditemukan - cek/ubah $OmniEntries di script ini'
    }
  }

  # 2) RUNNER (node agent/runner.mjs --watch) ---------------------------------
  $runner = @(Get-NodeProcs | Where-Object {
    $_.CommandLine -match 'runner\.mjs' -and $_.CommandLine -match '--watch' })
  if ($runner.Count -gt 0) {
    Write-Log "runner jalan (pid $($runner[0].ProcessId))"
  } else {
    Write-Log 'runner tidak ada -> start node agent/runner.mjs --watch'
    # Jendela tersembunyi; stdout/stderr dialihkan ke log terpisah biar bisa
    # dicek kalau runner tiba-tiba mati (dua file beda - syarat Start-Process).
    Start-Process -FilePath 'node.exe' -ArgumentList 'agent/runner.mjs', '--watch' `
      -WorkingDirectory $RepoRoot -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $PSScriptRoot 'runner-watch.out.log') `
      -RedirectStandardError  (Join-Path $PSScriptRoot 'runner-watch.err.log')
  }
}

# ── Loop utama ───────────────────────────────────────────────────────────────
if ($OneShot) {
  Invoke-Cek
} else {
  Write-Log "watchdog mulai (mode loop tiap $LoopSec detik)"
  for (;;) {
    try { Invoke-Cek } catch { Write-Log "ERROR siklus: $($_.Exception.Message)" }
    Start-Sleep -Seconds $LoopSec
  }
}
