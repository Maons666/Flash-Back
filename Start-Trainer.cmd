@echo off
cd /d "%~dp0"
if exist "release\FlashDodger-v0.10.2\FlashDodger.exe" (
  start "" "release\FlashDodger-v0.10.2\FlashDodger.exe"
  exit /b 0
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run from source. Install Node.js 22 or newer.
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd start
pause
