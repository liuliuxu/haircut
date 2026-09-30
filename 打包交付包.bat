@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Build JianYue Package

echo ============================================================
echo   JianYue - Build delivery package
echo   Project: %cd%
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 20 LTS from https://nodejs.org first.
  pause
  exit /b 1
)

node scripts\build-package.mjs
if errorlevel 1 (
  echo.
  echo [ERROR] Packaging failed.
  pause
  exit /b 1
)

echo.
pause
