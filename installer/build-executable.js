#!/usr/bin/env node

/**
 * Build script to create a standalone executable using pkg
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildExecutable() {
  console.log('Building tapi executable...');

  try {
    // Ensure dist is built
    console.log('Building TypeScript...');
    execSync('npm run build', { stdio: 'inherit' });

    // Create binaries directory
    const binDir = path.join(__dirname, '..', 'binaries');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // Build for Windows x64 (using Node 18 which is supported by pkg)
    console.log('Building Windows executable...');
    execSync(`npx pkg dist/index.js --target node18-win-x64 --output binaries/tapi-win.exe`, { 
      stdio: 'inherit' 
    });

    // Build for Linux x64  
    console.log('Building Linux executable...');
    execSync(`npx pkg dist/index.js --target node18-linux-x64 --output binaries/tapi-linux`, { 
      stdio: 'inherit' 
    });

    // Build for macOS x64
    console.log('Building macOS executable...');
    execSync(`npx pkg dist/index.js --target node18-macos-x64 --output binaries/tapi-macos`, { 
      stdio: 'inherit' 
    });

    console.log('Executables built successfully');
    console.log('Files created:');
    console.log('  - binaries/tapi-win.exe');
    console.log('  - binaries/tapi-linux');
    console.log('  - binaries/tapi-macos');

  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

buildExecutable();
