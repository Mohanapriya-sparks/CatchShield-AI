#!/usr/bin/env pwsh
<#
.SYNOPSIS
  One-command local start for CatchShield AI MVP.
  Starts backend (FastAPI), frontend (Vite), and optionally the Hardhat node.

.USAGE
  .\start.ps1            # Start backend + frontend
  .\start.ps1 -Chain    # Also start Hardhat node
  .\start.ps1 -Seed     # Seed demo data after starting
#>
param(
  [switch]$Chain,
  [switch]$Seed
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "=== CatchShield AI – Local Start ===" -ForegroundColor Cyan

# --- Backend ---
Write-Host "`n[1/3] Installing backend dependencies..." -ForegroundColor Yellow
Push-Location "$Root\backend"
  if (-not (Test-Path "venv")) {
    python -m venv venv
  }
  .\venv\Scripts\pip install -q -r requirements.txt
  
  if (-not (Test-Path ".env")) {
    Copy-Item .env.example .env
  }
  
  Write-Host "Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Green
  Start-Process -NoNewWindow powershell -ArgumentList "-Command", ".\venv\Scripts\uvicorn app.main:app --reload --port 8000"
Pop-Location

Start-Sleep -Seconds 3

# --- Seed ---
if ($Seed) {
  Write-Host "`n[Seed] Running demo seed data..." -ForegroundColor Yellow
  Push-Location "$Root\backend"
    .\venv\Scripts\python -m scripts.seed
  Pop-Location
}

# --- Frontend ---
Write-Host "`n[2/3] Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location "$Root\frontend"
  if (-not (Test-Path "node_modules")) {
    npm install --silent
  }
  Write-Host "Starting Vite dev server on http://localhost:5173 ..." -ForegroundColor Green
  Start-Process -NoNewWindow powershell -ArgumentList "-Command", "npm run dev"
Pop-Location

# --- Hardhat (optional) ---
if ($Chain) {
  Write-Host "`n[3/3] Starting Hardhat node..." -ForegroundColor Yellow
  Push-Location "$Root\chain"
    if (-not (Test-Path "node_modules")) {
      npm install --silent
    }
    Start-Process -NoNewWindow powershell -ArgumentList "-Command", "npx hardhat node"
    Start-Sleep -Seconds 4
    Write-Host "Deploying contract..." -ForegroundColor Yellow
    npx hardhat run scripts/deploy.js --network localhost
  Pop-Location
}

Write-Host "`n=== All services started ===" -ForegroundColor Cyan
Write-Host "Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "Backend  : http://localhost:8000" -ForegroundColor White
Write-Host "API Docs : http://localhost:8000/docs" -ForegroundColor White
if ($Chain) {
  Write-Host "Hardhat  : http://localhost:8545" -ForegroundColor White
}
Write-Host "`nDisclaimer: No alert overlap or matching hash proves seafood safety." -ForegroundColor DarkYellow
