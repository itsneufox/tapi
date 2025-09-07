#!/usr/bin/env node

/**
 * Script to update version across all files from package.json
 */

const fs = require('fs');
const path = require('path');

function updateVersion() {
  // Get version from CI environment or package.json
  let version = process.env.PAWNCTL_VERSION;
  const isFromCI = !!version;
  
  if (!version) {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    version = packageJson.version;
  }
  
  console.log(`Updating version to: ${version}${isFromCI ? ' (from CI)' : ' (from package.json)'}`);
  
  // Update installer script
  const installerPath = path.join(__dirname, '..', 'installer', 'pawnctl-setup.iss');
  let installerContent = fs.readFileSync(installerPath, 'utf8');
  installerContent = installerContent.replace(
    /#define MyAppVersion ".*"/,
    `#define MyAppVersion "${version}"`
  );
  fs.writeFileSync(installerPath, installerContent);
  console.log('✓ Updated installer/pawnctl-setup.iss');
  
  // Update installer PowerShell script
  const psPath = path.join(__dirname, '..', 'installer', 'install-windows.ps1');
  if (fs.existsSync(psPath)) {
    let psContent = fs.readFileSync(psPath, 'utf8');
    psContent = psContent.replace(
      /\$Version = ".*"/,
      `$Version = "${version}"`
    );
    fs.writeFileSync(psPath, psContent);
    console.log('✓ Updated installer/install-windows.ps1');
  }
  
  // Update distribution script
  const distPath = path.join(__dirname, '..', 'installer', 'create-distribution.js');
  if (fs.existsSync(distPath)) {
    let distContent = fs.readFileSync(distPath, 'utf8');
    // Replace specific distribution patterns precisely
    distContent = distContent.replace(
      /const winDir = path\.join\(distDir, 'pawnctl-[^']+'\)/g,
      `const winDir = path.join(distDir, 'pawnctl-${version}-windows')`
    );
    distContent = distContent.replace(
      /zip\.addLocalFolder\(winDir, 'pawnctl-[^']+'\)/g,
      `zip.addLocalFolder(winDir, 'pawnctl-${version}-windows')`
    );
    distContent = distContent.replace(
      /zip\.writeZip\(path\.join\(distDir, 'pawnctl-[^']+'\)\)/g,
      `zip.writeZip(path.join(distDir, 'pawnctl-${version}-windows.zip'))`
    );
    
    // Handle Linux binary destination
    distContent = distContent.replace(
      /path\.join\(distDir, 'pawnctl-[^']*-linux'\)/g,
      `path.join(distDir, 'pawnctl-${version}-linux')`
    );
    
    // Handle macOS binary destination  
    distContent = distContent.replace(
      /path\.join\(distDir, 'pawnctl-[^']*-macos'\)/g,
      `path.join(distDir, 'pawnctl-${version}-macos')`
    );
    
    // Console.log messages now dynamically read from folder names, no need to update them
    fs.writeFileSync(distPath, distContent);
    console.log('✓ Updated installer/create-distribution.js');
  }
  
  console.log(`All version references updated to: ${version}`);
}

if (require.main === module) {
  updateVersion();
}

module.exports = { updateVersion };
