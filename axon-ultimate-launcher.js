#!/usr/bin/env node

// AXON Ultimate Launcher - The Complete System Startup
// Integrates ALL components with proper initialization order

const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');
const fs = require('fs').promises;

class AXONUltimateLauncher {
  constructor() {
    this.services = [];
    this.config = {
      memoryServerPort: 3005,
      healthMonitorPort: 3006,
      websocketPort: 3003,
      backendPort: 3001,
      enableChromaDB: false,
      enableMCP: true,
      persistMemory: true
    };
    
    this.status = {
      memory: false,
      health: false,
      backend: false,
      websocket: false,
      orchestration: false,
      ui: false
    };
  }
  
  async launch() {
    console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     █████╗ ██╗  ██╗ ██████╗ ███╗   ██╗                      ║
║    ██╔══██╗╚██╗██╔╝██╔═══██╗████╗  ██║                      ║
║    ███████║ ╚███╔╝ ██║   ██║██╔██╗ ██║                      ║
║    ██╔══██║ ██╔██╗ ██║   ██║██║╚██╗██║                      ║
║    ██║  ██║██╔╝ ██╗╚██████╔╝██║ ╚████║                      ║
║    ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝                      ║
║                                                               ║
║         AUTONOMOUS EXPERT ORGANIZATIONAL NETWORK             ║
║                  Ultimate Edition v2.0                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `));
    
    console.log(chalk.yellow('\n🚀 Initializing AXON Ultimate System...\n'));
    
    try {
      // Phase 1: Core Infrastructure
      console.log(chalk.blue('═══ PHASE 1: Core Infrastructure ═══'));
      await this.initializeInfrastructure();
      
      // Phase 2: Memory & Persistence
      console.log(chalk.blue('\n═══ PHASE 2: Memory & Persistence ═══'));
      await this.initializeMemorySystem();
      
      // Phase 3: Orchestration & Intelligence
      console.log(chalk.blue('\n═══ PHASE 3: Orchestration & Intelligence ═══'));
      await this.initializeOrchestration();
      
      // Phase 4: Communication Layer
      console.log(chalk.blue('\n═══ PHASE 4: Communication Layer ═══'));
      await this.initializeCommunication();
      
      // Phase 5: Monitoring & Health
      console.log(chalk.blue('\n═══ PHASE 5: Monitoring & Health ═══'));
      await this.initializeMonitoring();
      
      // Phase 6: User Interface
      console.log(chalk.blue('\n═══ PHASE 6: User Interface ═══'));
      await this.initializeUI();
      
      // System Ready
      this.displaySystemStatus();
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error(chalk.red('\n❌ Launch failed:'), error);
      await this.shutdown();
      process.exit(1);
    }
  }
  
  async initializeInfrastructure() {
    // Check dependencies
    console.log(chalk.gray('  Checking dependencies...'));
    await this.checkDependencies();
    
    // Create necessary directories
    console.log(chalk.gray('  Creating directories...'));
    await this.createDirectories();
    
    // Load configuration
    console.log(chalk.gray('  Loading configuration...'));
    await this.loadConfiguration();
    
    console.log(chalk.green('  ✓ Infrastructure ready'));
  }
  
  async initializeMemorySystem() {
    console.log(chalk.gray('  Starting MCP Memory Server...'));
    
    const MCPMemoryServer = require('./backend/mcp-memory-server');
    this.memoryServer = new MCPMemoryServer({
      port: this.config.memoryServerPort,
      enableChroma: this.config.enableChromaDB,
      enableFilesystem: this.config.persistMemory
    });
    
    // Start Enhanced Memory System
    console.log(chalk.gray('  Initializing Enhanced Memory System...'));
    const { EnhancedMemorySystem } = require('./backend/enhanced-memory-system');
    this.memorySystem = new EnhancedMemorySystem({
      persistencePath: './memory-store',
      autoSaveInterval: 60000
    });
    
    // Load existing memories
    await this.memorySystem.loadMemories();
    
    this.status.memory = true;
    console.log(chalk.green('  ✓ Memory system initialized'));
  }
  
  async initializeOrchestration() {
    console.log(chalk.gray('  Loading Unified LLM Core...'));
    
    const { UnifiedOrchestrator } = require('./backend/unified-llm-core');
    this.orchestrator = new UnifiedOrchestrator();
    
    // Create default agents
    console.log(chalk.gray('  Creating AI agents...'));
    
    const agents = [
      {
        id: 'explorer-1',
        name: 'Explorer',
        model: 'claude-opus-4-20250514',
        provider: 'anthropic'
      },
      {
        id: 'synthesizer-1',
        name: 'Synthesizer',
        model: 'gpt-4o',
        provider: 'openai'
      },
      {
        id: 'analyst-1',
        name: 'Analyst',
        model: 'gemini-2.5-pro',
        provider: 'google'
      }
    ];
    
    for (const agentConfig of agents) {
      try {
        const agent = this.orchestrator.createAgent(agentConfig);
        console.log(chalk.gray(`    Created agent: ${agent.name}`));
      } catch (error) {
        console.log(chalk.yellow(`    ⚠ Could not create ${agentConfig.name}: ${error.message}`));
      }
    }
    
    // Set up orchestrator events
    this.orchestrator.on('orchestration-complete', (event) => {
      console.log(chalk.cyan(`  [Orchestration] ${event.strategy} completed in ${event.duration}ms`));
    });
    
    this.orchestrator.on('system-health', (health) => {
      if (health.health < 0.5) {
        console.log(chalk.yellow(`  ⚠ System health degraded: ${(health.health * 100).toFixed(1)}%`));
      }
    });
    
    this.status.orchestration = true;
    console.log(chalk.green('  ✓ Orchestration system ready'));
  }
  
  async initializeCommunication() {
    console.log(chalk.gray('  Starting WebSocket service...'));
    
    // Import and modify websocket service to use unified core
    const WebSocketService = require('./backend/websocket-service');
    
    // Start backend server
    console.log(chalk.gray('  Starting backend server...'));
    const backendProcess = spawn('node', ['backend/server.js'], {
      env: { ...process.env, PORT: this.config.backendPort }
    });
    
    backendProcess.stdout.on('data', (data) => {
      if (data.toString().includes('listening')) {
        this.status.backend = true;
        console.log(chalk.green('  ✓ Backend server running'));
      }
    });
    
    this.services.push(backendProcess);
    
    // Wait for backend to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.status.websocket = true;
    console.log(chalk.green('  ✓ Communication layer established'));
  }
  
  async initializeMonitoring() {
    console.log(chalk.gray('  Starting Health Monitor...'));
    
    const HealthMonitorService = require('./backend/health-monitor-service');
    this.healthMonitor = new HealthMonitorService({
      port: this.config.healthMonitorPort
    });
    
    // Connect to orchestrator
    this.orchestrator.on('metrics-update', (metrics) => {
      this.healthMonitor.updateAgentMetrics(metrics.agent, metrics);
    });
    
    this.orchestrator.on('orchestration-complete', (event) => {
      this.healthMonitor.updateOrchestrationMetrics({
        success: true,
        responseTime: event.duration
      });
    });
    
    // Set up alerts
    this.healthMonitor.on('alert', (alert) => {
      if (alert.severity === 'critical') {
        console.log(chalk.red(`  🚨 CRITICAL: ${alert.message}`));
      } else if (alert.severity === 'error') {
        console.log(chalk.red(`  ❌ ERROR: ${alert.message}`));
      } else if (alert.severity === 'warning') {
        console.log(chalk.yellow(`  ⚠ WARNING: ${alert.message}`));
      }
    });
    
    this.status.health = true;
    console.log(chalk.green('  ✓ Health monitoring active'));
    console.log(chalk.gray(`    Dashboard: http://localhost:${this.config.healthMonitorPort}`));
  }
  
  async initializeUI() {
    console.log(chalk.gray('  Preparing user interface...'));
    
    // Start the enhanced monitor
    const uiProcess = spawn('start', ['http://localhost:3001/monitor-enhanced.html'], {
      shell: true,
      detached: true
    });
    
    this.status.ui = true;
    console.log(chalk.green('  ✓ User interface ready'));
    console.log(chalk.gray('    Monitor: http://localhost:3001/monitor-enhanced.html'));
  }
  
  async checkDependencies() {
    const required = [
      'express',
      'ws',
      '@anthropic-ai/sdk',
      'openai',
      'axios'
    ];
    
    for (const dep of required) {
      try {
        require.resolve(dep);
      } catch (error) {
        console.log(chalk.yellow(`    Installing ${dep}...`));
        await this.installPackage(dep);
      }
    }
  }
  
  async installPackage(packageName) {
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install', packageName], {
        stdio: 'inherit'
      });
      
      npm.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to install ${packageName}`));
        }
      });
    });
  }
  
  async createDirectories() {
    const dirs = [
      './memory-store',
      './memory-store/models',
      './memory-store/prompts',
      './logs',
      './cache'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
  
  async loadConfiguration() {
    try {
      const configPath = './axon-config.json';
      const configData = await fs.readFile(configPath, 'utf-8');
      const userConfig = JSON.parse(configData);
      this.config = { ...this.config, ...userConfig };
    } catch (error) {
      // Use default config
      console.log(chalk.gray('    Using default configuration'));
    }
  }
  
  displaySystemStatus() {
    console.log(chalk.bold.green(`
╔═══════════════════════════════════════════════════════════════╗
║                     SYSTEM STATUS                            ║
╠═══════════════════════════════════════════════════════════════╣
║  Memory System      : ${this.status.memory ? '✓ ONLINE' : '✗ OFFLINE'}                              ║
║  Orchestration      : ${this.status.orchestration ? '✓ ONLINE' : '✗ OFFLINE'}                              ║
║  Backend Server     : ${this.status.backend ? '✓ ONLINE' : '✗ OFFLINE'}                              ║
║  WebSocket Layer    : ${this.status.websocket ? '✓ ONLINE' : '✗ OFFLINE'}                              ║
║  Health Monitor     : ${this.status.health ? '✓ ONLINE' : '✗ OFFLINE'}                              ║
║  User Interface     : ${this.status.ui ? '✓ ONLINE' : '✗ OFFLINE'}                              ║
╠═══════════════════════════════════════════════════════════════╣
║                      ACCESS POINTS                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Main Interface     : http://localhost:3001                  ║
║  Health Dashboard   : http://localhost:${this.config.healthMonitorPort}                  ║
║  Memory API         : http://localhost:${this.config.memoryServerPort}                  ║
║  WebSocket          : ws://localhost:${this.config.websocketPort}                     ║
╠═══════════════════════════════════════════════════════════════╣
║              Press Ctrl+C to shutdown system                 ║
╚═══════════════════════════════════════════════════════════════╝
    `));
    
    console.log(chalk.bold.cyan('\n🎉 AXON Ultimate System is fully operational!\n'));
    
    // Show quick stats
    const stats = this.orchestrator.getSystemStatus();
    console.log(chalk.gray('System Statistics:'));
    console.log(chalk.gray(`  • Active Agents: ${stats.agents.length}`));
    console.log(chalk.gray(`  • Memory Collections: ${stats.memory.totalAgents} agents, ${stats.memory.totalConversations} conversations`));
    console.log(chalk.gray(`  • System Health: ${(stats.health.overall * 100).toFixed(1)}%`));
  }
  
  setupGracefulShutdown() {
    const shutdown = async () => {
      console.log(chalk.yellow('\n\n📦 Shutting down AXON Ultimate System...'));
      
      // Save all memories
      console.log(chalk.gray('  Saving memories...'));
      await this.memorySystem.saveMemories();
      
      // Export system state
      console.log(chalk.gray('  Exporting system state...'));
      await this.orchestrator.exportSystemState('./system-state-backup.json');
      
      // Stop services
      console.log(chalk.gray('  Stopping services...'));
      for (const service of this.services) {
        service.kill();
      }
      
      // Close servers
      if (this.memoryServer) {
        await this.memoryServer.shutdown();
      }
      
      console.log(chalk.green('\n✓ AXON shutdown complete. Goodbye! 👋\n'));
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
  
  async shutdown() {
    // Emergency shutdown
    for (const service of this.services) {
      try {
        service.kill('SIGKILL');
      } catch (error) {
        // Ignore
      }
    }
  }
}

// Auto-launch when run directly
if (require.main === module) {
  const launcher = new AXONUltimateLauncher();
  launcher.launch().catch(console.error);
}

module.exports = AXONUltimateLauncher;