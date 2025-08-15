// Simple test launcher to verify basic functionality

const chalk = require('chalk');

console.log(chalk.green('✓ Chalk is working'));

// Test if we can access backend files
try {
  const fs = require('fs');
  
  // Check if backend directory exists
  if (fs.existsSync('./backend')) {
    console.log(chalk.green('✓ Backend directory exists'));
    
    // Check for key files
    const files = [
      './backend/server.js',
      './backend/llm-service.js',
      './backend/websocket-service.js',
      './backend/enhanced-memory-system.js',
      './backend/unified-llm-core.js',
      './backend/orchestration-service.js'
    ];
    
    files.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(chalk.green(`✓ Found: ${file}`));
      } else {
        console.log(chalk.red(`✗ Missing: ${file}`));
      }
    });
  }
  
  // Try to start the basic backend server
  console.log(chalk.yellow('\nAttempting to start backend server...'));
  const { spawn } = require('child_process');
  
  const backend = spawn('node', ['backend/server.js'], {
    env: { ...process.env, PORT: 3001 }
  });
  
  backend.stdout.on('data', (data) => {
    console.log(chalk.cyan(`Backend: ${data}`));
  });
  
  backend.stderr.on('data', (data) => {
    console.log(chalk.red(`Backend Error: ${data}`));
  });
  
  backend.on('error', (error) => {
    console.log(chalk.red(`Failed to start backend: ${error.message}`));
  });
  
  // Give it a few seconds then exit
  setTimeout(() => {
    console.log(chalk.yellow('\nTest complete. Stopping...'));
    backend.kill();
    process.exit(0);
  }, 5000);
  
} catch (error) {
  console.log(chalk.red(`Error: ${error.message}`));
}