// AXON API Key Test Utility
// Tests all configured API keys to ensure they're working properly

require('dotenv').config({ path: './backend/.env' });
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

class APIKeyTester {
  constructor() {
    this.results = [];
  }
  
  async testAllKeys() {
    console.log('🔑 Testing AXON API Keys...\n');
    
    await this.testOpenAI();
    await this.testAnthropic();
    await this.testGoogle();
    
    this.printResults();
  }
  
  async testOpenAI() {
    console.log('Testing OpenAI API Key...');
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey.includes('your-') || apiKey.includes('api-key')) {
      this.addResult('OpenAI', false, 'API key not configured or is placeholder');
      return;
    }
    
    try {
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello! This is a test.' }],
        max_tokens: 10
      });
      
      if (response.choices && response.choices[0]) {
        this.addResult('OpenAI', true, 'API key working correctly');
      } else {
        this.addResult('OpenAI', false, 'Unexpected response format');
      }
    } catch (error) {
      this.addResult('OpenAI', false, error.message);
    }
  }
  
  async testAnthropic() {
    console.log('Testing Anthropic API Key...');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey || apiKey.includes('your-') || apiKey.includes('api-key')) {
      this.addResult('Anthropic', false, 'API key not configured or is placeholder');
      return;
    }
    
    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hello! This is a test.' }],
        max_tokens: 10
      });
      
      if (response.content && response.content[0]) {
        this.addResult('Anthropic', true, 'API key working correctly');
      } else {
        this.addResult('Anthropic', false, 'Unexpected response format');
      }
    } catch (error) {
      // Check for HTML error response
      if (error.message && error.message.includes('<!DOCTYPE')) {
        this.addResult('Anthropic', false, 'Received HTML error page - authentication failed');
      } else {
        this.addResult('Anthropic', false, error.message);
      }
    }
  }
  
  async testGoogle() {
    console.log('Testing Google API Key...');
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey || apiKey.includes('your-') || apiKey.includes('api-key')) {
      this.addResult('Google', false, 'API key not configured or is placeholder');
      return;
    }
    
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await axios.post(url, {
        contents: [{
          parts: [{ text: 'Hello! This is a test.' }]
        }],
        generationConfig: {
          maxOutputTokens: 10
        }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      if (response.data && response.data.candidates && response.data.candidates[0]) {
        this.addResult('Google', true, 'API key working correctly');
      } else {
        this.addResult('Google', false, 'Unexpected response format');
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        this.addResult('Google', false, 'API key may be invalid or quota exceeded');
      } else {
        this.addResult('Google', false, error.message);
      }
    }
  }
  
  addResult(provider, success, message) {
    this.results.push({ provider, success, message });
    const status = success ? '✅' : '❌';
    console.log(`  ${status} ${provider}: ${message}`);
  }
  
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🔑 API KEY TEST RESULTS');
    console.log('='.repeat(60));
    
    let workingKeys = 0;
    let totalKeys = this.results.length;
    
    this.results.forEach(result => {
      const status = result.success ? '✅ WORKING' : '❌ FAILED';
      console.log(`${status} | ${result.provider.padEnd(12)} | ${result.message}`);
      
      if (result.success) workingKeys++;
    });
    
    console.log('='.repeat(60));
    console.log(`📊 SUMMARY: ${workingKeys}/${totalKeys} API keys are working`);
    
    if (workingKeys === 0) {
      console.log('⚠️  NO WORKING API KEYS FOUND!');
      console.log('   AXON cannot function without at least one valid API key.');
      console.log('   Please check your .env file and ensure API keys are correct.');
    } else if (workingKeys < totalKeys) {
      console.log('⚠️  Some API keys are not working.');
      console.log('   AXON will use fallback providers but functionality may be limited.');
    } else {
      console.log('🎉 All API keys are working! AXON is ready to use.');
    }
    
    console.log('\n📋 Next Steps:');
    if (workingKeys === 0) {
      console.log('1. Check your API keys in backend/.env');
      console.log('2. Verify your API keys are valid and have sufficient quota');
      console.log('3. Re-run this test after making corrections');
    } else {
      console.log('1. Launch AXON with: node axon-ultimate-launcher.js');
      console.log('2. Or use the desktop shortcut: AXON System');
    }
    console.log('='.repeat(60));
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new APIKeyTester();
  tester.testAllKeys().catch(console.error);
}

module.exports = APIKeyTester;