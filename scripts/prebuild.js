const fs = require('fs');
const path = require('path');

const dirs = [
  'dist/templates', 
  'dist/core', 
  'dist/utils', 
  'dist/commands'
];

dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  } else {
    console.log(`Directory already exists: ${dirPath}`);
  }
});

console.log('All required directories have been checked and created if needed.');