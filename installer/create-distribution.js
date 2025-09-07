#!/usr/bin/env node

/**
 * Create a distribution package for alpha testing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

async function createDistribution() {
  console.log('Creating pawnctl distribution package...');

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
    const winDir = path.join(distDir, 'pawnctl-dev-build-windows');
    fs.mkdirSync(winDir, { recursive: true });

    // Copy Windows files
    fs.copyFileSync(
      path.join(__dirname, '..', 'binaries', 'pawnctl-win.exe'),
      path.join(winDir, 'pawnctl.exe')
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
    const installInstructions = `PAWNCTL ALPHA INSTALLATION

1. Right-click on "install.bat" and select "Run as administrator"
2. Follow the installation prompts
3. Open a new Command Prompt or PowerShell
4. Run: pawnctl setup
5. Create a project: pawnctl init

To uninstall:
- Right-click on "uninstall.bat" and select "Run as administrator"

For support: https://github.com/itsneufox/pawnctl/issues
`;
    
    fs.writeFileSync(
      path.join(winDir, 'INSTALL.txt'),
      installInstructions
    );

    // Create ZIP file for easy distribution
    console.log('Creating ZIP archive...');
    const zip = new AdmZip();
    zip.addLocalFolder(winDir, 'pawnctl-dev-build-windows');
    zip.writeZip(path.join(distDir, 'pawnctl-dev-build-windows.zip'));

    // Copy standalone binaries for other platforms
    console.log('Copying standalone binaries...');
    fs.copyFileSync(
      path.join(__dirname, '..', 'binaries', 'pawnctl-linux'),
      path.join(distDir, 'pawnctl-dev-build-linux')
    );
    
    fs.copyFileSync(
      path.join(__dirname, '..', 'binaries', 'pawnctl-macos'),
      path.join(distDir, 'pawnctl-dev-build-macos')
    );

    console.log('Distribution created successfully!');
    console.log('Files created:');
    console.log(`  - ${path.relative(__dirname, path.join(distDir, path.basename(winDir) + '.zip'))} (Windows installer package)`);
    console.log(`  - ${path.relative(__dirname, path.join(distDir, path.basename(winDir).replace('-windows', '-linux')))} (Linux standalone binary)`);
    console.log(`  - ${path.relative(__dirname, path.join(distDir, path.basename(winDir).replace('-windows', '-macos')))} (macOS standalone binary)`);
    console.log('');

  } catch (error) {
    console.error('Distribution creation failed:', error.message);
    process.exit(1);
  }
}

createDistribution();
