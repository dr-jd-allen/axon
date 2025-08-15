#!/usr/bin/env node

// AXON Simple Launcher - Streamlined startup
const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');

console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                    A X O N   L A U N C H E R                 ║
║         Autonomous Expert Organizational Network             ║
║                     Spinwheel v2 Edition                     ║
╚═══════════════════════════════════════════════════════════════╝
`));

async function launch() {
  console.log(chalk.yellow('🚀 Starting AXON System...\n'));
  
  // Check environment
  if (!fs.existsSync('backend/.env')) {
    console.log(chalk.red('⚠️  No .env file found!'));
    console.log(chalk.yellow('Creating from template...'));
    
    if (fs.existsSync('backend/.env.example')) {
      fs.copyFileSync('backend/.env.example', 'backend/.env');
      console.log(chalk.green('✓ Created backend/.env'));
      console.log(chalk.yellow('\nPlease edit backend/.env and add your API keys:'));
      console.log('  - ANTHROPIC_API_KEY');
      console.log('  - OPENAI_API_KEY');
      console.log('  - GOOGLE_API_KEY\n');
    }
  }
  
  // Create necessary directories
  const dirs = ['memory-store', 'logs', 'cache'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(chalk.gray(`Created ${dir}/`));
    }
  });
  
  // Start backend server
  console.log(chalk.cyan('Starting backend server...'));
  const backend = spawn('node', ['backend/server.js'], {
    cwd: __dirname,  // Ensure we're in the right directory
    env: { ...process.env, PORT: 3001 },
    stdio: 'inherit'
  });
  
  backend.on('error', (error) => {
    console.error(chalk.red(`Failed to start backend: ${error.message}`));
    process.exit(1);
  });
  
  // Wait a moment for server to start
  setTimeout(() => {
    console.log(chalk.green('\n✓ AXON System Started!'));
    console.log(chalk.cyan('\n📍 Access Points:'));
    console.log('  Main Interface: http://localhost:3001');
    console.log('  Frontend: http://localhost:3001/frontend/index.html');
    console.log('  Monitor: http://localhost:3001/frontend/monitor.html\n');
    console.log(chalk.gray('Press Ctrl+C to stop AXON\n'));
    
    // Open browser (Windows)
    if (process.platform === 'win32') {
      require('child_process').exec('start http://localhost:3001');
    }
  }, 2000);
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down AXON...'));
    backend.kill();
    process.exit(0);
  });
}

// Run
launch().catch(console.error);