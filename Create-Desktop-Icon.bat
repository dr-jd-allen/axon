@echo off
:: Create AXON Desktop Shortcut

echo Creating AXON desktop shortcut...

powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%USERPROFILE%\OneDrive\Desktop\AXON.lnk'); $SC.TargetPath = '%CD%\AXON-Desktop.bat'; $SC.WorkingDirectory = '%CD%'; $SC.IconLocation = '%CD%\axon.ico'; $SC.Description = 'AXON Ultimate - Spinwheel v2'; $SC.Save()"

if exist "%USERPROFILE%\OneDrive\Desktop\AXON.lnk" (
    echo SUCCESS! Desktop shortcut created
) else (
    echo Failed to create shortcut
)

pause