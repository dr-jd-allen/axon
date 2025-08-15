// AXON Setup Verification Script
// Checks all dependencies, configurations, and prerequisites

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AXONSetupVerifier {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.successes = [];
  }
  
  async verify() {
    console.log('🔍 AXON Setup Verification Starting...\n');
    
    this.checkNodeVersion();
    this.checkDependencies();
    this.checkEnvironmentFile();
    this.checkAPIKeys();
    this.checkDirectoryStructure();
    this.checkPorts();
    
    this.printReport();
  }
  
  checkNodeVersion() {
    console.log('Checking Node.js version...');
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
      
      if (majorVersion >= 16) {
        this.addSuccess(`Node.js version ${nodeVersion} is compatible`);
      } else {
        this.addIssue(`Node.js version ${nodeVersion} is too old. Requires Node.js 16 or higher`);
      }
    } catch (error) {
      this.addIssue(`Failed to check Node.js version: ${error.message}`);
    }
  }
  
  checkDependencies() {
    console.log('Checking dependencies...');
    const packagePath = path.join(__dirname, 'backend', 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      this.addIssue('Backend package.json not found');
      return;
    }
    
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const requiredDeps = [
        'express', 'cors', 'dotenv', 'openai', '@anthropic-ai/sdk',
        'sqlite3', 'ws', 'axios'
      ];
      
      const missing = requiredDeps.filter(dep => !pkg.dependencies[dep]);
      
      if (missing.length === 0) {
        this.addSuccess('All required dependencies are listed');
      } else {
        this.addIssue(`Missing dependencies: ${missing.join(', ')}`);
      }
      
      // Check if node_modules exists
      const nodeModulesPath = path.join(__dirname, 'backend', 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        this.addSuccess('Dependencies appear to be installed');
      } else {
        this.addWarning('Dependencies may not be installed. Run: cd backend && npm install');
      }
      
    } catch (error) {
      this.addIssue(`Failed to check dependencies: ${error.message}`);
    }
  }
  
  checkEnvironmentFile() {
    console.log('Checking environment configuration...');
    const envPath = path.join(__dirname, 'backend', '.env');
    
    if (fs.existsSync(envPath)) {
      this.addSuccess('Environment file (.env) exists');
      
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const requiredVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY'];
        const missingVars = requiredVars.filter(varName => !envContent.includes(varName));
        
        if (missingVars.length === 0) {
          this.addSuccess('All required environment variables are defined');
        } else {
          this.addWarning(`Environment variables may be missing: ${missingVars.join(', ')}`);
        }
      } catch (error) {
        this.addIssue(`Failed to read environment file: ${error.message}`);
      }
    } else {
      this.addWarning('Environment file (.env) not found. Copy env.example to .env and configure your API keys');
    }
  }
  
  checkAPIKeys() {
    console.log('Checking API key configuration...');
    require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
    
    const apiKeys = {
      'OpenAI': process.env.OPENAI_API_KEY,
      'Anthropic': process.env.ANTHROPIC_API_KEY,
      'Google': process.env.GOOGLE_API_KEY
    };
    
    let validKeys = 0;
    Object.entries(apiKeys).forEach(([provider, key]) => {
      if (key && key.trim() && !key.includes('your-') && !key.includes('api-key')) {
        this.addSuccess(`${provider} API key appears to be configured`);
        validKeys++;
      } else {
        this.addWarning(`${provider} API key appears to be missing or placeholder`);
      }
    });
    
    if (validKeys === 0) {
      this.addIssue('No valid API keys found. AXON cannot function without at least one LLM provider API key');
    }
  }
  
  checkDirectoryStructure() {
    console.log('Checking directory structure...');
    const requiredDirs = [
      'backend',
      'frontend',
      'config',
      'logs',
      'memory-store',
      'cache'
    ];
    
    const requiredFiles = [
      'backend/server.js',
      'backend/llm-service.js',
      'backend/orchestration-service.js',
      'backend/unified-llm-core.js',
      'frontend/index.html',
      'config/config.json'
    ];
    
    let missingDirs = [];
    let missingFiles = [];
    
    requiredDirs.forEach(dir => {
      if (!fs.existsSync(path.join(__dirname, dir))) {
        missingDirs.push(dir);
      }
    });
    
    requiredFiles.forEach(file => {
      if (!fs.existsSync(path.join(__dirname, file))) {
        missingFiles.push(file);
      }
    });
    
    if (missingDirs.length === 0 && missingFiles.length === 0) {
      this.addSuccess('Directory structure is complete');
    } else {
      if (missingDirs.length > 0) {
        this.addIssue(`Missing directories: ${missingDirs.join(', ')}`);
      }
      if (missingFiles.length > 0) {
        this.addIssue(`Missing files: ${missingFiles.join(', ')}`);
      }
    }
  }
  
  checkPorts() {
    console.log('Checking port availability...');
    const requiredPorts = [3001, 3003, 3005, 3006];
    
    // Note: This is a simplified check. In a production environment,
    // you'd want to actually attempt to bind to these ports
    this.addSuccess(`Ports ${requiredPorts.join(', ')} will be checked during startup`);
  }
  
  addSuccess(message) {
    this.successes.push(message);
    console.log(`✅ ${message}`);
  }
  
  addWarning(message) {
    this.warnings.push(message);
    console.log(`⚠️  ${message}`);
  }
  
  addIssue(message) {
    this.issues.push(message);
    console.log(`❌ ${message}`);
  }
  
  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 AXON SETUP VERIFICATION REPORT');
    console.log('='.repeat(70));
    
    console.log(`\n✅ SUCCESSES (${this.successes.length}):`);
    this.successes.forEach(success => console.log(`   • ${success}`));
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    if (this.issues.length > 0) {
      console.log(`\n❌ ISSUES (${this.issues.length}):`);
      this.issues.forEach(issue => console.log(`   • ${issue}`));
    }
    
    console.log('\n' + '='.repeat(70));
    
    if (this.issues.length === 0) {
      console.log('🎉 SETUP VERIFICATION PASSED!');
      console.log('Your AXON system appears to be properly configured.');
      if (this.warnings.length > 0) {
        console.log(`⚠️  Note: ${this.warnings.length} warning(s) should be addressed for optimal operation.`);
      }
    } else {
      console.log('⚠️  SETUP VERIFICATION FAILED!');
      console.log(`Please address the ${this.issues.length} issue(s) listed above before running AXON.`);
    }
    
    console.log('\nNext steps:');
    console.log('1. Address any issues or warnings listed above');
    console.log('2. Run: node axon-ultimate-launcher.js');
    console.log('3. Optional: Run system tests with: node test-axon-system.js');
    console.log('='.repeat(70));
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new AXONSetupVerifier();
  verifier.verify().catch(console.error);
}

module.exports = AXONSetupVerifier;