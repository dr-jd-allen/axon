@echo off
echo Stopping any running AXON processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting fresh AXON instance...
cd /d "%~dp0"
node axon-launcher-simple.js