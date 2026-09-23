#!/usr/bin/env pwsh

param(
  [string]$Command = "start"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"

$BackendPort = 8000
$FrontendPort = 5173

$BackendProc = $null
$FrontendProc = $null

function Get-PythonLauncher {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    return @{ FilePath = "py"; PrefixArgs = @("-3") }
  }

  if (Get-Command python -ErrorAction SilentlyContinue) {
    return @{ FilePath = "python"; PrefixArgs = @() }
  }

  throw "Could not find a Python launcher. Install Python and ensure 'py' or 'python' is on PATH."
}

function Stop-PortProcesses {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $pids = @()

  try {
    $pids = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
    $pids = @()
  }

  if (-not $pids -or $pids.Count -eq 0) {
    # Fallback for systems where Get-NetTCPConnection is unavailable.
    $netstatLines = netstat -ano | Select-String ":$Port\s"
    foreach ($line in $netstatLines) {
      $parts = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
      if ($parts.Count -gt 0) {
        $pidValue = $parts[$parts.Count - 1]
        if ($pidValue -match "^\d+$") {
          $pids += [int]$pidValue
        }
      }
    }
    $pids = $pids | Select-Object -Unique
  }

  if ($pids -and $pids.Count -gt 0) {
    Write-Host "Killing processes on port ${Port}: $($pids -join ', ')"
    foreach ($pid in $pids) {
      try {
        Stop-Process -Id $pid -ErrorAction SilentlyContinue
      } catch {
      }
    }

    Start-Sleep -Seconds 1

    foreach ($pid in $pids) {
      try {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      } catch {
      }
    }
  }
}

function Ensure-BackendEnv {
  $activatePath = Join-Path $BackendDir ".venv\Scripts\Activate.ps1"
  $venvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
  $venvPip = Join-Path $BackendDir ".venv\Scripts\pip.exe"

  if (-not (Test-Path $activatePath)) {
    Write-Host "Creating backend virtual environment..."
    $py = Get-PythonLauncher
    & $py.FilePath @($py.PrefixArgs + @("-m", "venv", (Join-Path $BackendDir ".venv")))
  }

  & $venvPython -c "import uvicorn" *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing backend dependencies..."
    & $venvPip install -r (Join-Path $BackendDir "requirements.txt")
  }

  $envPath = Join-Path $BackendDir ".env"
  $envExamplePath = Join-Path $BackendDir ".env.example"
  if (-not (Test-Path $envPath) -and (Test-Path $envExamplePath)) {
    Copy-Item $envExamplePath $envPath
    Write-Host "Created backend/.env from .env.example"
  }
}

function Ensure-FrontendEnv {
  $nodeModulesPath = Join-Path $FrontendDir "node_modules"
  if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $FrontendDir
    try {
      & npm install
    } finally {
      Pop-Location
    }
  }
}

function Stop-TrackedProcess {
  param(
    [Parameter(Mandatory = $false)]
    [System.Diagnostics.Process]$Process,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if ($null -ne $Process -and -not $Process.HasExited) {
    try {
      Write-Host "Stopping $Name (PID $($Process.Id))..."
      Stop-Process -Id $Process.Id -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 500
      if (-not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
      }
    } catch {
    }
  }
}

if ($Command -eq "stop") {
  Write-Host "Stopping backend and frontend ports..."
  Stop-PortProcesses -Port 8000
  Stop-PortProcesses -Port 8001
  Stop-PortProcesses -Port 5173
  Stop-PortProcesses -Port 5174
  Stop-PortProcesses -Port 5175
  Write-Host "Done."
  exit 0
}

if (-not (Test-Path $BackendDir) -or -not (Test-Path $FrontendDir)) {
  throw "Could not find backend/frontend folders relative to: $ScriptDir"
}

Ensure-BackendEnv
Ensure-FrontendEnv

Write-Host "Starting AI Job Assistant dev servers..."
Write-Host ""

Stop-PortProcesses -Port $BackendPort
Stop-PortProcesses -Port $FrontendPort

Write-Host "Backend -> http://localhost:$BackendPort"
$BackendProc = Start-Process -FilePath (Join-Path $BackendDir ".venv\Scripts\python.exe") `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--port", "$BackendPort", "--host", "0.0.0.0") `
  -WorkingDirectory $BackendDir `
  -NoNewWindow `
  -PassThru

Write-Host "Frontend -> http://localhost:$FrontendPort"
$FrontendProc = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "--", "--host", "0.0.0.0", "--port", "$FrontendPort", "--strictPort") `
  -WorkingDirectory $FrontendDir `
  -NoNewWindow `
  -PassThru

Write-Host ""
Write-Host "Press Ctrl+C to stop both servers."

try {
  while ($true) {
    Start-Sleep -Seconds 1

    if ($BackendProc.HasExited) {
      Write-Host "Backend exited with code $($BackendProc.ExitCode)."
      break
    }

    if ($FrontendProc.HasExited) {
      Write-Host "Frontend exited with code $($FrontendProc.ExitCode)."
      break
    }
  }
} finally {
  Write-Host ""
  Write-Host "Stopping servers..."
  Stop-TrackedProcess -Process $BackendProc -Name "backend"
  Stop-TrackedProcess -Process $FrontendProc -Name "frontend"
  Write-Host "Done."
}
