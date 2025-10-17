@echo off
echo Tapi Uninstaller
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This uninstaller must be run as Administrator.
    echo Right-click on this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

REM Run PowerShell uninstaller
PowerShell -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1" -Uninstall

echo.
pause
