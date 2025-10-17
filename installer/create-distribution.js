#!/usr/bin/env node

/**
 * Create a distribution package for alpha testing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

async function createDistribution() {
  console.log('Creating tapi distribution package...');

  try {
    // Ensure executables are built
    console.log('Building executables...');
    execSync('npm run build:executable', { stdio: 'inherit' });

    // Create distribution directory
    const distDir = path.join(__dirname, '..', 'dist-alpha');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // Create Windows package
    console.log('Creating Windows distribution...');
    const winDir = path.join(distDir, 'tapi-windows');
    fs.mkdirSync(winDir, { recursive: true });

    // Copy Windows files
    fs.copyFileSync(
      path.join(__dirname, '..', 'binaries', 'tapi-win.exe'),
      path.join(winDir, 'tapi.exe')
    );
    
    fs.copyFileSync(
      path.join(__dirname, 'install.bat'),
      path.join(winDir, 'install.bat')
    );
    
    fs.copyFileSync(
      path.join(__dirname, 'uninstall.bat'),
      path.join(winDir, 'uninstall.bat')
    );
    
    fs.copyFileSync(
      path.join(__dirname, 'install-windows.ps1'),
      path.join(winDir, 'install-windows.ps1')
    );

    // Copy templates
    const templatesSource = path.join(__dirname, '..', 'dist', 'templates');
    const templatesTarget = path.join(winDir, 'templates');
    if (fs.existsSync(templatesSource)) {
      fs.cpSync(templatesSource, templatesTarget, { recursive: true });
    }

    // Copy documentation
    fs.copyFileSync(
      path.join(__dirname, '..', 'README.md'),
      path.join(winDir, 'README.md')
    );
    
    fs.copyFileSync(
      path.join(__dirname, '..', 'LICENSE'),
      path.join(winDir, 'LICENSE')
    );

    // Create installation instructions
    const installInstructions = `TAPI ALPHA INSTALLATION

1. Right-click on "install.bat" and select "Run as administrator"
2. Follow the installation prompts
3. Open a new Command Prompt or PowerShell
4. Run: tapi setup
5. Create a project: tapi init

To uninstall:
- Right-click on "uninstall.bat" and select "Run as administrator"

For support: https://github.com/itsneufox/tapi/issues
`;
    
    fs.writeFileSync(
      path.join(winDir, 'INSTALL.txt'),
      installInstructions
    );

    // Create ZIP file for easy distribution
    console.log('Creating ZIP archive...');
    const zip = new AdmZip();
    zip.addLocalFolder(winDir, 'tapi-1.0.0-alpha.1');
    zip.writeZip(path.join(distDir, 'tapi-1.0.0-alpha.1-windows.zip'));

    // Copy standalone binaries for other platforms
    console.log('Copying standalone binaries...');
    fs.copyFileSync(
      path.join(__dirname, '..', 'binaries', 'tapi-linux'),
      path.join(distDir, 'tapi-linux')
    );
    
    fs.copyFileSync(
      path.join(__dirname, '..', 'binaries', 'tapi-macos'),
      path.join(distDir, 'tapi-macos')
    );

    console.log('Distribution created successfully!');
    console.log('Files created:');
    console.log('  - dist-alpha/tapi-1.0.0-alpha.1-windows.zip (Windows installer package)');
    console.log('  - dist-alpha/tapi-linux (Linux standalone binary)');
    console.log('  - dist-alpha/tapi-macos (macOS standalone binary)');
    console.log('');
    console.log('For Windows alpha testing:');
    console.log('  Send the ZIP file to testers');
    console.log('  They extract it and run install.bat as administrator');

  } catch (error) {
    console.error('Distribution creation failed:', error.message);
    process.exit(1);
  }
}

createDistribution();
