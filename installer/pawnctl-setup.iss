; Inno Setup script for pawnctl
; Requires Inno Setup 6.0+ to compile

#define MyAppName "pawnctl"
#ifndef MyAppVersion
  #define MyAppVersion "1.0.0-alpha.1"
#endif
#ifndef MyAppVersionInfo
  #define MyAppVersionInfo "1.0.0.1"
#endif
#define MyAppPublisher "itsneufox"
#define MyAppURL "https://github.com/itsneufox/pawnctl"
#define MyAppExeName "pawnctl.exe"

[Setup]
; Basic app info
AppId={{8B5E5A2F-4F3A-4E2B-9C1D-7A8F9E0B2C3D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases

; Installation settings
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir=..\dist-installer
OutputBaseFilename=pawnctl-setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern

; Requirements
MinVersion=10.0
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; Privileges (will be determined by user choice)
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "addtopath"; Description: "Add {#MyAppName} to PATH environment variable"; GroupDescription: "Integration:"; Flags: checkedonce
Name: "contextmenu"; Description: "Add 'Open pawnctl here' to folder context menu"; GroupDescription: "Integration:"; Flags: checkedonce

[Files]
Source: "..\binaries\pawnctl-win.exe"; DestDir: "{app}"; DestName: "pawnctl.exe"; Flags: ignoreversion
Source: "..\dist\templates\*"; DestDir: "{app}\templates"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\templates"

[Icons]
Name: "{autoprograms}\{#MyAppName}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Registry]
; Add to system PATH (all users - requires admin)
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Check: NeedsAddPath('{app}')

; Folder Context Menu Integration (System-wide - requires admin)
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\shell\pawnctl"; ValueType: string; ValueName: ""; ValueData: "Open pawnctl here"; Flags: createvalueifdoesntexist
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\shell\pawnctl"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\pawnctl.exe,0"; Flags: createvalueifdoesntexist  
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\shell\pawnctl\command"; ValueType: string; ValueName: ""; ValueData: "cmd.exe /k ""cd /d ""%1"" && pawnctl"""; Flags: createvalueifdoesntexist

; Directory Background Context Menu (right-click in empty space - System-wide)
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\Background\shell\pawnctl"; ValueType: string; ValueName: ""; ValueData: "Open pawnctl here"; Flags: createvalueifdoesntexist
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\Background\shell\pawnctl"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\pawnctl.exe,0"; Flags: createvalueifdoesntexist  
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\Background\shell\pawnctl\command"; ValueType: string; ValueName: ""; ValueData: "cmd.exe /k ""cd /d ""%V"" && pawnctl"""; Flags: createvalueifdoesntexist

[Run]

[UninstallRun]
; Run custom uninstaller to clean user data (only if user chose to)
Filename: "{app}\{#MyAppExeName}"; Parameters: "uninstall --force"; StatusMsg: "Cleaning user data..."; Flags: runhidden waituntilterminated; RunOnceId: "CleanUserData"; Check: ShouldRemoveUserData

[UninstallDelete]
Type: filesandordirs; Name: "{%USERPROFILE}\.pawnctl"; Check: ShouldRemoveUserData

[UninstallRun]
; Clean up system PATH entries
Filename: "powershell.exe"; Parameters: "-Command ""$systemPath = [Environment]::GetEnvironmentVariable('Path', 'Machine'); $cleanPath = ($systemPath -split ';' | Where-Object {{ $_ -ne '{{app}}' }}) -join ';'; [Environment]::SetEnvironmentVariable('Path', $cleanPath, 'Machine')"""; Flags: runhidden waituntilterminated; RunOnceId: "CleanSystemPath"

[UninstallRegistry]
; Remove context menu entries  
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\shell\pawnctl"
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\Background\shell\pawnctl"

[Code]
var
  RemoveUserData: Boolean;


// Check if system PATH modification is needed (all users)
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_LOCAL_MACHINE,
    'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
    'Path', OrigPath)
  then begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;


function ShouldRemoveUserData(): Boolean;
begin
  Result := RemoveUserData;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    WizardForm.FinishedLabel.Caption := 
      'pawnctl has been installed successfully!' + #13#10 + #13#10 +
      'You can now use "pawnctl" command from any terminal.' + #13#10 + #13#10 +
      'To get started:' + #13#10 +
      '1. Open Command Prompt or PowerShell' + #13#10 +
      '2. Run: pawnctl setup' + #13#10 +
      '3. Create a project: pawnctl init' + #13#10 + #13#10 +
      'Documentation: https://github.com/itsneufox/pawnctl';
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  if MsgBox('This will remove pawnctl from your system.' + #13#10 + #13#10 +
            'Continue with uninstall?', 
            mbConfirmation, MB_YESNO) = IDNO then
    Result := False
  else begin
    // Ask about user data separately
    RemoveUserData := MsgBox('Do you also want to remove user data?' + #13#10 + #13#10 +
                            'This includes:' + #13#10 +
                            '• Configuration files' + #13#10 +
                            '• Log files' + #13#10 +
                            '• Cache data' + #13#10 + #13#10 +
                            'Select "Yes" to remove all data, or "No" to keep it for future use.', 
                            mbConfirmation, MB_YESNO) = IDYES;
  end;
end;
