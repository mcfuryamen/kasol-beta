<#
 * Pendaftaran Task Scheduler Agent Kasol - agent/install-scheduler.ps1
 * =============================================================================
 * Mendaftarkan DUA scheduled task Windows (berjalan di sesi user yang login,
 * tidak butuh hak admin):
 *
 *   (a) 'Kasol Agent Watchdog'
 *       Tiap 1 menit  ->  powershell.exe -NoProfile -ExecutionPolicy Bypass
 *                         -File "<repo>\agent\watchdog.ps1" -OneShot
 *       (menjaga otak Omniroute + runner agent tetap hidup)
 *
 *   (b) 'Kasol Followup Harian'
 *       Tiap hari 08:00  ->  node.exe agent/enqueue-followup.mjs
 *       (WorkingDirectory root repo - naruh tugas followup_wa ke antrean)
 *
 * Semua path diambil absolut dari $PSScriptRoot, jadi script boleh dipanggil
 * dari folder mana pun.
 *
 * CARA PAKAI:
 *   powershell -ExecutionPolicy Bypass -File agent\install-scheduler.ps1
 *
 * CARA UNINSTALL (hapus kedua task):
 *   Unregister-ScheduledTask -TaskName 'Kasol Agent Watchdog'    -Confirm:$false
 *   Unregister-ScheduledTask -TaskName 'Kasol Followup Harian'   -Confirm:$false
 *   Cek sisa: Get-ScheduledTask -TaskName 'Kasol *'
 *
 * Uji jalan manual tanpa menunggu jadwal:
 *   Start-ScheduledTask -TaskName 'Kasol Agent Watchdog'
 *   Start-ScheduledTask -TaskName 'Kasol Followup Harian'
 * =============================================================================

.NOTES
  Idempotent: task lama dengan nama yang sama dibuang dulu lalu didaftarkan
  ulang, jadi script ini aman dijalankan berulang kali.
#>

$ErrorActionPreference = 'Stop'

# ── Path absolut ─────────────────────────────────────────────────────────────
$RepoRoot = Split-Path $PSScriptRoot -Parent   # ...\kasol
$AgentDir = $PSScriptRoot                      # ...\kasol\agent
$PSExe    = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
# Node di-resolve absolut dari PATH supaya task tidak tergantung PATH saat runtime
$NodeExe  = (Get-Command node.exe -ErrorAction Stop).Source

# ── (a) Kasol Agent Watchdog - tiap 1 menit, watchdog.ps1 -OneShot ───────────
$watchdogScript = Join-Path $AgentDir 'watchdog.ps1'
$actionA = New-ScheduledTaskAction -Execute $PSExe `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -OneShot' -f $watchdogScript) `
  -WorkingDirectory $AgentDir

# RepetitionDuration: [TimeSpan]::MaxValue kerap DITOLAK oleh PS 5.1 saat
# Register-ScheduledTask -> dipakai 3650 hari (~10 tahun) sebagai "selamanya".
$triggerA = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$settingsA = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# ── (b) Kasol Followup Harian - tiap hari 08:00, enqueue-followup.mjs ────────
$actionB = New-ScheduledTaskAction -Execute $NodeExe `
  -Argument 'agent/enqueue-followup.mjs' `
  -WorkingDirectory $RepoRoot

$triggerB = New-ScheduledTaskTrigger -Daily -At '08:00'

$settingsB = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 60)

# ── Daftarkan (buang task lama dgn nama sama -> idempotent) ──────────────────
$tasks = @(
  @{
    Name    = 'Kasol Agent Watchdog'
    Action  = $actionA
    Trigger = $triggerA
    Setting = $settingsA
    Desc    = 'Penjaga proses Omniroute + runner agent kasol (sekali jalan per menit).'
  },
  @{
    Name    = 'Kasol Followup Harian'
    Action  = $actionB
    Trigger = $triggerB
    Setting = $settingsB
    Desc    = 'Seeder harian tugas followup_wa ke agent_tasks (jam 08:00).'
  }
)

foreach ($t in $tasks) {
  if (Get-ScheduledTask -TaskName $t.Name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $t.Name -Confirm:$false
    Write-Host "Task lama dibuang : $($t.Name)"
  }
  Register-ScheduledTask -TaskName $t.Name -Action $t.Action -Trigger $t.Trigger `
    -Settings $t.Setting -Description $t.Desc | Out-Null
  Write-Host "Task terdaftar     : $($t.Name)"
}

Write-Host 'Selesai. Cek dengan: Get-ScheduledTask -TaskName "Kasol *"'
