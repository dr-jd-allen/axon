# AXON Desktop Shortcuts Creation Script
# Creates proper desktop shortcuts for AXON system and verification tools

Write-Host "Creating AXON Desktop Shortcuts..." -ForegroundColor Cyan

# Get desktop path
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$AXONPath = $PSScriptRoot

Write-Host "Desktop Path: $DesktopPath" -ForegroundColor Yellow
Write-Host "AXON Path: $AXONPath" -ForegroundColor Yellow

# Remove any existing AXON shortcuts to avoid conflicts
Write-Host "Cleaning up existing shortcuts..." -ForegroundColor Yellow
$ExistingShortcuts = @(
    "AXON*.lnk",
    "axon*.lnk", 
    "Launch*.lnk",
    "*LEXICON*.lnk"
)

foreach ($Pattern in $ExistingShortcuts) {
    $Files = Get-ChildItem -Path $DesktopPath -Name $Pattern -ErrorAction SilentlyContinue
    foreach ($File in $Files) {
        $FilePath = Join-Path $DesktopPath $File
        Write-Host "  Removing old shortcut: $File" -ForegroundColor Red
        Remove-Item $FilePath -Force -ErrorAction SilentlyContinue
    }
}

# Create WScript Shell object for creating shortcuts
$WshShell = New-Object -comObject WScript.Shell

# 1. Main AXON System Shortcut
Write-Host "Creating main AXON system shortcut..." -ForegroundColor Green
$AXONShortcut = $WshShell.CreateShortcut("$DesktopPath\AXON System.lnk")
$AXONShortcut.TargetPath = "$AXONPath\AXON-Desktop.bat"
$AXONShortcut.WorkingDirectory = $AXONPath
$AXONShortcut.Description = "AXON - Autonomous Expert Organizational Network"
$AXONShortcut.IconLocation = "$AXONPath\axon.ico,0"
$AXONShortcut.WindowStyle = 1
$AXONShortcut.Save()
Write-Host "  Created: AXON System.lnk" -ForegroundColor Green

# 2. AXON Setup Verification Shortcut
Write-Host "Creating AXON verification shortcut..." -ForegroundColor Green
$VerifyShortcut = $WshShell.CreateShortcut("$DesktopPath\AXON Setup Check.lnk")
$VerifyShortcut.TargetPath = "cmd.exe"
$VerifyArgs = '/c "cd /d "' + $AXONPath + '" && node verify-setup.js && pause"'
$VerifyShortcut.Arguments = $VerifyArgs
$VerifyShortcut.WorkingDirectory = $AXONPath
$VerifyShortcut.Description = "AXON Setup Verification and Troubleshooting"
$VerifyShortcut.IconLocation = "$AXONPath\axon.ico,0"
$VerifyShortcut.WindowStyle = 1
$VerifyShortcut.Save()
Write-Host "  Created: AXON Setup Check.lnk" -ForegroundColor Green

# 2b. AXON API Key Test Shortcut
Write-Host "Creating AXON API key test shortcut..." -ForegroundColor Green
$APITestShortcut = $WshShell.CreateShortcut("$DesktopPath\AXON API Test.lnk")
$APITestShortcut.TargetPath = "cmd.exe"
$APITestArgs = '/c "cd /d "' + $AXONPath + '" && node test-api-keys.js && pause"'
$APITestShortcut.Arguments = $APITestArgs
$APITestShortcut.WorkingDirectory = $AXONPath
$APITestShortcut.Description = "Test AXON API Keys"
$APITestShortcut.IconLocation = "$AXONPath\axon.ico,0"
$APITestShortcut.WindowStyle = 1
$APITestShortcut.Save()
Write-Host "  Created: AXON API Test.lnk" -ForegroundColor Green

# 3. AXON System Test Shortcut
Write-Host "Creating AXON system test shortcut..." -ForegroundColor Green
$TestShortcut = $WshShell.CreateShortcut("$DesktopPath\AXON System Test.lnk")
$TestShortcut.TargetPath = "cmd.exe"
$TestArgs = '/c "cd /d "' + $AXONPath + '" && node test-axon-system.js && pause"'
$TestShortcut.Arguments = $TestArgs
$TestShortcut.WorkingDirectory = $AXONPath
$TestShortcut.Description = "AXON System Integration Tests"
$TestShortcut.IconLocation = "$AXONPath\axon.ico,0"
$TestShortcut.WindowStyle = 1
$TestShortcut.Save()
Write-Host "  Created: AXON System Test.lnk" -ForegroundColor Green

# 4. Create a quick cleanup shortcut
Write-Host "Creating AXON cleanup shortcut..." -ForegroundColor Green
$CleanupShortcut = $WshShell.CreateShortcut("$DesktopPath\AXON Cleanup.lnk")
$CleanupShortcut.TargetPath = "$AXONPath\cleanup-axon.bat"
$CleanupShortcut.WorkingDirectory = $AXONPath
$CleanupShortcut.Description = "AXON Process Cleanup Utility"
$CleanupShortcut.IconLocation = "$AXONPath\axon.ico,0"
$CleanupShortcut.WindowStyle = 1
$CleanupShortcut.Save()
Write-Host "  Created: AXON Cleanup.lnk" -ForegroundColor Green

$Separator = "=" * 60
Write-Host $Separator -ForegroundColor Cyan
Write-Host "DESKTOP SHORTCUTS CREATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host $Separator -ForegroundColor Cyan
Write-Host ""
Write-Host "Desktop shortcuts created:" -ForegroundColor White
Write-Host "  * AXON System.lnk         - Main application launcher" -ForegroundColor Green
Write-Host "  * AXON Setup Check.lnk    - Verify configuration" -ForegroundColor Yellow
Write-Host "  * AXON API Test.lnk       - Test API keys" -ForegroundColor Cyan
Write-Host "  * AXON System Test.lnk    - Run system tests" -ForegroundColor Blue
Write-Host "  * AXON Cleanup.lnk        - Clean up processes" -ForegroundColor Red
Write-Host ""
Write-Host "Usage Instructions:" -ForegroundColor White
Write-Host "1. Double-click 'AXON System' to launch the application" -ForegroundColor Green
Write-Host "2. Use 'AXON API Test' to check your API keys first" -ForegroundColor Cyan
Write-Host "3. Use 'AXON Setup Check' if you encounter issues" -ForegroundColor Yellow
Write-Host "4. Run 'AXON System Test' to verify all components" -ForegroundColor Blue
Write-Host "5. Use 'AXON Cleanup' if the system gets stuck" -ForegroundColor Red
Write-Host ""
Write-Host "AXON is ready to use!" -ForegroundColor Green
Write-Host $Separator -ForegroundColor Cyan