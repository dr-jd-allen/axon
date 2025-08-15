@echo off
echo ===============================================
echo    AXON Three-Agent Test Suite
echo    Autonomous eXpert Organizational Network
echo ===============================================
echo.

:: Check for .env file
if not exist "backend\.env" (
    echo ERROR: backend\.env file not found!
    echo Please ensure your API keys are configured.
    pause
    exit /b 1
)

:: Let user choose test type
echo Select test type:
echo 1. Simple Test (No Memory System)
echo 2. Full Test (With Memory Integration)
echo 3. Interactive Mode
echo.
set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Running Simple Three-Agent Test...
    echo.
    node test-three-agents-simple.js
) else if "%choice%"=="2" (
    echo.
    echo Running Full Test with Memory System...
    echo.
    :: Start memory server if not running
    tasklist /FI "WINDOWTITLE eq MCP Memory Server" 2>NUL | find /I /N "node.exe">NUL
    if errorlevel 1 (
        echo Starting MCP Memory Server...
        start "MCP Memory Server" /min cmd /c "node backend\mcp-memory-server.js"
        timeout /t 3 >nul
    )
    echo.
    node test-three-agents.js
) else if "%choice%"=="3" (
    echo.
    echo Starting Interactive AXON Session...
    echo.
    node autonomous-launcher.js --interactive
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

echo.
echo ===============================================
echo Test completed. Check the output above.
echo.
pause