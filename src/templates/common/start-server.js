const fs = require('fs');
const path = require('path');

const exeNames = ['omp-server.exe', 'omp-server'];
let serverPath = null;

for (const name of exeNames) {
  const testPath = path.join(__dirname, '..', name);
  if (fs.existsSync(testPath)) {
    serverPath = testPath;
    break;
  }
}

if (!serverPath) {
  console.error('Server executable not found!');
  process.exit(1);
}

console.log('Starting server...');

const serverProcess = spawn(serverPath, [], {
  stdio: 'inherit',
  detached: false,
  cwd: path.join(__dirname, '..')
});

const serverStatePath = path.join(require('os').homedir(), '.pawnctl', 'server_state.json');
const serverState = {
  pid: serverProcess.pid,
  serverPath: serverPath
};

try {
  const stateDir = path.dirname(serverStatePath);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  fs.writeFileSync(serverStatePath, JSON.stringify(serverState, null, 2));
} catch (error) {
  console.error('Failed to save server state:', error);
}

serverProcess.on('exit', (code) => {
  console.log(`Server exited with code ${code || 0}`);
  
  try {
    if (fs.existsSync(serverStatePath)) {
      fs.unlinkSync(serverStatePath);
    }
  } catch (error) {
    console.error('Failed to clean up server state:', error);
  }
});

console.log('Server running - press Ctrl+C to stop');