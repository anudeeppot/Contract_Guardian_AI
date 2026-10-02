$ErrorActionPreference = "Stop"

$stateDir = Join-Path $PSScriptRoot ".local-state"
$backendPidFile = Join-Path $stateDir "backend.pid"
$frontendPidFile = Join-Path $stateDir "frontend.pid"

foreach ($pidFile in @($backendPidFile, $frontendPidFile)) {
    if (Test-Path $pidFile) {
        $pid = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($pid) {
            Stop-Process -Id $pid -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
    }
}

Write-Host "Stopped local backend and frontend processes."
