@echo off
chcp 65001 >nul
title JianYue Barber System
cd /d "%~dp0"

echo ============================================================
echo   Barber Shop Management System
echo   Project folder: %cd%
echo ============================================================
echo.

REM ---- Check Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on this computer.
  echo Please install Node.js 20 LTS ^(64-bit^) from:
  echo     https://nodejs.org
  echo Then double-click this file again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do echo Node.js version: %%v

REM ---- First run: install dependencies (needs internet) ----
if not exist "server\node_modules" (
  echo.
  echo First run detected. Installing dependencies, please wait...
  pushd server
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Check the network and try again.
    popd
    pause
    exit /b 1
  )
  popd
  echo Dependencies installed.
)

REM ---- Open browser 2 seconds after the server starts ----
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:5181'"

echo.
echo Starting server... Browser will open http://localhost:5181
echo Login: admin / admin123
echo To stop the system: close this window.
echo.

cd server
node src/index.js

echo.
echo Server has stopped.
pause
