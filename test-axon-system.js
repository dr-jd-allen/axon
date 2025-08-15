// AXON System Test Suite
// Comprehensive test for all AXON components

const axios = require('axios');
const WebSocket = require('ws');

class AXONSystemTest {
  constructor() {
    this.testResults = [];
    this.baseUrl = 'http://localhost';
    this.ports = {
      backend: 3001,
      memory: 3005,
      health: 3006,
      websocket: 3003
    };
  }
  
  async runAllTests() {
    console.log('🧪 Starting AXON System Tests...\n');
    
    // Test backend server
    await this.testBackendServer();
    
    // Test memory system
    await this.testMemorySystem();
    
    // Test health monitor
    await this.testHealthMonitor();
    
    // Test WebSocket connection
    await this.testWebSocketConnection();
    
    // Test LLM integration
    await this.testLLMIntegration();
    
    // Print results
    this.printResults();
  }
  
  async testBackendServer() {
    console.log('Testing Backend Server...');
    try {
      const response = await axios.get(`${this.baseUrl}:${this.ports.backend}/health`, {
        timeout: 5000
      });
      this.addResult('Backend Server', true, 'Server responding correctly');
    } catch (error) {
      this.addResult('Backend Server', false, `Error: ${error.message}`);
    }
  }
  
  async testMemorySystem() {
    console.log('Testing Memory System...');
    try {
      const response = await axios.get(`${this.baseUrl}:${this.ports.memory}/status`, {
        timeout: 5000
      });
      this.addResult('Memory System', true, 'Memory system accessible');
    } catch (error) {
      this.addResult('Memory System', false, `Error: ${error.message}`);
    }
  }
  
  async testHealthMonitor() {
    console.log('Testing Health Monitor...');
    try {
      const response = await axios.get(`${this.baseUrl}:${this.ports.health}`, {
        timeout: 5000
      });
      this.addResult('Health Monitor', true, 'Health monitor accessible');
    } catch (error) {
      this.addResult('Health Monitor', false, `Error: ${error.message}`);
    }
  }
  
  async testWebSocketConnection() {
    console.log('Testing WebSocket Connection...');
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(`ws://localhost:${this.ports.websocket}`);
        
        ws.on('open', () => {
          this.addResult('WebSocket', true, 'Connection established');
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          this.addResult('WebSocket', false, `Connection failed: ${error.message}`);
          resolve();
        });
        
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            this.addResult('WebSocket', false, 'Connection timeout');
            ws.terminate();
            resolve();
          }
        }, 5000);
        
      } catch (error) {
        this.addResult('WebSocket', false, `Error: ${error.message}`);
        resolve();
      }
    });
  }
  
  async testLLMIntegration() {
    console.log('Testing LLM Integration...');
    try {
      const testPayload = {
        agents: [
          {
            type: 'generalist',
            model: 'gpt-4o',
            systemPrompt: 'You are a helpful assistant.'
          }
        ],
        message: 'Hello, this is a test message.',
        settings: {}
      };
      
      const response = await axios.post(
        `${this.baseUrl}:${this.ports.backend}/api/orchestrate`,
        testPayload,
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (response.data && response.data.responses) {
        this.addResult('LLM Integration', true, 'LLM orchestration working');
      } else {
        this.addResult('LLM Integration', false, 'Invalid response format');
      }
    } catch (error) {
      this.addResult('LLM Integration', false, `Error: ${error.message}`);
    }
  }
  
  addResult(component, success, message) {
    this.testResults.push({
      component,
      success,
      message,
      timestamp: new Date().toISOString()
    });
  }
  
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 AXON SYSTEM TEST RESULTS');
    console.log('='.repeat(60));
    
    let passCount = 0;
    let totalCount = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} | ${result.component.padEnd(20)} | ${result.message}`);
      
      if (result.success) passCount++;
    });
    
    console.log('='.repeat(60));
    console.log(`📊 OVERALL: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)`);
    
    if (passCount === totalCount) {
      console.log('🎉 All systems operational! AXON is ready for use.');
    } else {
      console.log('⚠️  Some components need attention. Check the failed tests above.');
    }
    
    console.log('='.repeat(60));
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AXONSystemTest();
  tester.runAllTests().catch(console.error);
}

module.exports = AXONSystemTest;