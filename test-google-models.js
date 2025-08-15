// Test Google AI Studio models
require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

console.log('=== Google AI Studio Key Debugging ===');
console.log('API Key:', process.env.GOOGLE_API_KEY?.substring(0, 20) + '...');

async function testGoogleModels() {
  const models = [
    'gemini-pro', 
    'gemini-1.5-pro', 
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-latest'
  ];
  
  for (const model of models) {
    try {
      console.log(`Testing model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`;
      
      const response = await axios.post(url, {
        contents: [{
          parts: [{ text: 'Hello' }]
        }],
        generationConfig: {
          maxOutputTokens: 10
        }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log(`✅ ${model}: SUCCESS`);
      console.log('Response:', response.data.candidates[0].content.parts[0].text);
      return model; // Return working model
      
    } catch (error) {
      console.log(`❌ ${model}: ${error.response?.status || 'Network Error'}`);
      if (error.response?.status === 400) {
        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
  
  console.log('\n❌ No working Google models found');
  return null;
}

// Also test getting available models
async function listAvailableModels() {
  try {
    console.log('\n=== Checking Available Models ===');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`;
    
    const response = await axios.get(url, {
      timeout: 10000
    });
    
    console.log('Available models:');
    response.data.models?.forEach(model => {
      console.log(`  - ${model.name} (${model.displayName})`);
    });
    
  } catch (error) {
    console.log('❌ Could not list models:', error.response?.status || error.message);
  }
}

async function runTests() {
  await listAvailableModels();
  const workingModel = await testGoogleModels();
  
  if (workingModel) {
    console.log(`\n🎉 Success! Use model: ${workingModel}`);
  } else {
    console.log('\n💡 Suggestions:');
    console.log('1. Verify your API key is from Google AI Studio (not Cloud Console)');
    console.log('2. Check if the API key has the right permissions');  
    console.log('3. Ensure the Generative AI API is enabled');
  }
}

runTests().catch(console.error);