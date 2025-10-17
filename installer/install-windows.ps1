# PowerShell installer for tapi
# Run as Administrator

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# Configuration
$AppName = "tapi"
$Version = "1.0.0-alpha.1"
$InstallDir = "$env:ProgramFiles\$AppName"
$UserDataDir = "$env:USERPROFILE\.tapi"

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Add-ToPath {
    param([string]$PathToAdd)
    
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$PathToAdd*") {
        $newPath = "$currentPath;$PathToAdd"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
        Write-Host "Added $PathToAdd to system PATH"
    }
}

function Remove-FromPath {
    param([string]$PathToRemove)
    
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -like "*$PathToRemove*") {
        $newPath = $currentPath -replace [regex]::Escape(";$PathToRemove"), ""
        $newPath = $newPath -replace [regex]::Escape("$PathToRemove;"), ""
        $newPath = $newPath -replace [regex]::Escape("$PathToRemove"), ""
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
        Write-Host "Removed $PathToRemove from system PATH"
    }
}

function Install-Tapi {
    Write-Host "Installing $AppName $Version..." -ForegroundColor Green
    
    # Check for existing installation
    if (Test-Path $InstallDir) {
        Write-Host "Existing installation found. Removing..." -ForegroundColor Yellow
        Remove-Item $InstallDir -Recurse -Force
    }
    
    # Create installation directory
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    
    # Copy executable
    $sourceExe = Join-Path $PSScriptRoot "..\binaries\tapi-win.exe"
    if (-not (Test-Path $sourceExe)) {
        throw "tapi-win.exe not found. Run 'npm run build:executable' first."
    }
    Copy-Item $sourceExe "$InstallDir\tapi.exe"
    
    # Copy templates
    $sourceTemplates = Join-Path $PSScriptRoot "..\dist\templates"
    if (Test-Path $sourceTemplates) {
        Copy-Item $sourceTemplates "$InstallDir\templates" -Recurse
    }
    
    # Add to PATH
    Add-ToPath $InstallDir
    
    # Create start menu shortcut
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut("$env:ProgramData\Microsoft\Windows\Start Menu\Programs\$AppName.lnk")
    $shortcut.TargetPath = "$InstallDir\tapi.exe"
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Description = "PAWN package manager and build tool"
    $shortcut.Save()
    
    Write-Host "Installation completed successfully!" -ForegroundColor Green
    Write-Host "You can now use 'tapi' command from any terminal." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To get started:" -ForegroundColor White
    Write-Host "  1. Open a new Command Prompt or PowerShell" -ForegroundColor Gray
    Write-Host "  2. Run: tapi setup" -ForegroundColor Gray
    Write-Host "  3. Create a project: tapi init" -ForegroundColor Gray
}

function Uninstall-Tapi {
    Write-Host "Uninstalling $AppName..." -ForegroundColor Yellow
    
    # Ask for confirmation
    $confirm = Read-Host "This will remove tapi and all user data. Continue? (y/N)"
    if ($confirm -notmatch '^[Yy]$') {
        Write-Host "Uninstall cancelled." -ForegroundColor Gray
        return
    }
    
    # Remove from PATH
    Remove-FromPath $InstallDir
    
    # Remove installation directory
    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force
        Write-Host "Removed program files"
    }
    
    # Remove user data
    if (Test-Path $UserDataDir) {
        Remove-Item $UserDataDir -Recurse -Force
        Write-Host "Removed user data directory: $UserDataDir"
    }
    
    # Remove start menu shortcut
    $shortcutPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\$AppName.lnk"
    if (Test-Path $shortcutPath) {
        Remove-Item $shortcutPath -Force
        Write-Host "Removed start menu shortcut"
    }
    
    Write-Host "Uninstall completed!" -ForegroundColor Green
}

# Main execution
try {
    if (-not (Test-Administrator)) {
        throw "This script must be run as Administrator. Right-click and select 'Run as Administrator'."
    }
    
    if ($Uninstall) {
        Uninstall-Tapi
    } else {
        Install-Tapi
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
