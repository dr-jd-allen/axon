@echo off
echo Cleaning up AXON processes...

REM Kill any Node.js processes that might be running AXON
taskkill /f /im node.exe /t 2>nul

REM Wait a moment for processes to close
timeout /t 3 /nobreak >nul

echo AXON processes cleaned up.
echo You can now restart AXON safely.
pause