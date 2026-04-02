@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo       AI Job Assistant - Startup
echo ==========================================
echo.

:: 1. Check if Docker is installed and running
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not installed or not running.
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    echo Make sure Docker Desktop is open and running before running this script.
    echo.
    pause
    exit /b 1
)

:: 2. Check if docker-compose is available
docker-compose --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] docker-compose is not installed.
    echo Make sure you have installed Docker Compose alongside Docker.
    echo.
    pause
    exit /b 1
)

:: 3. Setup .env file if it doesn't exist
if not exist .env (
    echo [INFO] No .env file found. Creating one from .env.example...
    copy .env.example .env >nul
    echo [INFO] You might want to edit the .env file later to add your API keys.
    echo.
)

:: 4. Build and start the containers
echo [INFO] Building and starting the AI Job Assistant containers...
echo This might take a few minutes the first time.
echo.
docker-compose up -d --build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start Docker containers. Check the errors above.
    pause
    exit /b 1
)

:: 5. Success and wait state
echo.
echo ==========================================
echo    SUCCESS! AI Job Assistant is running.
echo ==========================================
echo.
echo Give the services a few moments to fully start, then:
echo - Access the App UI at: http://localhost:5173
echo - Access the API at:   http://localhost:8000
echo.
echo To shut down the application later, run:
echo docker-compose down
echo.

:: 6. Launch the frontend automatically
echo Launching your browser...
timeout /t 5 /nobreak >nul
start http://localhost:5173

pause
