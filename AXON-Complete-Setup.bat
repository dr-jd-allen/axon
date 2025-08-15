@echo off
:: AXON Complete Setup & Launch
:: Spinwheel v2 Edition

title AXON Complete Setup - Spinwheel v2
color 5F

cls
echo.
echo     ===========================================================
echo                  A X O N   C O M P L E T E   S E T U P
echo     ===========================================================
echo.
echo                            ___________
echo                           /           \
echo                          /   SPINWHEEL \
echo                         (       v2      )
echo                          \   _______   /
echo                           \___________/
echo.
echo     ===========================================================
echo.

:: Check Node.js
echo [1/5] Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo       [!] Node.js not found - Opening download page...
    start https://nodejs.org/
    echo.
    echo       Please install Node.js and run this setup again.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo       [OK] Node.js %%i installed
)

:: Install dependencies
echo.
echo [2/5] Checking dependencies...
if not exist "node_modules" (
    echo       Installing packages...
    call npm install --silent
    if %errorlevel% neq 0 (
        echo       [!] Failed to install dependencies
        pause
        exit /b 1
    )
    echo       [OK] Dependencies installed
) else (
    echo       [OK] Dependencies already installed
)

:: Setup environment
echo.
echo [3/5] Checking environment configuration...
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo       [!] Created .env file - API keys needed
        echo.
        echo     ===========================================================
        echo                        API KEY CONFIGURATION
        echo     ===========================================================
        echo.
        echo     Please add your API keys to backend\.env:
        echo       - ANTHROPIC_API_KEY
        echo       - OPENAI_API_KEY
        echo       - GOOGLE_API_KEY
        echo.
        choice /C YN /M "     Would you like to add API keys now"
        if errorlevel 2 goto skip_env
        if errorlevel 1 (
            start notepad "backend\.env"
            echo.
            echo     Press any key after saving your API keys...
            pause >nul
        )
    )
) else (
    echo       [OK] Environment configured
)
:skip_env

:: Create desktop shortcut
echo.
echo [4/5] Creating desktop shortcut...
powershell -ExecutionPolicy Bypass -File "Create-AXON-Desktop-Icon.ps1" >nul 2>&1
if exist "%USERPROFILE%\Desktop\AXON.lnk" (
    echo       [OK] Desktop shortcut created
) else (
    echo       [!] Could not create desktop shortcut
)

:: Clean up old files
echo.
echo [5/5] Cleaning workspace...
if exist "cleanup-workspace.js" (
    node cleanup-workspace.js >nul 2>&1
    echo       [OK] Workspace organized
) else (
    echo       [OK] Workspace clean
)

:: Launch decision
echo.
echo     ===========================================================
echo                      SETUP COMPLETE!
echo     ===========================================================
echo.
echo                    Welcome to AXON Ultimate
echo                       Spinwheel v2 Edition
echo.
echo     Your system is ready for advanced multi-LLM orchestration
echo     with three-layer memory and real-time health monitoring.
echo.
echo     ===========================================================
echo.

choice /C YN /T 5 /D Y /M "     Launch AXON now"
if errorlevel 2 (
    echo.
    echo     You can launch AXON anytime by:
    echo       - Double-clicking the desktop icon
    echo       - Running AXON-Desktop.bat
    echo       - Running: node axon-ultimate-launcher.js
    echo.
    pause
    exit /b 0
)

:: Launch AXON
echo.
echo     Launching AXON Ultimate System...
echo.
timeout /t 2 /nobreak >nul

node axon-ultimate-launcher.js

if %errorlevel% neq 0 (
    echo.
    echo     [ERROR] Failed to launch AXON
    echo     Please check the error messages above
    pause
    exit /b 1
)

pause