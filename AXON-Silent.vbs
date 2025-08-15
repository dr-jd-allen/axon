' AXON Silent Launcher - Spinwheel v2 Edition
' Launches AXON without showing console window

Dim objShell, objFSO, strPath, strNodePath

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get current directory
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Check if Node.js is installed
On Error Resume Next
strNodePath = objShell.RegRead("HKLM\SOFTWARE\Node.js\InstallPath")
On Error GoTo 0

If strNodePath = "" Then
    ' Try to find node in PATH
    Dim objExec
    Set objExec = objShell.Exec("cmd /c where node")
    If objExec.Status = 0 Then
        Do While objExec.Status = 0
            WScript.Sleep 100
        Loop
        If objExec.ExitCode <> 0 Then
            MsgBox "Node.js is not installed!" & vbCrLf & vbCrLf & _
                   "Please install Node.js from https://nodejs.org/", _
                   vbCritical, "AXON - Spinwheel v2"
            WScript.Quit 1
        End If
    End If
End If

' Check if .env exists
If Not objFSO.FileExists(strPath & "\backend\.env") Then
    If objFSO.FileExists(strPath & "\backend\.env.example") Then
        objFSO.CopyFile strPath & "\backend\.env.example", strPath & "\backend\.env"
        
        MsgBox "First time setup detected!" & vbCrLf & vbCrLf & _
               "Please edit backend\.env and add your API keys:" & vbCrLf & _
               "- ANTHROPIC_API_KEY" & vbCrLf & _
               "- OPENAI_API_KEY" & vbCrLf & _
               "- GOOGLE_API_KEY" & vbCrLf & vbCrLf & _
               "The file will now open for editing.", _
               vbInformation, "AXON Setup - Spinwheel v2"
        
        objShell.Run "notepad """ & strPath & "\backend\.env""", 1, True
    End If
End If

' Show launch notification
Dim objNotify
Set objNotify = objShell.Popup("Starting AXON Ultimate System..." & vbCrLf & _
                                "Spinwheel v2 Edition" & vbCrLf & vbCrLf & _
                                "The system will launch in your browser shortly.", _
                                3, "AXON Launcher", vbInformation)

' Launch AXON silently
objShell.CurrentDirectory = strPath
objShell.Run "cmd /c node axon-ultimate-launcher.js", 0, False

' Clean up
Set objShell = Nothing
Set objFSO = Nothing