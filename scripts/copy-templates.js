const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${srcPath} -> ${destPath}`);
    }
  }
}

const templatesDir = path.join(__dirname, '..', 'src', 'templates');
const distTemplatesDir = path.join(__dirname, '..', 'dist', 'templates');

if (fs.existsSync(templatesDir)) {
  console.log('Copying templates directory...');
  copyDir(templatesDir, distTemplatesDir);
  console.log('Templates copied successfully!');
} else {
  console.warn('Templates directory not found!');
}