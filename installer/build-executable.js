#!/usr/bin/env node

/**
 * Build script to create a standalone executable using pkg
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildExecutable() {
  console.log('Building pawnctl executable...');

  try {
    // Get version from CI environment or fallback to package.json
    let version = process.env.PAWNCTL_VERSION;
    if (!version) {
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      version = packageJson.version;
    }
    console.log(`Building version: ${version}`);

    // Ensure dist is built
    console.log('Building TypeScript...');
    execSync('npm run build', { stdio: 'inherit' });

    // Replace version placeholder in built files
    console.log(`Injecting version ${version} into built files...`);
    const versionFilePath = path.join(__dirname, '..', 'dist', 'utils', 'version.js');
    if (fs.existsSync(versionFilePath)) {
      let versionFileContent = fs.readFileSync(versionFilePath, 'utf8');
      versionFileContent = versionFileContent.replace('__BUILD_VERSION__', version);
      fs.writeFileSync(versionFilePath, versionFileContent);
      console.log('✓ Version injected into version.js');
    }

    // Create binaries directory
    const binDir = path.join(__dirname, '..', 'binaries');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // Build for Windows x64 (using Node 18 which is supported by pkg)
    console.log('Building Windows executable...');
    execSync(`npx pkg dist/index.js --target node18-win-x64 --output binaries/pawnctl-win.exe`, { 
      stdio: 'inherit'
    });

    // Build for Linux x64  
    console.log('Building Linux executable...');
    execSync(`npx pkg dist/index.js --target node18-linux-x64 --output binaries/pawnctl-linux`, { 
      stdio: 'inherit'
    });

    // Build for macOS x64
    console.log('Building macOS executable...');
    execSync(`npx pkg dist/index.js --target node18-macos-x64 --output binaries/pawnctl-macos`, { 
      stdio: 'inherit'
    });

    console.log('Executables built successfully');
    console.log('Files created:');
    console.log('  - binaries/pawnctl-win.exe');
    console.log('  - binaries/pawnctl-linux');
    console.log('  - binaries/pawnctl-macos');

  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

buildExecutable();
