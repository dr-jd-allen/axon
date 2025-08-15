// Cache Service for AXON
// Implements response caching to improve performance and reduce API calls

const crypto = require('crypto');

class CacheService {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 3600000; // Default 1 hour
    this.maxSize = options.maxSize || 1000;
    this.enabled = process.env.ENABLE_RESPONSE_CACHE === 'true';
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // Every 5 minutes
  }

  // Generate cache key from request parameters
  generateKey(model, messages, parameters) {
    const data = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      parameters: {
        temperature: parameters.temperature,
        topP: parameters.topP,
        maxTokens: parameters.maxTokens
      }
    };
    
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  // Get cached response
  get(model, messages, parameters) {
    if (!this.enabled) return null;
    
    const key = this.generateKey(model, messages, parameters);
    const cached = this.cache.get(key);
    
    if (cached) {
      // Check if expired
      if (Date.now() - cached.timestamp > this.ttl) {
        this.cache.delete(key);
        return null;
      }
      
      // Update access time for LRU
      cached.lastAccess = Date.now();
      return cached.response;
    }
    
    return null;
  }

  // Set cached response
  set(model, messages, parameters, response) {
    if (!this.enabled) return;
    
    const key = this.generateKey(model, messages, parameters);
    
    // Check cache size and evict if necessary
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      model
    });
  }

  // Evict least recently used entry
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccess < oldestTime) {
        oldestTime = value.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Clear all cache
  clear() {
    this.cache.clear();
  }

  // Get cache statistics
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      entries: entries.map(entry => ({
        model: entry.model,
        age: now - entry.timestamp,
        lastAccess: now - entry.lastAccess
      }))
    };
  }

  // Destroy cache service
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Create singleton instance
let cacheInstance = null;

module.exports = {
  getInstance: (options) => {
    if (!cacheInstance) {
      cacheInstance = new CacheService(options);
    }
    return cacheInstance;
  },
  
  CacheService
};