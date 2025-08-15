// API Key Management Service
// Handles secure storage and retrieval of API keys

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class ApiKeyService {
  constructor() {
    this.encryptionEnabled = process.env.ENABLE_API_KEY_ENCRYPTION === 'true';
    this.encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET || 'default-secret-change-me';
    this.algorithm = 'aes-256-cbc';
    this.defaultKeys = this.loadDefaultKeys();
  }

  // Load default API keys from environment
  loadDefaultKeys() {
    return {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_API_KEY,
      // Agent-specific keys (fallback to provider keys)
      generalist: process.env.GENERALIST_API_KEY || process.env.OPENAI_API_KEY,
      researcher: process.env.RESEARCHER_API_KEY || process.env.OPENAI_API_KEY,
      coder: process.env.CODER_API_KEY || process.env.OPENAI_API_KEY,
      analyst: process.env.ANALYST_API_KEY || process.env.OPENAI_API_KEY,
      teacher: process.env.TEACHER_API_KEY || process.env.OPENAI_API_KEY,
      explorer: process.env.EXPLORER_API_KEY || process.env.OPENAI_API_KEY,
      synthesizer: process.env.SYNTHESIZER_API_KEY || process.env.GOOGLE_API_KEY,
      philosopher: process.env.PHILOSOPHER_API_KEY || process.env.ANTHROPIC_API_KEY
    };
  }

  // Encrypt an API key
  encrypt(text) {
    if (!this.encryptionEnabled || !text) return text;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.encryptionSecret.padEnd(32, '0').slice(0, 32)),
      iv
    );
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  // Decrypt an API key
  decrypt(text) {
    if (!this.encryptionEnabled || !text || !text.includes(':')) return text;
    
    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionSecret.padEnd(32, '0').slice(0, 32)),
        iv
      );
      
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString();
    } catch (error) {
      console.error('Decryption error:', error);
      return text; // Return original if decryption fails
    }
  }

  // Get API key for a specific provider or agent type
  getApiKey(type, userProvidedKey = null) {
    // If user provided a key, use it (for backward compatibility)
    if (userProvidedKey) {
      return userProvidedKey;
    }
    
    // Map agent types to providers
    const providerMap = {
      generalist: 'openai',
      researcher: 'openai',
      coder: 'openai',
      analyst: 'openai',
      teacher: 'openai',
      // Direct provider names
      openai: 'openai',
      anthropic: 'anthropic',
      google: 'google',
      gemini: 'google'
    };
    
    // Get the appropriate key
    const provider = providerMap[type] || type;
    const key = this.defaultKeys[type] || this.defaultKeys[provider];
    
    if (!key) {
      throw new Error(`No API key configured for ${type}. Please set it in environment variables.`);
    }
    
    return key;
  }

  // Get provider from model name
  getProviderFromModel(model) {
    if (model.includes('gpt') || model.includes('o1') || model.includes('o3') || model.includes('o4')) {
      return 'openai';
    } else if (model.includes('claude')) {
      return 'anthropic';
    } else if (model.includes('gemini')) {
      return 'google';
    }
    return null;
  }

  // Validate API key format
  validateApiKey(key, provider) {
    if (!key || typeof key !== 'string') return false;
    
    // Basic validation patterns
    const patterns = {
      openai: /^sk-[a-zA-Z0-9]{48,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9]{40,}$/,
      google: /^[a-zA-Z0-9_-]{39}$/
    };
    
    const pattern = patterns[provider];
    if (!pattern) return true; // Allow unknown providers
    
    return pattern.test(key);
  }

  // Save encrypted API keys to file (for settings persistence)
  async saveUserKeys(userId, keys) {
    try {
      const keysDir = path.join(__dirname, 'user-keys');
      await fs.mkdir(keysDir, { recursive: true });
      
      const encryptedKeys = {};
      for (const [type, key] of Object.entries(keys)) {
        if (key) {
          encryptedKeys[type] = this.encrypt(key);
        }
      }
      
      const filePath = path.join(keysDir, `${userId}.json`);
      await fs.writeFile(filePath, JSON.stringify(encryptedKeys, null, 2));
      console.log(`API keys saved successfully for user ${userId}`);
    } catch (error) {
      console.error('Error saving API keys:', error);
      throw error;
    }
  }

  // Load encrypted API keys from file
  async loadUserKeys(userId) {
    try {
      const filePath = path.join(__dirname, 'user-keys', `${userId}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const encryptedKeys = JSON.parse(data);
      
      const decryptedKeys = {};
      for (const [type, key] of Object.entries(encryptedKeys)) {
        decryptedKeys[type] = this.decrypt(key);
      }
      
      return decryptedKeys;
    } catch (error) {
      // Return empty object if file doesn't exist
      return {};
    }
  }

  // Alias for saveUserKeys for backward compatibility
  async saveApiKeys(userId, keys) {
    return this.saveUserKeys(userId, keys);
  }

  // Get API key status for all providers
  getApiKeyStatus(userId) {
    const status = {};
    const providers = ['openai', 'anthropic', 'google'];
    
    providers.forEach(provider => {
      const envKey = this.defaultKeys[provider];
      const masked = envKey ? this.maskApiKey(envKey) : null;
      
      status[provider] = {
        configured: !!envKey,
        source: envKey ? 'environment' : 'not configured',
        masked: masked
      };
    });
    
    return status;
  }

  // Check if any API keys are configured
  hasAnyKeys() {
    return Object.values(this.defaultKeys).some(key => key && key !== '');
  }

  // Get configured providers
  getConfiguredProviders() {
    const providers = [];
    if (this.defaultKeys.openai) providers.push('openai');
    if (this.defaultKeys.anthropic) providers.push('anthropic');
    if (this.defaultKeys.google) providers.push('google');
    return providers;
  }

  // Mask API key for display
  maskApiKey(key) {
    if (!key || key.length < 8) return '***';
    return key.slice(0, 4) + '...' + key.slice(-4);
  }
}

module.exports = new ApiKeyService();