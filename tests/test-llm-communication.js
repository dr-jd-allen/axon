// Test script for AXON inter-LLM communication improvements
// Run with: node test-llm-communication.js

const WebSocket = require('ws');

// Configuration
const WS_URL = 'ws://localhost:3003';
const TEST_TOPIC = 'Testing improved inter-LLM communication and error recovery';

// Test scenarios
const testScenarios = [
  {
    name: 'Parallel Processing Test',
    agents: [
      { type: 'anthropic', name: 'Claude', model: 'claude-opus-4-20250514' },
      { type: 'openai', name: 'GPT', model: 'gpt-4o' },
      { type: 'google', name: 'Gemini', model: 'gemini-2.5-pro' }
    ],
    strategy: 'parallel',
    message: 'What are the key benefits of parallel processing in distributed systems?'
  },
  {
    name: 'Sequential Chain Test',
    agents: [
      { type: 'openai', name: 'Analyzer', model: 'gpt-4o' },
      { type: 'anthropic', name: 'Synthesizer', model: 'claude-opus-4-20250514' }
    ],
    strategy: 'sequential',
    message: 'Analyze this concept: quantum computing. Then synthesize the implications.'
  },
  {
    name: 'Circuit Breaker Test',
    agents: [
      { type: 'openai', name: 'Primary', model: 'invalid-model-test' }, // Will fail
      { type: 'anthropic', name: 'Fallback', model: 'claude-3-opus-20240229' }
    ],
    strategy: 'competitive',
    message: 'Test circuit breaker fallback mechanism'
  },
  {
    name: 'Reconnection Test',
    agents: [
      { type: 'openai', name: 'Agent1', model: 'gpt-4-turbo' }
    ],
    strategy: 'parallel',
    message: 'Test WebSocket reconnection',
    simulateDisconnect: true
  }
];

class LLMCommunicationTester {
  constructor() {
    this.ws = null;
    this.results = [];
    this.currentTest = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('Connecting to AXON backend...');
      this.ws = new WebSocket(WS_URL + '?userId=tester');
      
      this.ws.on('open', () => {
        console.log('✓ Connected to AXON backend');
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error('✗ Connection error:', error.message);
        reject(error);
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data));
      });
      
      this.ws.on('close', () => {
        console.log('Connection closed');
      });
    });
  }

  handleMessage(data) {
    const { type } = data;
    
    switch (type) {
      case 'connected':
        console.log(`Connected as user: ${data.userId}`);
        if (data.isReconnection) {
          console.log('✓ Reconnection successful!');
        }
        break;
        
      case 'agent_response':
        console.log(`\n[${data.agent.name}] Response received`);
        console.log(`Length: ${data.response?.length || 0} characters`);
        if (data.responseTime) {
          console.log(`Response time: ${data.responseTime}ms`);
        }
        break;
        
      case 'agent_response_error':
        console.error(`[${data.agent.name}] Error: ${data.error}`);
        break;
        
      case 'orchestration_error':
        console.error(`Orchestration error: ${data.error}`);
        break;
        
      case 'chat_complete':
        console.log(`\n✓ Chat completed - Strategy: ${data.strategy}`);
        if (this.currentTest) {
          this.results.push({
            test: this.currentTest.name,
            success: true,
            strategy: data.strategy
          });
        }
        break;
        
      case 'consensus_result':
        console.log(`\nConsensus reached: ${(data.agreementLevel * 100).toFixed(1)}% agreement`);
        break;
        
      case 'pipeline_result':
        console.log(`\nPipeline completed with ${data.pipeline.length} stages`);
        break;
    }
  }

  async runTest(scenario) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${scenario.name}`);
    console.log(`Strategy: ${scenario.strategy}`);
    console.log(`Agents: ${scenario.agents.map(a => a.name).join(', ')}`);
    console.log('='.repeat(60));
    
    this.currentTest = scenario;
    
    // Simulate disconnect if requested
    if (scenario.simulateDisconnect) {
      console.log('Simulating disconnect in 2 seconds...');
      setTimeout(() => {
        console.log('Disconnecting...');
        this.ws.close();
        
        // Reconnect after 3 seconds
        setTimeout(async () => {
          console.log('Attempting to reconnect...');
          await this.connect();
        }, 3000);
      }, 2000);
    }
    
    // Send test message
    const message = {
      type: 'chat',
      payload: {
        sessionId: `test-${Date.now()}`,
        agents: scenario.agents,
        message: scenario.message,
        settings: {
          orchestrationStrategy: scenario.strategy,
          enableTools: false,
          agentModels: {},
          agentParameters: {
            temperature: 0.7,
            maxTokens: 500
          }
        }
      }
    };
    
    this.ws.send(JSON.stringify(message));
    
    // Wait for completion
    return new Promise(resolve => {
      setTimeout(resolve, scenario.simulateDisconnect ? 15000 : 10000);
    });
  }

  async runAllTests() {
    try {
      await this.connect();
      
      for (const scenario of testScenarios) {
        await this.runTest(scenario);
      }
      
      this.printResults();
    } catch (error) {
      console.error('Test suite failed:', error);
    } finally {
      if (this.ws) {
        this.ws.close();
      }
    }
  }

  printResults() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST RESULTS');
    console.log('='.repeat(60));
    
    for (const result of this.results) {
      const status = result.success ? '✓ PASS' : '✗ FAIL';
      console.log(`${status} - ${result.test} (${result.strategy})`);
    }
    
    const passCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    const passRate = (passCount / totalCount * 100).toFixed(1);
    
    console.log(`\nOverall: ${passCount}/${totalCount} passed (${passRate}%)`);
  }

  // Performance benchmark
  async runPerformanceBenchmark() {
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE BENCHMARK');
    console.log('='.repeat(60));
    
    const agents = [
      { type: 'openai', name: 'GPT1', model: 'gpt-4-turbo' },
      { type: 'anthropic', name: 'Claude1', model: 'claude-3-sonnet-20240229' },
      { type: 'google', name: 'Gemini1', model: 'gemini-2.5-flash' }
    ];
    
    // Test parallel vs sequential
    const parallelStart = Date.now();
    await this.runTest({
      name: 'Parallel Benchmark',
      agents,
      strategy: 'parallel',
      message: 'Benchmark test message'
    });
    const parallelTime = Date.now() - parallelStart;
    
    const sequentialStart = Date.now();
    await this.runTest({
      name: 'Sequential Benchmark',
      agents,
      strategy: 'sequential',
      message: 'Benchmark test message'
    });
    const sequentialTime = Date.now() - sequentialStart;
    
    console.log('\n' + '='.repeat(60));
    console.log('BENCHMARK RESULTS');
    console.log('='.repeat(60));
    console.log(`Parallel Processing: ${parallelTime}ms`);
    console.log(`Sequential Processing: ${sequentialTime}ms`);
    console.log(`Performance Improvement: ${((sequentialTime - parallelTime) / sequentialTime * 100).toFixed(1)}%`);
  }
}

// Main execution
async function main() {
  console.log('AXON Inter-LLM Communication Test Suite');
  console.log('========================================\n');
  
  const tester = new LLMCommunicationTester();
  
  // Check if running specific test or all
  const args = process.argv.slice(2);
  
  if (args.includes('--benchmark')) {
    await tester.connect();
    await tester.runPerformanceBenchmark();
  } else if (args.includes('--quick')) {
    await tester.connect();
    await tester.runTest(testScenarios[0]); // Just run first test
  } else {
    await tester.runAllTests();
  }
  
  process.exit(0);
}

// Run tests
main().catch(console.error);