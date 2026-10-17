#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif

#define MyAppName "QuickPOS"
#define MyAppPublisher "QuickPOS"
#define MyAppId "{{6D2B1D2F-CA6B-4BDE-97D1-FBDB8BE50341}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
Compression=lzma2/max
DefaultDirName={localappdata}\Programs\QuickPOS
DefaultGroupName=QuickPOS
DisableProgramGroupPage=yes
OutputBaseFilename=QuickPOS-Setup
OutputDir=..\dist\windows\installer
PrivilegesRequired=lowest
RestartApplications=no
SetupLogging=yes
SetupIconFile=assets\quickpos.ico
SolidCompression=yes
UninstallDisplayIcon={app}\assets\quickpos.ico
UninstallDisplayName={#MyAppName}
UsePreviousAppDir=yes
UsePreviousGroup=yes
WizardStyle=modern

[Files]
Source: "..\dist\windows\release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\QuickPOS"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\start.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\quickpos.ico"
Name: "{group}\Stop QuickPOS"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\stop.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\quickpos.ico"
Name: "{userdesktop}\QuickPOS"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\start.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\quickpos.ico"

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\start.vbs"""; Description: "Open QuickPOS"; Flags: nowait postinstall skipifsilent

[Code]
function StopInstalledQuickPOS(): Boolean;
var
  ResultCode: Integer;
  StopScript: String;
begin
  Result := True;
  StopScript := ExpandConstant('{app}\launcher\stop.vbs');

  if FileExists(StopScript) then
  begin
    Log('Stopping the installed QuickPOS instance.');
    if not Exec(
      ExpandConstant('{sys}\wscript.exe'),
      '"' + StopScript + '"',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    ) then
    begin
      Log('Could not execute the QuickPOS shutdown command.');
      Result := False;
    end
    else if ResultCode <> 0 then
    begin
      Log(Format('QuickPOS shutdown returned exit code %d.', [ResultCode]));
      Result := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  if StopInstalledQuickPOS() then
    Result := ''
  else
    Result := 'QuickPOS is still running. Use the Stop QuickPOS shortcut, then run Setup again.';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    StopInstalledQuickPOS();
end;
