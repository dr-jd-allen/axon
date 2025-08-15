// AXON Health Monitoring Service
// Real-time system health, performance metrics, and intelligent diagnostics

const express = require('express');
const EventEmitter = require('events');
const WebSocket = require('ws');

class HealthMonitorService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3006,
      checkInterval: config.checkInterval || 10000, // 10 seconds
      alertThresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 0.1, // 10% error rate
        memoryUsage: 0.8, // 80% memory
        consensusRate: 0.3, // 30% minimum consensus
        ...config.alertThresholds
      },
      ...config
    };
    
    // Metrics storage
    this.metrics = {
      system: {
        uptime: Date.now(),
        health: 1.0,
        status: 'healthy'
      },
      agents: new Map(),
      orchestration: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        strategies: new Map()
      },
      memory: {
        usage: 0,
        collections: {},
        cacheHitRate: 0
      },
      circuitBreakers: new Map(),
      rateLimits: new Map(),
      websockets: {
        activeConnections: 0,
        totalMessages: 0,
        reconnections: 0
      }
    };
    
    // Alert history
    this.alerts = [];
    this.maxAlerts = 100;
    
    // Initialize HTTP server
    this.app = express();
    this.server = null;
    this.wss = null;
    
    this.setupEndpoints();
    this.initialize();
  }
  
  async initialize() {
    // Start HTTP server
    this.server = this.app.listen(this.config.port, () => {
      console.log(`Health Monitor running on http://localhost:${this.config.port}`);
    });
    
    // Start WebSocket server for real-time updates
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      console.log('Health monitor client connected');
      
      // Send initial status
      ws.send(JSON.stringify({
        type: 'initial',
        data: this.getFullStatus()
      }));
      
      // Set up real-time updates
      const updateInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'update',
            data: this.getRealtimeMetrics()
          }));
        }
      }, 1000);
      
      ws.on('close', () => {
        clearInterval(updateInterval);
      });
    });
    
    // Start monitoring
    this.startMonitoring();
  }
  
  setupEndpoints() {
    // Serve monitoring dashboard
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const status = this.getSystemHealth();
      res.status(status.healthy ? 200 : 503).json(status);
    });
    
    // Detailed metrics
    this.app.get('/metrics', (req, res) => {
      res.json(this.getFullStatus());
    });
    
    // Agent-specific metrics
    this.app.get('/metrics/agents/:agentId', (req, res) => {
      const agentMetrics = this.metrics.agents.get(req.params.agentId);
      if (agentMetrics) {
        res.json(agentMetrics);
      } else {
        res.status(404).json({ error: 'Agent not found' });
      }
    });
    
    // Circuit breaker status
    this.app.get('/metrics/circuit-breakers', (req, res) => {
      res.json(Array.from(this.metrics.circuitBreakers.entries()));
    });
    
    // Rate limit status
    this.app.get('/metrics/rate-limits', (req, res) => {
      res.json(Array.from(this.metrics.rateLimits.entries()));
    });
    
    // Alert history
    this.app.get('/alerts', (req, res) => {
      res.json(this.alerts);
    });
    
    // Performance recommendations
    this.app.get('/recommendations', (req, res) => {
      res.json(this.generateRecommendations());
    });
  }
  
  startMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);
  }
  
  async performHealthCheck() {
    try {
      // Check orchestration service
      await this.checkOrchestrationHealth();
      
      // Check memory system
      await this.checkMemoryHealth();
      
      // Check circuit breakers
      await this.checkCircuitBreakers();
      
      // Check rate limits
      await this.checkRateLimits();
      
      // Check WebSocket connections
      await this.checkWebSocketHealth();
      
      // Calculate overall health
      this.calculateOverallHealth();
      
      // Check for alerts
      this.checkAlertConditions();
      
      // Emit health update
      this.emit('health-update', this.metrics.system);
      
    } catch (error) {
      console.error('Health check error:', error);
      this.addAlert('error', 'Health check failed', error.message);
    }
  }
  
  async checkOrchestrationHealth() {
    try {
      const orchestrationService = require('./orchestration-service');
      const status = orchestrationService.getAllStatus();
      
      this.metrics.orchestration.activeOrchestrations = status.length;
      
      // Update strategy usage
      status.forEach(orch => {
        const count = this.metrics.orchestration.strategies.get(orch.strategy) || 0;
        this.metrics.orchestration.strategies.set(orch.strategy, count + 1);
      });
      
    } catch (error) {
      this.metrics.orchestration.status = 'error';
    }
  }
  
  async checkMemoryHealth() {
    try {
      const { EnhancedMemorySystem } = require('./enhanced-memory-system');
      const memorySystem = new EnhancedMemorySystem();
      const report = memorySystem.generateMemoryReport();
      
      // Calculate memory usage
      const process = require('process');
      const usage = process.memoryUsage();
      
      this.metrics.memory = {
        usage: usage.heapUsed / usage.heapTotal,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        collections: {
          agents: report.statistics.totalAgents,
          conversations: report.statistics.totalConversations,
          goals: report.statistics.totalGoals,
          facts: report.statistics.sharedFacts
        },
        effectiveness: report.statistics.effectiveness
      };
      
    } catch (error) {
      this.metrics.memory.status = 'error';
    }
  }
  
  async checkCircuitBreakers() {
    try {
      const { CircuitBreakerManager } = require('./circuit-breaker');
      const status = CircuitBreakerManager.getStatus();
      
      this.metrics.circuitBreakers.clear();
      Object.entries(status).forEach(([name, breaker]) => {
        this.metrics.circuitBreakers.set(name, {
          state: breaker.state,
          failures: breaker.failures,
          successRate: breaker.successRate,
          lastFailure: breaker.lastFailureTime
        });
        
        // Alert on open circuit breakers
        if (breaker.state === 'OPEN') {
          this.addAlert('warning', `Circuit breaker ${name} is OPEN`, {
            failures: breaker.failures,
            nextAttempt: breaker.nextAttempt
          });
        }
      });
      
    } catch (error) {
      console.error('Circuit breaker check failed:', error);
    }
  }
  
  async checkRateLimits() {
    try {
      const llmService = require('./llm-service');
      const rateLimits = llmService.getRateLimitStatus();
      
      this.metrics.rateLimits.clear();
      Object.entries(rateLimits).forEach(([provider, limit]) => {
        this.metrics.rateLimits.set(provider, {
          available: limit.available,
          capacity: limit.capacity,
          usage: 1 - (limit.available / limit.capacity)
        });
        
        // Alert on high usage
        if (limit.available < limit.capacity * 0.1) {
          this.addAlert('warning', `Rate limit near exhaustion for ${provider}`, {
            available: limit.available,
            capacity: limit.capacity
          });
        }
      });
      
    } catch (error) {
      console.error('Rate limit check failed:', error);
    }
  }
  
  async checkWebSocketHealth() {
    try {
      // Check main WebSocket service
      const wsService = require('./websocket-service');
      
      this.metrics.websockets = {
        activeConnections: wsService.clients?.size || 0,
        activeConversations: wsService.activeConversations?.size || 0,
        status: 'healthy'
      };
      
    } catch (error) {
      this.metrics.websockets.status = 'error';
    }
  }
  
  calculateOverallHealth() {
    const factors = [];
    
    // Response time factor
    if (this.metrics.orchestration.avgResponseTime > 0) {
      factors.push(Math.max(0, 1 - (this.metrics.orchestration.avgResponseTime / this.config.alertThresholds.responseTime)));
    }
    
    // Success rate factor
    if (this.metrics.orchestration.totalRequests > 0) {
      const successRate = this.metrics.orchestration.successfulRequests / this.metrics.orchestration.totalRequests;
      factors.push(successRate);
    }
    
    // Memory usage factor
    factors.push(1 - this.metrics.memory.usage);
    
    // Circuit breaker factor
    const openBreakers = Array.from(this.metrics.circuitBreakers.values())
      .filter(b => b.state === 'OPEN').length;
    const totalBreakers = this.metrics.circuitBreakers.size || 1;
    factors.push(1 - (openBreakers / totalBreakers));
    
    // Calculate weighted average
    const health = factors.length > 0 
      ? factors.reduce((a, b) => a + b, 0) / factors.length 
      : 1;
    
    this.metrics.system.health = health;
    this.metrics.system.status = this.getHealthStatus(health);
  }
  
  getHealthStatus(health) {
    if (health > 0.8) return 'healthy';
    if (health > 0.6) return 'degraded';
    if (health > 0.4) return 'unhealthy';
    return 'critical';
  }
  
  checkAlertConditions() {
    // Check response time
    if (this.metrics.orchestration.avgResponseTime > this.config.alertThresholds.responseTime) {
      this.addAlert('warning', 'High response time', {
        current: this.metrics.orchestration.avgResponseTime,
        threshold: this.config.alertThresholds.responseTime
      });
    }
    
    // Check error rate
    if (this.metrics.orchestration.totalRequests > 0) {
      const errorRate = this.metrics.orchestration.failedRequests / this.metrics.orchestration.totalRequests;
      if (errorRate > this.config.alertThresholds.errorRate) {
        this.addAlert('error', 'High error rate', {
          current: errorRate,
          threshold: this.config.alertThresholds.errorRate
        });
      }
    }
    
    // Check memory usage
    if (this.metrics.memory.usage > this.config.alertThresholds.memoryUsage) {
      this.addAlert('warning', 'High memory usage', {
        current: this.metrics.memory.usage,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }
    
    // Check system health
    if (this.metrics.system.health < 0.5) {
      this.addAlert('critical', 'System health critical', {
        health: this.metrics.system.health,
        status: this.metrics.system.status
      });
    }
  }
  
  addAlert(severity, message, details = {}) {
    const alert = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      severity,
      message,
      details
    };
    
    this.alerts.unshift(alert);
    
    // Limit alert history
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }
    
    // Emit alert
    this.emit('alert', alert);
    
    // Broadcast to WebSocket clients
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'alert',
            data: alert
          }));
        }
      });
    }
  }
  
  updateAgentMetrics(agentId, metrics) {
    this.metrics.agents.set(agentId, {
      ...this.metrics.agents.get(agentId),
      ...metrics,
      lastUpdate: Date.now()
    });
  }
  
  updateOrchestrationMetrics(event) {
    this.metrics.orchestration.totalRequests++;
    
    if (event.success) {
      this.metrics.orchestration.successfulRequests++;
    } else {
      this.metrics.orchestration.failedRequests++;
    }
    
    // Update average response time
    if (event.responseTime) {
      const alpha = 0.1; // Exponential moving average factor
      this.metrics.orchestration.avgResponseTime = 
        this.metrics.orchestration.avgResponseTime * (1 - alpha) + 
        event.responseTime * alpha;
    }
  }
  
  getSystemHealth() {
    return {
      healthy: this.metrics.system.health > 0.5,
      status: this.metrics.system.status,
      health: this.metrics.system.health,
      uptime: Date.now() - this.metrics.system.uptime,
      components: {
        orchestration: this.metrics.orchestration.status || 'unknown',
        memory: this.metrics.memory.status || 'unknown',
        websockets: this.metrics.websockets.status || 'unknown'
      }
    };
  }
  
  getFullStatus() {
    return {
      system: this.metrics.system,
      orchestration: {
        ...this.metrics.orchestration,
        strategies: Array.from(this.metrics.orchestration.strategies.entries())
      },
      memory: this.metrics.memory,
      circuitBreakers: Array.from(this.metrics.circuitBreakers.entries()),
      rateLimits: Array.from(this.metrics.rateLimits.entries()),
      websockets: this.metrics.websockets,
      agents: Array.from(this.metrics.agents.entries()),
      recentAlerts: this.alerts.slice(0, 10)
    };
  }
  
  getRealtimeMetrics() {
    return {
      timestamp: Date.now(),
      health: this.metrics.system.health,
      status: this.metrics.system.status,
      orchestration: {
        active: this.metrics.orchestration.activeOrchestrations || 0,
        avgResponseTime: this.metrics.orchestration.avgResponseTime
      },
      memory: {
        usage: this.metrics.memory.usage,
        effectiveness: this.metrics.memory.effectiveness
      },
      alerts: this.alerts.filter(a => Date.now() - a.id < 60000).length // Last minute
    };
  }
  
  generateRecommendations() {
    const recommendations = [];
    
    // Response time recommendations
    if (this.metrics.orchestration.avgResponseTime > 3000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        issue: 'High average response time',
        recommendation: 'Consider using parallel orchestration strategy or adding model fallbacks',
        impact: 'Could reduce response time by up to 50%'
      });
    }
    
    // Memory recommendations
    if (this.metrics.memory.usage > 0.7) {
      recommendations.push({
        category: 'memory',
        priority: 'medium',
        issue: 'High memory usage',
        recommendation: 'Enable memory cleanup and limit conversation history to last 100 sessions',
        impact: 'Could reduce memory usage by 30-40%'
      });
    }
    
    // Circuit breaker recommendations
    const openBreakers = Array.from(this.metrics.circuitBreakers.values())
      .filter(b => b.state === 'OPEN');
    
    if (openBreakers.length > 0) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        issue: `${openBreakers.length} circuit breakers are open`,
        recommendation: 'Check API keys and model availability, consider adding more fallback models',
        impact: 'Will restore service availability'
      });
    }
    
    // Strategy recommendations
    const strategies = Array.from(this.metrics.orchestration.strategies.entries());
    if (strategies.length > 0) {
      const mostUsed = strategies.sort((a, b) => b[1] - a[1])[0];
      
      if (mostUsed[0] === 'sequential' && this.metrics.orchestration.avgResponseTime > 4000) {
        recommendations.push({
          category: 'optimization',
          priority: 'medium',
          issue: 'Sequential strategy causing delays',
          recommendation: 'Switch to parallel strategy for multi-agent conversations',
          impact: 'Could reduce response time by 60-70%'
        });
      }
    }
    
    // Rate limit recommendations
    const criticalLimits = Array.from(this.metrics.rateLimits.entries())
      .filter(([_, limit]) => limit.usage > 0.8);
    
    if (criticalLimits.length > 0) {
      recommendations.push({
        category: 'capacity',
        priority: 'high',
        issue: 'Rate limits near exhaustion',
        recommendation: 'Implement request queuing or add alternative provider API keys',
        impact: 'Prevent service interruptions'
      });
    }
    
    return recommendations;
  }
  
  generateDashboardHTML() {
    return `<!DOCTYPE html>
<html>
<head>
  <title>AXON Health Monitor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1600px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      color: white;
      margin-bottom: 30px;
    }
    h1 { font-size: 2.5em; margin-bottom: 10px; }
    .dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: white;
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .card h3 {
      color: #667eea;
      margin-bottom: 15px;
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 10px;
    }
    .metric {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f5f5f5;
    }
    .metric-value {
      font-weight: bold;
      color: #764ba2;
    }
    .health-bar {
      height: 30px;
      background: #f0f0f0;
      border-radius: 15px;
      overflow: hidden;
      margin: 10px 0;
    }
    .health-fill {
      height: 100%;
      transition: width 0.3s, background 0.3s;
    }
    .status-healthy { background: #4caf50; }
    .status-degraded { background: #ff9800; }
    .status-unhealthy { background: #f44336; }
    .status-critical { background: #9c27b0; }
    .alert {
      padding: 10px;
      margin: 5px 0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .alert-warning { background: #fff3cd; color: #856404; }
    .alert-error { background: #f8d7da; color: #721c24; }
    .alert-critical { background: #e7c3c9; color: #491217; }
    .recommendation {
      padding: 15px;
      margin: 10px 0;
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
      border-radius: 4px;
    }
    .chart-container {
      height: 200px;
      margin: 20px 0;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="container">
    <header>
      <h1>AXON Health Monitor</h1>
      <p>Real-time System Health & Performance Metrics</p>
    </header>
    
    <div class="dashboard">
      <!-- System Health -->
      <div class="card">
        <h3>System Health</h3>
        <div class="health-bar">
          <div class="health-fill" id="health-bar" style="width: 0%"></div>
        </div>
        <div class="metric">
          <span>Status</span>
          <span class="metric-value" id="system-status">Loading...</span>
        </div>
        <div class="metric">
          <span>Uptime</span>
          <span class="metric-value" id="uptime">0s</span>
        </div>
      </div>
      
      <!-- Orchestration Metrics -->
      <div class="card">
        <h3>Orchestration</h3>
        <div class="metric">
          <span>Active Sessions</span>
          <span class="metric-value" id="active-sessions">0</span>
        </div>
        <div class="metric">
          <span>Avg Response Time</span>
          <span class="metric-value" id="avg-response">0ms</span>
        </div>
        <div class="metric">
          <span>Success Rate</span>
          <span class="metric-value" id="success-rate">100%</span>
        </div>
      </div>
      
      <!-- Memory Usage -->
      <div class="card">
        <h3>Memory System</h3>
        <div class="metric">
          <span>Usage</span>
          <span class="metric-value" id="memory-usage">0%</span>
        </div>
        <div class="metric">
          <span>Conversations</span>
          <span class="metric-value" id="conversations">0</span>
        </div>
        <div class="metric">
          <span>Effectiveness</span>
          <span class="metric-value" id="effectiveness">0%</span>
        </div>
      </div>
      
      <!-- Circuit Breakers -->
      <div class="card">
        <h3>Circuit Breakers</h3>
        <div id="circuit-breakers"></div>
      </div>
      
      <!-- Recent Alerts -->
      <div class="card" style="grid-column: span 2;">
        <h3>Recent Alerts</h3>
        <div id="alerts"></div>
      </div>
      
      <!-- Recommendations -->
      <div class="card" style="grid-column: span 2;">
        <h3>Performance Recommendations</h3>
        <div id="recommendations"></div>
      </div>
      
      <!-- Real-time Chart -->
      <div class="card" style="grid-column: span 3;">
        <h3>Performance Timeline</h3>
        <canvas id="performance-chart"></canvas>
      </div>
    </div>
  </div>
  
  <script>
    const ws = new WebSocket('ws://localhost:3006');
    const performanceData = {
      labels: [],
      datasets: [{
        label: 'Health',
        data: [],
        borderColor: '#4caf50',
        tension: 0.1
      }, {
        label: 'Response Time (s)',
        data: [],
        borderColor: '#ff9800',
        tension: 0.1
      }]
    };
    
    const chart = new Chart(document.getElementById('performance-chart'), {
      type: 'line',
      data: performanceData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 5
          }
        }
      }
    });
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'initial') {
        updateDashboard(message.data);
      } else if (message.type === 'update') {
        updateRealtime(message.data);
      } else if (message.type === 'alert') {
        addAlert(message.data);
      }
    };
    
    function updateDashboard(data) {
      // Update all metrics
      updateRealtime(data);
      
      // Load recommendations
      fetch('/recommendations')
        .then(r => r.json())
        .then(recommendations => {
          const container = document.getElementById('recommendations');
          container.innerHTML = recommendations.map(r => \`
            <div class="recommendation">
              <strong>\${r.issue}</strong><br>
              \${r.recommendation}<br>
              <small>Impact: \${r.impact}</small>
            </div>
          \`).join('');
        });
    }
    
    function updateRealtime(data) {
      // Update health bar
      const healthBar = document.getElementById('health-bar');
      const health = (data.health || 0) * 100;
      healthBar.style.width = health + '%';
      healthBar.className = 'health-fill status-' + (data.status || 'unknown');
      
      // Update metrics
      document.getElementById('system-status').textContent = data.status || 'Unknown';
      document.getElementById('active-sessions').textContent = data.orchestration?.active || 0;
      document.getElementById('avg-response').textContent = 
        Math.round(data.orchestration?.avgResponseTime || 0) + 'ms';
      document.getElementById('memory-usage').textContent = 
        Math.round((data.memory?.usage || 0) * 100) + '%';
      document.getElementById('effectiveness').textContent = 
        Math.round((data.memory?.effectiveness || 0) * 100) + '%';
      
      // Update chart
      const now = new Date().toLocaleTimeString();
      performanceData.labels.push(now);
      performanceData.datasets[0].data.push(data.health || 0);
      performanceData.datasets[1].data.push((data.orchestration?.avgResponseTime || 0) / 1000);
      
      if (performanceData.labels.length > 30) {
        performanceData.labels.shift();
        performanceData.datasets.forEach(d => d.data.shift());
      }
      
      chart.update();
    }
    
    function addAlert(alert) {
      const container = document.getElementById('alerts');
      const alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-' + alert.severity;
      alertDiv.innerHTML = \`
        <strong>\${alert.message}</strong>
        <small>\${new Date(alert.timestamp).toLocaleTimeString()}</small>
      \`;
      container.insertBefore(alertDiv, container.firstChild);
      
      // Keep only last 5 alerts
      while (container.children.length > 5) {
        container.removeChild(container.lastChild);
      }
    }
    
    // Update uptime
    setInterval(() => {
      const uptime = document.getElementById('uptime');
      const current = parseInt(uptime.textContent) || 0;
      uptime.textContent = (current + 1) + 's';
    }, 1000);
  </script>
</body>
</html>`;
  }
}

module.exports = HealthMonitorService;