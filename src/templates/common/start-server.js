const { spawn } = require('child_process');
const fs = require('fs');

const serverPath = fs.existsSync('./omp-server.exe') ? './omp-server.exe' : './omp-server';

if (!fs.existsSync(serverPath)) {
  console.error('❌ Server executable not found!');
  process.exit(1);
}

console.log('🚀 Starting server...');
console.log('Press Ctrl+C to stop');
console.log('');

const server = spawn(serverPath, [], {
  stdio: 'inherit',
  cwd: process.cwd()
});

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...');
  server.kill();
  process.exit(0);
});

server.on('exit', (code) => {
  console.log(`\n❌ Server exited with code ${code}`);
  process.exit(code);
});