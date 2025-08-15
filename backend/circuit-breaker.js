// Circuit Breaker Pattern for AXON LLM Services
// Provides automatic failure detection and recovery for LLM API calls

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minute
    this.fallbackFunction = options.fallbackFunction || null;
    
    // Circuit states
    this.STATES = {
      CLOSED: 'CLOSED',     // Normal operation
      OPEN: 'OPEN',         // Failing, reject requests
      HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
    };
    
    // Initial state
    this.state = this.STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.requests = [];
  }

  async execute(fn, ...args) {
    // Check circuit state
    if (this.state === this.STATES.OPEN) {
      if (Date.now() < this.nextAttempt) {
        // Still in timeout period
        if (this.fallbackFunction) {
          return await this.fallbackFunction(...args);
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN. Service unavailable.`);
      }
      // Try half-open state
      this.state = this.STATES.HALF_OPEN;
    }

    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    
    if (this.state === this.STATES.HALF_OPEN) {
      // Service recovered
      this.state = this.STATES.CLOSED;
      console.log(`Circuit breaker ${this.name} recovered - state: CLOSED`);
    }
    
    this.successes++;
    this.recordRequest(true);
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.recordRequest(false);
    
    if (this.failures >= this.failureThreshold) {
      this.trip();
    }
  }

  trip() {
    this.state = this.STATES.OPEN;
    this.nextAttempt = Date.now() + this.resetTimeout;
    console.log(`Circuit breaker ${this.name} tripped - state: OPEN. Will retry at ${new Date(this.nextAttempt).toISOString()}`);
  }

  recordRequest(success) {
    const now = Date.now();
    this.requests.push({ timestamp: now, success });
    
    // Clean old requests outside monitoring period
    this.requests = this.requests.filter(
      req => now - req.timestamp < this.monitoringPeriod
    );
  }

  getStatus() {
    const now = Date.now();
    const recentRequests = this.requests.filter(
      req => now - req.timestamp < this.monitoringPeriod
    );
    
    const successCount = recentRequests.filter(req => req.success).length;
    const totalCount = recentRequests.length;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;
    
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      successRate: successRate.toFixed(2) + '%',
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      nextAttempt: this.nextAttempt && this.state === this.STATES.OPEN 
        ? new Date(this.nextAttempt).toISOString() 
        : null
    };
  }

  reset() {
    this.state = this.STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.requests = [];
    console.log(`Circuit breaker ${this.name} manually reset`);
  }
}

// Circuit Breaker Manager for multiple services
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  // Get or create a circuit breaker for a service
  getBreaker(serviceName, options = {}) {
    if (!this.breakers.has(serviceName)) {
      const breaker = new CircuitBreaker({
        name: serviceName,
        ...options
      });
      this.breakers.set(serviceName, breaker);
    }
    return this.breakers.get(serviceName);
  }

  create(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name);
  }

  get(name) {
    return this.breakers.get(name);
  }

  getStatus() {
    const status = {};
    this.breakers.forEach((breaker, name) => {
      status[name] = breaker.getStatus();
    });
    return status;
  }

  resetAll() {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Export singleton instance
const manager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager: manager
};