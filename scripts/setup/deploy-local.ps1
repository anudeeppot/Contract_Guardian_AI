$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$stateDir = Join-Path $PSScriptRoot ".local-state"
$backendPidFile = Join-Path $stateDir "backend.pid"
$frontendPidFile = Join-Path $stateDir "frontend.pid"

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

Write-Host "Starting Contract Guardian AI locally..."

if (Test-Path $backendPidFile) {
    $backendPid = Get-Content $backendPidFile -ErrorAction SilentlyContinue
    if ($backendPid) {
        Stop-Process -Id $backendPid -ErrorAction SilentlyContinue
    }
}
if (Test-Path $frontendPidFile) {
    $frontendPid = Get-Content $frontendPidFile -ErrorAction SilentlyContinue
    if ($frontendPid) {
        Stop-Process -Id $frontendPid -ErrorAction SilentlyContinue
    }
}

$uvicornExe = Join-Path $backendDir ".venv\Scripts\uvicorn.exe"
if (Test-Path $uvicornExe) {
    $backendProcess = Start-Process -WindowStyle Hidden -PassThru -FilePath $uvicornExe -ArgumentList 'app.main:app --host 0.0.0.0 --port 8000' -WorkingDirectory $backendDir
} else {
    $backendProcess = Start-Process -WindowStyle Hidden -PassThru -FilePath python -ArgumentList '-m uvicorn app.main:app --host 0.0.0.0 --port 8000' -WorkingDirectory $backendDir
}
$frontendProcess = Start-Process -WindowStyle Hidden -PassThru -FilePath 'npm.cmd' -ArgumentList 'run dev -- --host 0.0.0.0 --port 5173' -WorkingDirectory $frontendDir

Set-Content -Path $backendPidFile -Value $backendProcess.Id
Set-Content -Path $frontendPidFile -Value $frontendProcess.Id

Write-Host "Backend:  http://localhost:8000/docs"
Write-Host "Frontend: http://localhost:5173"
