@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

title Civilization Focus Launcher

where node >nul 2>nul
if errorlevel 1 (
  echo [Civilization Focus] Node.js 20.19+ is required.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

set NEED_INSTALL=
if not exist "node_modules\vite\bin\vite.js" set NEED_INSTALL=1
if not exist "node_modules\three\package.json" set NEED_INSTALL=1
if defined NEED_INSTALL (
  echo [Civilization Focus] Installing dependencies...
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo [Civilization Focus] Dependency install failed. Check your network.
    pause
    exit /b 1
  )
)

echo [Civilization Focus] Building and starting local preview...
call npm start
if errorlevel 1 (
  echo [Civilization Focus] Start failed. If port 4173 is busy, close the old preview window and retry.
  pause
)