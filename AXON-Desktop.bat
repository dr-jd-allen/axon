@echo off
:: AXON Desktop Launcher - Ultimate Edition
:: One-click solution with spinwheel v2

title AXON - Autonomous Expert Organizational Network
color 5F

echo.
echo     =========================================================
echo                    A X O N   U L T I M A T E
echo          Autonomous Expert Organizational Network
echo     =========================================================
echo.
echo                         [Spinwheel v2]
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo [INFO] First time setup detected...
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Check for .env file
if not exist "backend\.env" (
    echo [SETUP] Creating environment configuration...
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo.
        echo ====================================================
        echo   IMPORTANT: API Keys Required
        echo ====================================================
        echo.
        echo Please edit backend\.env and add your API keys:
        echo   - ANTHROPIC_API_KEY
        echo   - OPENAI_API_KEY  
        echo   - GOOGLE_API_KEY
        echo.
        echo Opening .env file for editing...
        notepad "backend\.env"
        echo.
        echo Press any key after adding your API keys...
        pause >nul
    )
)

:: Launch AXON Ultimate
echo.
echo [LAUNCH] Starting AXON Ultimate System...
echo.

:: Use the simple launcher (more reliable)
node axon-launcher-simple.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] AXON failed to start
    echo Check the error messages above for details
    pause
    exit /b 1
)

:: Keep window open if needed
pause