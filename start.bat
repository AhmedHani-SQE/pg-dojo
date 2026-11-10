@echo off
title PG Dojo
cd /d "%~dp0"

if not exist "config.json" (
  echo First time here? Run setup first:
  echo    powershell -ExecutionPolicy Bypass -File .\setup.ps1
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\pg" (
  echo Installing dependencies...
  call npm install --silent
)

rem server.js starts PostgreSQL if needed and opens the browser when ready
node server.js --open
pause
