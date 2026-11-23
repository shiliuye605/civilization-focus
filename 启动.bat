@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title TerraTock Launcher

where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit((major===20&&minor>=19)||(major===22&&minor>=12)||major>22?0:1)"
if errorlevel 1 goto missing_node

if not exist "node_modules\vite\bin\vite.js" goto install
if not exist "node_modules\three\package.json" goto install
goto build

:install
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_npm
echo [TerraTock] Installing application dependencies...
call npm.cmd ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto failed

:build
echo [TerraTock] Building the latest project...
node "node_modules\vite\bin\vite.js" build
if errorlevel 1 goto failed
echo.
echo [TerraTock] Opening the app in your browser.
echo [TerraTock] If port 4173 is busy, a free port will be selected automatically.
echo [TerraTock] Keep this window open while using the app.
node "node_modules\vite\bin\vite.js" preview --host localhost --port 4173 --open
if errorlevel 1 goto failed
exit /b 0

:missing_node
echo [TerraTock] Please install Node.js 22.12+ or a newer LTS version, then try again.
goto failed

:missing_npm
echo [TerraTock] npm.cmd was not found. Please repair your Node.js installation.

:failed
echo.
echo [TerraTock] Startup failed. Check the error above.
pause
exit /b 1
