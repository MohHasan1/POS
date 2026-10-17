Option Explicit

Dim appDirectory, command, exitCode, fileSystem, launcherDirectory, logPath, shell

Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

launcherDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
appDirectory = fileSystem.GetParentFolderName(launcherDirectory)
command = Quote(appDirectory & "\runtime\node.exe") & " " & _
  Quote(launcherDirectory & "\quickpos-stop.mjs")
exitCode = shell.Run(command, 0, True)

If exitCode <> 0 Then
  logPath = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\QuickPOS\logs\launcher.log")
  MsgBox "QuickPOS could not be stopped safely." & vbCrLf & vbCrLf & _
    "See " & logPath, vbExclamation, "QuickPOS"
End If

WScript.Quit exitCode

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
