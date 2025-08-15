// Test model configurations
require('dotenv').config({ path: './backend/.env' });
const llmService = require('./backend/llm-service');

console.log('=== LLM Service Model Configuration Test ===');

// Test OpenAI models (updated for August 2025)
const openaiModels = ['gpt-4o', 'gpt-4.5-research-preview', 'gpt-4.1-latest', 'o1-preview', 'o3-pro'];
console.log('OpenAI Models:');
openaiModels.forEach(model => {
  const config = llmService.getModelConfig(model);
  console.log(`  ${model}: ${config ? 'CONFIGURED' : 'NOT FOUND'}`);
  if (config) {
    console.log(`    Provider: ${config.provider}, API Name: ${config.apiName}`);
  }
});

// Test Anthropic models  
const anthropicModels = ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
console.log('\nAnthropic Models:');
anthropicModels.forEach(model => {
  const config = llmService.getModelConfig(model);
  console.log(`  ${model}: ${config ? 'CONFIGURED' : 'NOT FOUND'}`);
  if (config) {
    console.log(`    Provider: ${config.provider}, API Name: ${config.apiName}`);
  }
});

// Test Google models
const googleModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-pro'];
console.log('\nGoogle Models:');
googleModels.forEach(model => {
  const config = llmService.getModelConfig(model);
  console.log(`  ${model}: ${config ? 'CONFIGURED' : 'NOT FOUND'}`);
  if (config) {
    console.log(`    Provider: ${config.provider}, API Name: ${config.apiName}`);
  }
});

console.log('\n=== Testing Actual API Calls ===');

// Test a simple OpenAI call
async function testOpenAI() {
  try {
    console.log('Testing OpenAI with GPT-4o...');
    const response = await llmService.generateResponse(
      {
        model: 'gpt-4o',
        parameters: { temperature: 0.7, maxTokens: 10 },
        prompt: 'You are a test assistant.'
      },
      [{ role: 'user', content: 'Say hello' }],
      process.env.OPENAI_API_KEY
    );
    console.log('OpenAI SUCCESS:', response.content.substring(0, 50));
  } catch (error) {
    console.log('OpenAI ERROR:', error.message);
  }
}

// Test a simple Anthropic call  
async function testAnthropic() {
  try {
    console.log('Testing Anthropic...');
    const response = await llmService.generateResponse(
      {
        model: 'claude-3-haiku-20240307',
        parameters: { temperature: 0.7, maxTokens: 10 },
        prompt: 'You are a test assistant.'
      },
      [{ role: 'user', content: 'Say hello' }],
      process.env.ANTHROPIC_API_KEY
    );
    console.log('Anthropic SUCCESS:', response.content.substring(0, 50));
  } catch (error) {
    console.log('Anthropic ERROR:', error.message);
  }
}

// Run tests
testOpenAI();
testAnthropic();