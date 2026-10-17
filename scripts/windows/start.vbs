Option Explicit

Dim appDirectory, command, fileSystem, launcherDirectory, shell

Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

launcherDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
appDirectory = fileSystem.GetParentFolderName(launcherDirectory)
command = Quote(appDirectory & "\runtime\node.exe") & " " & _
  Quote(launcherDirectory & "\quickpos-launcher.mjs")

shell.Run command, 0, False

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
