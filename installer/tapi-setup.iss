; Inno Setup script for tapi
; Requires Inno Setup 6.0+ to compile

#define MyAppName "tapi"
#define MyAppVersion "1.0.0-alpha.1"
#define MyAppPublisher "itsneufox"
#define MyAppURL "https://github.com/itsneufox/tapi"
#define MyAppExeName "tapi.exe"

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
OutputBaseFilename=tapi-setup-{#MyAppVersion}
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
Name: "contextmenu"; Description: "Add 'Open tapi here' to folder context menu"; GroupDescription: "Integration:"; Flags: checkedonce

[Files]
Source: "..\binaries\tapi-win.exe"; DestDir: "{app}"; DestName: "tapi.exe"; Flags: ignoreversion
Source: "..\dist\templates\*"; DestDir: "{app}\templates"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\templates"

[Icons]
Name: "{autoprograms}\{#MyAppName}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Registry]
; Add to system PATH (all users - requires admin)
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Tasks: addtopath; Check: NeedsAddPath('{app}')

; Folder Context Menu Integration (System-wide - requires admin)
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\shell\tapi"; ValueType: string; ValueName: ""; ValueData: "Open tapi here"; Tasks: contextmenu; Flags: createvalueifdoesntexist
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\shell\tapi"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\tapi.exe,0"; Tasks: contextmenu; Flags: createvalueifdoesntexist  
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\shell\tapi\command"; ValueType: string; ValueName: ""; ValueData: "cmd.exe /k ""cd /d ""%1"" && ""{app}\tapi.exe"""""; Tasks: contextmenu; Flags: createvalueifdoesntexist

; Directory Background Context Menu (right-click in empty space - System-wide)
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\Background\shell\tapi"; ValueType: string; ValueName: ""; ValueData: "Open tapi here"; Tasks: contextmenu; Flags: createvalueifdoesntexist
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\Background\shell\tapi"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\tapi.exe,0"; Tasks: contextmenu; Flags: createvalueifdoesntexist  
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\Background\shell\tapi\command"; ValueType: string; ValueName: ""; ValueData: "cmd.exe /k ""cd /d ""%V"" && ""{app}\tapi.exe"""""; Tasks: contextmenu; Flags: createvalueifdoesntexist

[Run]

[UninstallRun]
; Run custom uninstaller to clean user data (only if user chose to)
Filename: "{app}\{#MyAppExeName}"; Parameters: "uninstall --force"; StatusMsg: "Cleaning user data..."; Flags: runhidden waituntilterminated; RunOnceId: "CleanUserData"; Check: ShouldRemoveUserData

[UninstallDelete]
Type: filesandordirs; Name: "{%USERPROFILE}\.tapi"; Check: ShouldRemoveUserData

[UninstallRun]
; Clean up system PATH entries
Filename: "powershell.exe"; Parameters: "-Command ""$systemPath = [Environment]::GetEnvironmentVariable('Path', 'Machine'); $cleanPath = ($systemPath -split ';' | Where-Object {{ $_ -ne '{{app}}' }}) -join ';'; [Environment]::SetEnvironmentVariable('Path', $cleanPath, 'Machine')"""; Flags: runhidden waituntilterminated; RunOnceId: "CleanSystemPath"

[UninstallRegistry]
; Remove context menu entries  
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\shell\tapi"
Root: HKLM; Subkey: "SOFTWARE\Classes\Directory\Background\shell\tapi"

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
      'tapi has been installed successfully!' + #13#10 + #13#10 +
      'You can now use "tapi" command from any terminal.' + #13#10 + #13#10 +
      'To get started:' + #13#10 +
      '1. Open Command Prompt or PowerShell' + #13#10 +
      '2. Run: tapi setup' + #13#10 +
      '3. Create a project: tapi init' + #13#10 + #13#10 +
      'Documentation: https://github.com/itsneufox/tapi';
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  if MsgBox('This will remove tapi from your system.' + #13#10 + #13#10 +
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
