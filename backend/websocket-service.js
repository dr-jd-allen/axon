// AXON WebSocket Service - Fixed and Ready
const WebSocket = require('ws');
const EventEmitter = require('events');

class WebSocketService extends EventEmitter {
  constructor(server, config) {
    super();
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // -> WebSocket connections
    this.config = config || {};
    this.agents = {};
    this.conversations = {};
    this.llmService = require('./llm-service');
    
    // Initialize agents on construction
    this.initializeAgents();
    
    this.wss.on('connection', (ws, req) => {
      const userId = this.extractUserId(req);
      console.log(`New WebSocket connection from user: ${userId}`);
      this.handleConnection(ws, userId);
    });
  }
  
  initializeAgents() {
    // Ensure agents object exists
    if (!this.agents) {
      this.agents = {};
    }
    
    // Load from config if available
    if (this.config && this.config.agents) {
      this.config.agents.forEach(agent => {
        this.agents[agent.id] = agent;
      });
    }
    
    // Add default agents if none loaded
    if (Object.keys(this.agents).length === 0) {
      console.log('[INFO] Loading default agent configuration');
      this.agents = {
        'explorer': {
          id: 'explorer',
          name: 'Explorer',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20240620',
          systemPrompt: 'You are an explorer agent focused on discovering new insights.'
        },
        'synthesizer': {
          id: 'synthesizer',
          name: 'Synthesizer',
          provider: 'openai',
          model: 'gpt-4',
          systemPrompt: 'You are a synthesis agent focused on combining ideas.'
        },
        'orchestrator': {
          id: 'orchestrator',
          name: 'Orchestrator',
          provider: 'google',
          model: 'gemini-pro',
          systemPrompt: 'You are an orchestration agent managing collaboration.'
        }
      };
    }
    
    console.log(`[INFO] Initialized ${Object.keys(this.agents).length} agents`);
  }
  
  extractUserId(req) {
    // Extract from query params, headers, or generate
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('userId') || 
           req.headers['x-user-id'] || 
           `user-${Date.now()}`;
  }
  
  handleConnection(ws, userId) {
    // Ensure service is initialized
    if (!this.agents || Object.keys(this.agents).length === 0) {
      this.initializeAgents();
    }
    
    // Store client
    this.clients.set(userId, ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      userId: userId,
      agents: Object.keys(this.agents),
      message: 'Connected to AXON system'
    }));
    
    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await this.handleMessage(userId, data, ws);
      } catch (error) {
        console.error(`[ERROR] Message handling error:`, error);
        ws.send(JSON.stringify({
          type: 'error',
          error: error.message
        }));
      }
    });
    
    // Handle disconnect
    ws.on('close', () => {
      console.log(`User ${userId} disconnected`);
      this.clients.delete(userId);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error(`[ERROR] WebSocket error for ${userId}:`, error);
    });
  }
  
  async handleMessage(userId, data, ws) {
    const { type, sessionId, message, agentId } = data;
    
    switch (type) {
      case 'chat':
        await this.handleChatMessage(userId, sessionId, message, agentId, ws);
        break;
        
      case 'start-conversation':
        await this.startConversation(userId, data, ws);
        break;
        
      case 'get-status':
        this.sendStatus(ws);
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${type}`
        }));
    }
  }
  
  async handleChatMessage(userId, sessionId, message, agentId, ws) {
    try {
      // Validate inputs
      if (!userId || !sessionId || !message) {
        throw new Error('Missing required parameters');
      }
      
      // Ensure conversation exists
      if (!this.conversations[sessionId]) {
        console.log(`[INFO] Creating new conversation for session: ${sessionId}`);
        this.conversations[sessionId] = {
          messages: [],
          agents: Object.keys(this.agents),
          startTime: Date.now()
        };
      }
      
      const conversation = this.conversations[sessionId];
      
      // Get agent or use default
      const agent = this.agents[agentId] || Object.values(this.agents)[0];
      if (!agent) {
        throw new Error('No agents available');
      }
      
      // Add user message to conversation
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
      });
      
      // Build message history safely with null checks
      const messageHistory = (conversation.messages || [])
        .filter(msg => msg && msg.content)
        .map(msg => ({
          role: msg.role || 'user',
          content: msg.content
        }));
      
      // Generate response
      try {
        const response = await this.llmService.generateResponse(
          agent,
          messageHistory,
          process.env[`${agent.provider.toUpperCase()}_API_KEY`]
        );
        
        // Store assistant response
        conversation.messages.push({
          agentId: agent.id,
          agentName: agent.name,
          role: 'assistant',
          content: response.content || response,
          timestamp: Date.now()
        });
        
        // Send response to client
        ws.send(JSON.stringify({
          type: 'message',
          sessionId: sessionId,
          agent: agent.name,
          content: response.content || response,
          timestamp: Date.now()
        }));
        
      } catch (llmError) {
        console.error(`[ERROR] LLM generation failed:`, llmError);
        
        // Send error but keep conversation alive
        ws.send(JSON.stringify({
          type: 'error',
          error: `Agent ${agent.name} error: ${llmError.message}`,
          recoverable: true
        }));
      }
      
    } catch (error) {
      console.error(`[ERROR] handleChatMessage failed:`, error);
      
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message,
        recoverable: false
      }));
    }
  }
  
  async startConversation(userId, data, ws) {
    const { sessionId, topic, agents } = data;
    
    // Create new conversation
    this.conversations[sessionId] = {
      messages: [],
      agents: agents || Object.keys(this.agents),
      topic: topic,
      startTime: Date.now()
    };
    
    ws.send(JSON.stringify({
      type: 'conversation-start',
      sessionId: sessionId,
      agents: this.conversations[sessionId].agents,
      message: 'Conversation started'
    }));
    
    // Emit event for other systems
    this.emit('conversation-started', {
      userId,
      sessionId,
      topic
    });
  }
  
  sendStatus(ws) {
    const status = {
      type: 'status',
      agents: Object.keys(this.agents).length,
      activeConversations: Object.keys(this.conversations).length,
      connectedClients: this.clients.size,
      uptime: process.uptime()
    };
    
    ws.send(JSON.stringify(status));
  }
  
  // Broadcast to all clients
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((ws, userId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
  
  // Send to specific user
  sendToUser(userId, message) {
    const ws = this.clients.get(userId);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

module.exports = WebSocketService;