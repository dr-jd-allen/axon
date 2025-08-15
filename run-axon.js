console.log('Starting AXON...\n');

const { spawn } = require('child_process');
const path = require('path');

const backend = spawn('node', ['backend/server.js'], {
  env: { ...process.env, PORT: 3001 },
  stdio: 'inherit'
});

backend.on('error', (err) => {
  console.error('Failed to start:', err);
});

setTimeout(() => {
  console.log('\n✓ AXON Started!');
  console.log('Opening http://localhost:3001');
  require('child_process').exec('start http://localhost:3001');
}, 3000);

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  backend.kill();
  process.exit(0);
});