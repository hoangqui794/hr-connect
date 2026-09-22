[CmdletBinding()]
param(
    [string]$EnvironmentFile = ".env.e2e"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repoRoot $EnvironmentFile
$runtimeDirectory = Join-Path $repoRoot ".e2e"
$processFile = Join-Path $runtimeDirectory "processes.json"
$aiPython = Join-Path $repoRoot "ai-service\.venv\Scripts\python.exe"
$backendDirectory = Join-Path $repoRoot "HRConnect\HRConnect.Presentation"
$backendDll = Join-Path $backendDirectory "bin\Debug\net8.0\HRConnect.Presentation.dll"

function Import-EnvironmentFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing $Path. Copy .env.e2e.example to .env.e2e and fill in the local values."
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -ne 2 -or -not $parts[0].Trim()) {
            throw "Invalid environment entry: $line"
        }
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1], "Process")
    }
}

function Require-EnvironmentValue {
    param([string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match "replace-") {
        throw "$Name is missing or still contains a placeholder."
    }
    return $value
}

function Test-PortInUse {
    param([int]$Port)

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync("127.0.0.1", $Port)
        return $task.Wait(300) -and $client.Connected
    }
    catch { return $false }
    finally { $client.Dispose() }
}

function Wait-ForUrl {
    param([string]$Url, [int]$TimeoutSeconds = 60)

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $response = Invoke-RestMethod -Uri $Url -TimeoutSec 3
            if ($response.status -in @("ok", "ready")) { return }
        }
        catch { Start-Sleep -Milliseconds 500 }
    }
    throw "Timed out waiting for $Url"
}

function Wait-ForPort {
    param(
        [int]$Port,
        [System.Diagnostics.Process]$Process,
        [int]$TimeoutSeconds = 60
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($Process.HasExited) {
            throw "Backend exited before opening port $Port (exit code $($Process.ExitCode))."
        }
        if (Test-PortInUse -Port $Port) { return }
        Start-Sleep -Milliseconds 500
    }
    throw "Timed out waiting for backend port $Port."
}

Import-EnvironmentFile -Path $environmentPath
[Environment]::SetEnvironmentVariable("ASPNETCORE_CONTENTROOT", $backendDirectory, "Process")
[Environment]::SetEnvironmentVariable("Logging__EventLog__LogLevel__Default", "None", "Process")
$connectionString = Require-EnvironmentValue -Name "ConnectionStrings__DefaultConnection"
$serviceToken = Require-EnvironmentValue -Name "HRCONNECT_SERVICE_TOKEN"
$null = Require-EnvironmentValue -Name "MF03_BASE_URL"
$null = Require-EnvironmentValue -Name "HRCONNECT_BASE_URL"

if ($connectionString -notmatch "(?i)(Database|Initial Catalog)\s*=\s*[^;]*e2e") {
    throw "Safety check failed: the configured database name must contain 'e2e'."
}
if ($serviceToken.Length -lt 24) {
    throw "HRCONNECT_SERVICE_TOKEN must contain at least 24 characters."
}
if (-not (Test-Path -LiteralPath $aiPython)) {
    throw "AI virtual environment not found at $aiPython. Create it before running E2E."
}
if (-not (Test-Path -LiteralPath $backendDll)) {
    throw "Backend build not found at $backendDll. Build HRConnect.Presentation before running E2E."
}
if (Test-Path -LiteralPath $processFile) {
    throw "An E2E process file already exists. Run scripts\Stop-Mf03E2e.ps1 first."
}
if (Test-PortInUse -Port 7289) { throw "Port 7289 is already in use." }
if (Test-PortInUse -Port 8001) { throw "Port 8001 is already in use." }

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$started = @()
try {
    $backend = Start-Process -FilePath "dotnet" `
        -ArgumentList @($backendDll) `
        -WorkingDirectory $repoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $runtimeDirectory "backend.out.log") `
        -RedirectStandardError (Join-Path $runtimeDirectory "backend.err.log") `
        -PassThru
    $started += $backend

    $ai = Start-Process -FilePath $aiPython `
        -ArgumentList @("-m", "uvicorn", "app.main:app", "--port", "8001") `
        -WorkingDirectory (Join-Path $repoRoot "ai-service") `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $runtimeDirectory "ai.out.log") `
        -RedirectStandardError (Join-Path $runtimeDirectory "ai.err.log") `
        -PassThru
    $started += $ai

    @{
        backendPid = $backend.Id
        aiPid = $ai.Id
        startedAt = [DateTime]::UtcNow.ToString("O")
    } | ConvertTo-Json | Set-Content -LiteralPath $processFile -Encoding UTF8

    Wait-ForPort -Port 7289 -Process $backend
    Wait-ForUrl -Url "http://127.0.0.1:8001/health"
    Wait-ForUrl -Url "http://127.0.0.1:8001/ready"

    Write-Host "MF-03 E2E services are running."
    Write-Host "Run HRConnect/HRConnect.Presentation/HttpTests/Mf03.BackgroundScoringTests.http in order."
    Write-Host "Logs: $runtimeDirectory"
}
catch {
    foreach ($process in $started) {
        if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    }
    Remove-Item -LiteralPath $processFile -Force -ErrorAction SilentlyContinue
    throw
}
