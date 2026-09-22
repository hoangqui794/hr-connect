[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$processFile = Join-Path $repoRoot ".e2e\processes.json"

if (-not (Test-Path -LiteralPath $processFile)) {
    Write-Host "No MF-03 E2E process file was found."
    exit 0
}

$processInfo = Get-Content -Raw -LiteralPath $processFile | ConvertFrom-Json
foreach ($taskPid in @($processInfo.backendPid, $processInfo.aiPid)) {
    if (-not $taskPid) { continue }
    $process = Get-Process -Id $taskPid -ErrorAction SilentlyContinue
    if ($process) {
        try {
            Stop-Process -Id $taskPid -Force -ErrorAction Stop
            Write-Host "Stopped process $taskPid."
        }
        catch {
            Write-Warning "Could not stop process $taskPid because it already exited or is no longer accessible."
        }
    }
}

Remove-Item -LiteralPath $processFile -Force
