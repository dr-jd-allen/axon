@echo off
echo Creating AXON Desktop Shortcuts...
powershell -ExecutionPolicy Bypass -File "%~dp0Create-Desktop-Shortcuts.ps1"
echo.
echo Desktop shortcuts have been created!
pause