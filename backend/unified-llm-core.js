// AXON Unified LLM Core - The Single Source of Truth
// Merges autonomous-core.js with backend orchestration
// This replaces ALL direct API calls with intelligent orchestration

const EventEmitter = require('events');
const { CircuitBreakerManager } = require('./circuit-breaker');
const { EnhancedMemorySystem } = require('./enhanced-memory-system');
const PromptManager = require('./prompt-manager');

/**
 * UnifiedAgent - The ultimate LLM agent implementation
 * Combines autonomous behavior with orchestrated intelligence
 */
class UnifiedAgent extends EventEmitter {
  constructor(config) {
    super();
    
    this.id = config.id;
    this.name = config.name;
    this.model = config.model;
    this.provider = config.provider;
    
    // Personality and memory
    this.memory = null; // Will be linked to memory system
    this.personality = {
      traits: new Map(),
      evolution: [],
      currentState: 'nascent'
    };
    
    // Cognitive architecture
    this.cognitive = {
      attentionWindow: [],
      workingMemory: new Map(),
      intentions: [],
      beliefs: new Map(),
      currentFocus: null
    };
    
    // Performance tracking
    this.metrics = {
      responseTimes: [],
      successRate: 0,
      consensusRate: 0,
      creativity: 0,
      analyticalDepth: 0
    };
    
    // Circuit breaker for this agent
    this.circuitBreaker = CircuitBreakerManager.create(`agent-${this.id}`, {
      failureThreshold: 3,
      resetTimeout: 30000,
      fallbackFunction: this.fallbackResponse.bind(this)
    });
    
    // Model fallback chains
    this.fallbackChain = this.establishFallbackChain();
  }
  
  /**
   * Establish fallback chain based on primary model
   */
  establishFallbackChain() {
    const chains = {
      // OpenAI fallbacks (updated for August 2025)
      'gpt-4.5-research-preview': ['gpt-4.1-latest', 'gpt-4o'],
      'gpt-4.1-latest': ['gpt-4o'],
      'gpt-4o': ['o1-preview', 'o1-mini'],
      'o3-pro': ['o3-pro-deep-research', 'o1-preview', 'gpt-4o'],
      'o4-mini-deep-research': ['o3-pro', 'gpt-4o'],
      
      // Anthropic fallbacks
      'claude-opus-4-20250514': ['claude-sonnet-4-20250514', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
      'claude-sonnet-4-20250514': ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
      'claude-3-opus-20240229': ['claude-3-sonnet-20240229', 'claude-2.1'],
      
      // Google fallbacks
      'gemini-2.5-pro': ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-pro'],
      'gemini-2.5-flash': ['gemini-2.5-flash-lite', 'gemini-pro'],
      
      // Cross-provider ultimate fallbacks
      'default': ['gpt-4-turbo', 'claude-3-sonnet-20240229', 'gemini-2.5-flash']
    };
    
    return chains[this.model] || chains.default;
  }
  
  /**
   * Link to memory system
   */
  linkMemorySystem(memorySystem, sessionId) {
    this.memory = memorySystem.getModelMemory(this.id, this.name);
    this.sessionId = sessionId;
    
    // Load personality from memory
    if (this.memory.personality.traits.size > 0) {
      this.personality.traits = this.memory.personality.traits;
      this.personality.currentState = this.memory.calculateEvolutionStage(
        this.memory.reinforcement.rewards.length
      );
    }
  }
  
  /**
   * Process message with full cognitive pipeline
   */
  async processMessage(message, context = {}) {
    const startTime = Date.now();
    
    try {
      // 1. Update attention and working memory
      this.updateAttention(message, context);
      
      // 2. Check memory for relevant context
      const memoryContext = await this.retrieveRelevantMemory(message);
      
      // 3. Form intention based on message and context
      const intention = this.formIntention(message, memoryContext, context);
      
      // 4. Generate response through circuit breaker
      const response = await this.circuitBreaker.execute(async () => {
        return await this.generateResponseWithFallback(
          message, 
          intention, 
          memoryContext, 
          context
        );
      });
      
      // 5. Update metrics and memory
      this.updateMetrics(Date.now() - startTime, true);
      await this.updateMemory(message, response, context);
      
      // 6. Emit cognitive state
      this.emit('cognitive-state', {
        agent: this.id,
        attention: this.cognitive.currentFocus,
        intention: intention.type,
        confidence: response.confidence || 0.5,
        memoryActivation: memoryContext.relevance || 0
      });
      
      return response;
      
    } catch (error) {
      this.updateMetrics(Date.now() - startTime, false);
      console.error(`[${this.name}] Processing error:`, error);
      
      // Try fallback
      return await this.fallbackResponse(message, context);
    }
  }
  
  /**
   * Update attention mechanism
   */
  updateAttention(message, context) {
    // Add to attention window
    this.cognitive.attentionWindow.push({
      content: message,
      timestamp: Date.now(),
      salience: this.calculateSalience(message, context)
    });
    
    // Maintain window size
    if (this.cognitive.attentionWindow.length > 10) {
      this.cognitive.attentionWindow.shift();
    }
    
    // Update current focus
    this.cognitive.currentFocus = this.extractFocus(message, context);
  }
  
  /**
   * Calculate message salience
   */
  calculateSalience(message, context) {
    let salience = 0.5;
    
    // Increase for questions
    if (message.includes('?')) salience += 0.2;
    
    // Increase for mentions of this agent
    if (message.toLowerCase().includes(this.name.toLowerCase())) salience += 0.3;
    
    // Increase for important hashtags
    const importantTags = message.match(/#important|#urgent|#critical/gi);
    if (importantTags) salience += 0.2 * importantTags.length;
    
    // Increase based on context priority
    if (context.priority === 'high') salience += 0.3;
    
    return Math.min(1.0, salience);
  }
  
  /**
   * Extract current focus from message
   */
  extractFocus(message, context) {
    // Simple topic extraction - enhance with NLP in production
    const topics = message.match(/about (\w+)|discuss (\w+)|regarding (\w+)/gi) || [];
    const focus = topics[0]?.replace(/about |discuss |regarding /gi, '') || 'general';
    
    return {
      topic: focus,
      type: context.orchestrationStrategy || 'discussion',
      timestamp: Date.now()
    };
  }
  
  /**
   * Retrieve relevant memory
   */
  async retrieveRelevantMemory(message) {
    if (!this.memory) {
      return { relevant: [], relevance: 0 };
    }
    
    // Get relevant memories from system
    const memories = await this.memory.structuredMemory
      .filter(m => {
        // Simple relevance check - enhance with embeddings
        const messageWords = new Set(message.toLowerCase().split(/\s+/));
        const memoryWords = new Set(m.content.toLowerCase().split(/\s+/));
        const intersection = [...messageWords].filter(w => memoryWords.has(w));
        return intersection.length > 3;
      })
      .slice(0, 5);
    
    return {
      relevant: memories,
      relevance: memories.length > 0 ? 0.7 : 0
    };
  }
  
  /**
   * Form intention based on inputs
   */
  formIntention(message, memoryContext, context) {
    const intentions = {
      answer: { priority: 0, type: 'answer' },
      elaborate: { priority: 0, type: 'elaborate' },
      question: { priority: 0, type: 'question' },
      agree: { priority: 0, type: 'agree' },
      disagree: { priority: 0, type: 'disagree' },
      synthesize: { priority: 0, type: 'synthesize' },
      create: { priority: 0, type: 'create' }
    };
    
    // Analyze message for intention cues
    if (message.includes('?')) intentions.answer.priority += 0.5;
    if (message.includes('explain') || message.includes('elaborate')) intentions.elaborate.priority += 0.4;
    if (message.includes('agree') || message.includes('yes')) intentions.agree.priority += 0.3;
    if (message.includes('but') || message.includes('however')) intentions.disagree.priority += 0.3;
    if (message.includes('combine') || message.includes('together')) intentions.synthesize.priority += 0.4;
    if (message.includes('create') || message.includes('imagine')) intentions.create.priority += 0.5;
    
    // Personality influences intention
    if (this.personality.traits.has('analytical')) {
      intentions.elaborate.priority += 0.2;
      intentions.question.priority += 0.1;
    }
    if (this.personality.traits.has('creative')) {
      intentions.create.priority += 0.3;
      intentions.synthesize.priority += 0.2;
    }
    if (this.personality.traits.has('agreeable')) {
      intentions.agree.priority += 0.2;
      intentions.disagree.priority -= 0.1;
    }
    
    // Memory influences intention
    if (memoryContext.relevance > 0.5) {
      intentions.elaborate.priority += 0.2;
      intentions.synthesize.priority += 0.1;
    }
    
    // Select highest priority intention
    const selected = Object.entries(intentions)
      .sort((a, b) => b[1].priority - a[1].priority)[0][1];
    
    this.cognitive.intentions.push({
      ...selected,
      timestamp: Date.now(),
      confidence: selected.priority
    });
    
    return selected;
  }
  
  /**
   * Generate response with automatic fallback
   */
  async generateResponseWithFallback(message, intention, memoryContext, context) {
    const modelsToTry = [this.model, ...this.fallbackChain];
    let lastError = null;
    
    for (const model of modelsToTry) {
      try {
        // Build enhanced prompt with cognitive context
        const enhancedPrompt = this.buildCognitivePrompt(
          message, 
          intention, 
          memoryContext, 
          context,
          model
        );
        
        // Call through orchestration service
        const orchestrationService = require('./orchestration-service');
        const response = await orchestrationService.orchestrate(
          this.sessionId || 'default',
          [{ ...this, model }], // Override model for fallback
          enhancedPrompt.userMessage,
          {
            ...context,
            systemPrompt: enhancedPrompt.systemPrompt,
            intention: intention.type,
            strategy: 'single' // Single agent response
          }
        );
        
        if (response && response[0]?.success) {
          // Log successful fallback if not primary model
          if (model !== this.model) {
            console.log(`[${this.name}] Fallback successful: ${this.model} -> ${model}`);
            this.emit('model-fallback', { from: this.model, to: model });
          }
          
          return {
            content: response[0].response,
            confidence: response[0].confidence || 0.7,
            model: model,
            intention: intention.type,
            toolsUsed: response[0].toolCalls || []
          };
        }
        
      } catch (error) {
        lastError = error;
        console.warn(`[${this.name}] Model ${model} failed:`, error.message);
        
        // Don't try fallbacks for auth errors
        if (error.message.includes('authentication') || 
            error.message.includes('API key')) {
          throw error;
        }
      }
    }
    
    // All models failed
    throw lastError || new Error('All models in fallback chain failed');
  }
  
  /**
   * Build cognitive-aware prompt
   */
  buildCognitivePrompt(message, intention, memoryContext, context, model) {
    const promptManager = new PromptManager();
    
    // Get base prompt for this agent
    const basePrompt = promptManager.buildAgentPrompt(this.id, {
      agentName: this.name,
      personalityTraits: Array.from(this.personality.traits.entries())
        .map(([trait, data]) => `${trait}: ${data.value}`)
        .join(', '),
      emotionalState: this.memory?.personality.emotions.get('primary') || 'neutral',
      currentGoals: context.goals || '',
      sharedKnowledge: context.sharedKnowledge || ''
    });
    
    // Add cognitive context
    const cognitiveContext = `
Current Cognitive State:
- Attention Focus: ${this.cognitive.currentFocus?.topic || 'general'}
- Intention: ${intention.type} (confidence: ${intention.confidence?.toFixed(2) || '0.50'})
- Working Memory: ${Array.from(this.cognitive.workingMemory.keys()).join(', ')}
- Recent Interactions: ${this.cognitive.attentionWindow.length} messages in context

Relevant Memories:
${memoryContext.relevant.map(m => `- ${m.content}`).join('\n')}

Behavioral Guidance:
- Response style should reflect "${intention.type}" intention
- Maintain consistency with established personality traits
- ${intention.type === 'agree' ? 'Build on and support previous points' : ''}
- ${intention.type === 'disagree' ? 'Respectfully present alternative viewpoint' : ''}
- ${intention.type === 'synthesize' ? 'Combine multiple perspectives into unified view' : ''}
- ${intention.type === 'create' ? 'Introduce novel ideas and connections' : ''}
`;
    
    return {
      systemPrompt: basePrompt + '\n\n' + cognitiveContext,
      userMessage: message
    };
  }
  
  /**
   * Update memory after response
   */
  async updateMemory(message, response, context) {
    if (!this.memory) return;
    
    // Store in structured memory
    this.memory.structuredMemory.push({
      type: 'interaction',
      content: `Q: ${message.substring(0, 100)} A: ${response.content.substring(0, 100)}`,
      intention: response.intention,
      confidence: response.confidence,
      timestamp: Date.now()
    });
    
    // Update working memory
    this.cognitive.workingMemory.set(
      `interaction-${Date.now()}`,
      { message, response, context }
    );
    
    // Limit working memory size
    if (this.cognitive.workingMemory.size > 20) {
      const oldest = Array.from(this.cognitive.workingMemory.keys())[0];
      this.cognitive.workingMemory.delete(oldest);
    }
    
    // Learn from interaction (reinforcement)
    if (context.feedback) {
      this.memory.applyReinforcement(
        `${response.intention}:${response.content.substring(0, 50)}`,
        context.feedback,
        this.cognitive.currentFocus?.topic || 'general'
      );
    }
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics(responseTime, success) {
    this.metrics.responseTimes.push(responseTime);
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes.shift();
    }
    
    // Update success rate (moving average)
    this.metrics.successRate = this.metrics.successRate * 0.95 + (success ? 0.05 : 0);
    
    // Emit metrics
    this.emit('metrics-update', {
      agent: this.id,
      avgResponseTime: this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length,
      successRate: this.metrics.successRate,
      evolutionStage: this.personality.currentState
    });
  }
  
  /**
   * Fallback response when all else fails
   */
  async fallbackResponse(message, context) {
    // Use a simple template-based response
    const fallbacks = [
      "I need to think about that more carefully. Can you rephrase or provide more context?",
      "That's an interesting point. Let me consider different angles on this.",
      "I'm processing this from multiple perspectives. Could you elaborate on your main concern?",
      "This touches on several important aspects. What's the key element you'd like to explore?",
      "I'm experiencing some complexity here. Let's break this down step by step."
    ];
    
    const selected = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    
    return {
      content: selected,
      confidence: 0.3,
      model: 'fallback',
      intention: 'acknowledge',
      toolsUsed: []
    };
  }
  
  /**
   * Get agent's current cognitive state
   */
  getCognitiveState() {
    return {
      id: this.id,
      name: this.name,
      personality: {
        traits: Array.from(this.personality.traits.entries()),
        evolutionStage: this.personality.currentState
      },
      cognitive: {
        currentFocus: this.cognitive.currentFocus,
        attentionLevel: this.cognitive.attentionWindow.length / 10,
        workingMemoryLoad: this.cognitive.workingMemory.size / 20,
        lastIntention: this.cognitive.intentions[this.cognitive.intentions.length - 1]
      },
      metrics: {
        successRate: this.metrics.successRate,
        avgResponseTime: this.metrics.responseTimes.length > 0 
          ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
          : 0,
        consensusRate: this.metrics.consensusRate
      },
      circuitBreakerState: this.circuitBreaker.getStatus()
    };
  }
  
  /**
   * Collaborate with other agents
   */
  async collaborateWith(otherAgents, topic, strategy = 'consensus') {
    const responses = [];
    
    for (const agent of otherAgents) {
      // Share working memory insights
      const sharedInsights = Array.from(this.cognitive.workingMemory.values())
        .filter(m => m.context?.topic === topic)
        .slice(0, 3);
      
      // Exchange beliefs
      const relevantBeliefs = Array.from(this.cognitive.beliefs.entries())
        .filter(([key, _]) => key.includes(topic))
        .slice(0, 5);
      
      responses.push({
        agent: agent.id,
        insights: sharedInsights,
        beliefs: relevantBeliefs
      });
    }
    
    // Update consensus rate based on agreement
    const agreementLevel = this.calculateAgreement(responses);
    this.metrics.consensusRate = this.metrics.consensusRate * 0.9 + agreementLevel * 0.1;
    
    return {
      collaboration: strategy,
      participants: otherAgents.map(a => a.id),
      agreementLevel,
      sharedKnowledge: responses
    };
  }
  
  /**
   * Calculate agreement level with other agents
   */
  calculateAgreement(responses) {
    // Simple agreement calculation - enhance with semantic similarity
    const allBeliefs = responses.flatMap(r => r.beliefs.map(b => b[0]));
    const uniqueBeliefs = new Set(allBeliefs);
    
    return 1 - (uniqueBeliefs.size / allBeliefs.length);
  }
  
  /**
   * Export agent state for persistence
   */
  exportState() {
    return {
      id: this.id,
      name: this.name,
      model: this.model,
      provider: this.provider,
      personality: {
        traits: Array.from(this.personality.traits.entries()),
        evolution: this.personality.evolution,
        currentState: this.personality.currentState
      },
      cognitive: {
        beliefs: Array.from(this.cognitive.beliefs.entries()),
        workingMemorySize: this.cognitive.workingMemory.size,
        attentionWindowSize: this.cognitive.attentionWindow.length
      },
      metrics: this.metrics,
      timestamp: Date.now()
    };
  }
  
  /**
   * Import agent state
   */
  importState(state) {
    if (state.personality) {
      this.personality.traits = new Map(state.personality.traits);
      this.personality.evolution = state.personality.evolution || [];
      this.personality.currentState = state.personality.currentState || 'nascent';
    }
    
    if (state.cognitive) {
      this.cognitive.beliefs = new Map(state.cognitive.beliefs || []);
    }
    
    if (state.metrics) {
      this.metrics = { ...this.metrics, ...state.metrics };
    }
  }
}

/**
 * UnifiedOrchestrator - Manages all agents with unified architecture
 */
class UnifiedOrchestrator extends EventEmitter {
  constructor() {
    super();
    
    this.agents = new Map();
    this.sessions = new Map();
    this.memorySystem = new EnhancedMemorySystem();
    this.promptManager = new PromptManager();
    
    // Performance monitoring
    this.performance = {
      totalInteractions: 0,
      avgResponseTime: 0,
      consensusRate: 0,
      systemHealth: 1.0
    };
    
    // Start monitoring
    this.startMonitoring();
  }
  
  /**
   * Create and register an agent
   */
  createAgent(config) {
    const agent = new UnifiedAgent(config);
    
    // Link to memory system
    agent.linkMemorySystem(this.memorySystem, config.sessionId || 'default');
    
    // Register agent
    this.agents.set(agent.id, agent);
    
    // Set up event listeners
    agent.on('cognitive-state', (state) => {
      this.emit('agent-cognitive-state', state);
    });
    
    agent.on('metrics-update', (metrics) => {
      this.updateSystemMetrics(metrics);
    });
    
    agent.on('model-fallback', (fallback) => {
      this.emit('model-fallback', fallback);
    });
    
    console.log(`[Orchestrator] Agent ${agent.name} (${agent.id}) created`);
    
    return agent;
  }
  
  /**
   * Execute orchestrated conversation
   */
  async orchestrateConversation(sessionId, message, config = {}) {
    const {
      agents = Array.from(this.agents.values()),
      strategy = 'parallel',
      timeout = 30000
    } = config;
    
    // Create or get session
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        startTime: Date.now(),
        messages: [],
        participants: agents.map(a => a.id)
      });
    }
    
    const session = this.sessions.get(sessionId);
    session.messages.push({ role: 'user', content: message, timestamp: Date.now() });
    
    // Update conversation memory
    const convMemory = this.memorySystem.getConversationMemory(sessionId);
    
    // Check for topics to avoid
    const topics = convMemory.topics;
    const avoidTopics = Array.from(convMemory.avoidedTopics);
    
    // Execute strategy
    const responses = await this.executeStrategy(
      strategy, 
      agents, 
      message, 
      { 
        sessionId, 
        avoidTopics, 
        timeout,
        ...config 
      }
    );
    
    // Update session
    responses.forEach(r => {
      if (r.success) {
        session.messages.push({
          role: 'assistant',
          agent: r.agent.name,
          content: r.response.content,
          timestamp: Date.now()
        });
      }
    });
    
    // Generate consensus if needed
    let consensus = null;
    if (strategy === 'consensus' || config.seekConsensus) {
      consensus = await this.seekConsensus(responses, message);
    }
    
    // Update metrics
    this.performance.totalInteractions++;
    
    // Emit orchestration complete
    this.emit('orchestration-complete', {
      sessionId,
      strategy,
      responses: responses.length,
      consensus,
      duration: Date.now() - session.messages[session.messages.length - responses.length - 1].timestamp
    });
    
    return {
      responses,
      consensus,
      session: {
        id: sessionId,
        messageCount: session.messages.length,
        duration: Date.now() - session.startTime
      }
    };
  }
  
  /**
   * Execute orchestration strategy
   */
  async executeStrategy(strategy, agents, message, context) {
    const strategies = {
      parallel: async () => {
        // All agents respond simultaneously
        const promises = agents.map(agent => 
          agent.processMessage(message, { ...context, orchestrationStrategy: 'parallel' })
            .then(response => ({ success: true, agent, response }))
            .catch(error => ({ success: false, agent, error: error.message }))
        );
        
        return await Promise.all(promises);
      },
      
      sequential: async () => {
        // Agents build on each other
        const responses = [];
        let cumulativeContext = message;
        
        for (const agent of agents) {
          try {
            const response = await agent.processMessage(
              cumulativeContext, 
              { ...context, orchestrationStrategy: 'sequential', previousResponses: responses }
            );
            
            responses.push({ success: true, agent, response });
            cumulativeContext += `\n\n${agent.name}: ${response.content}`;
            
          } catch (error) {
            responses.push({ success: false, agent, error: error.message });
          }
        }
        
        return responses;
      },
      
      debate: async () => {
        // Agents challenge each other
        const responses = [];
        const rounds = 3;
        
        for (let round = 0; round < rounds; round++) {
          const roundResponses = await Promise.all(
            agents.map(agent => 
              agent.processMessage(
                round === 0 ? message : responses[responses.length - 1]?.response.content || message,
                { 
                  ...context, 
                  orchestrationStrategy: 'debate',
                  round,
                  oppositePerspective: round > 0
                }
              ).then(response => ({ success: true, agent, response, round }))
               .catch(error => ({ success: false, agent, error: error.message, round }))
            )
          );
          
          responses.push(...roundResponses);
        }
        
        return responses;
      },
      
      consensus: async () => {
        // Seek agreement
        let responses = [];
        let consensusReached = false;
        let iterations = 0;
        const maxIterations = 5;
        
        while (!consensusReached && iterations < maxIterations) {
          const iterationResponses = await Promise.all(
            agents.map(agent => 
              agent.processMessage(
                iterations === 0 ? message : this.synthesizeResponses(responses),
                { 
                  ...context, 
                  orchestrationStrategy: 'consensus',
                  iteration: iterations,
                  seekingConsensus: true
                }
              ).then(response => ({ success: true, agent, response }))
               .catch(error => ({ success: false, agent, error: error.message }))
            )
          );
          
          responses = iterationResponses;
          consensusReached = this.checkConsensus(responses);
          iterations++;
        }
        
        return responses;
      },
      
      specialist: async () => {
        // Route to most qualified agent
        const qualifications = await Promise.all(
          agents.map(async agent => {
            const confidence = await this.assessAgentQualification(agent, message, context);
            return { agent, confidence };
          })
        );
        
        // Sort by confidence
        qualifications.sort((a, b) => b.confidence - a.confidence);
        
        // Use top 2 most qualified
        const specialists = qualifications.slice(0, 2);
        
        const responses = await Promise.all(
          specialists.map(({ agent }) =>
            agent.processMessage(message, { ...context, orchestrationStrategy: 'specialist' })
              .then(response => ({ success: true, agent, response }))
              .catch(error => ({ success: false, agent, error: error.message }))
          )
        );
        
        return responses;
      }
    };
    
    const strategyFn = strategies[strategy] || strategies.parallel;
    return await strategyFn();
  }
  
  /**
   * Assess agent qualification for a task
   */
  async assessAgentQualification(agent, message, context) {
    // Check agent's expertise relevance
    let confidence = 0.5;
    
    // Check skills match
    const requiredSkills = this.extractRequiredSkills(message);
    const agentSkills = agent.memory?.personality.skills || new Set();
    
    requiredSkills.forEach(skill => {
      if (agentSkills.has(skill)) confidence += 0.1;
    });
    
    // Check past performance on similar topics
    if (agent.memory) {
      const relevantMemories = agent.memory.structuredMemory
        .filter(m => m.content.toLowerCase().includes(context.topic?.toLowerCase() || ''))
        .length;
      
      confidence += Math.min(0.3, relevantMemories * 0.05);
    }
    
    // Check current cognitive load
    const cognitiveLoad = agent.cognitive.workingMemory.size / 20;
    confidence -= cognitiveLoad * 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Extract required skills from message
   */
  extractRequiredSkills(message) {
    const skills = [];
    
    if (message.includes('analyz') || message.includes('research')) skills.push('analysis');
    if (message.includes('creat') || message.includes('imagin')) skills.push('creativity');
    if (message.includes('code') || message.includes('program')) skills.push('coding');
    if (message.includes('math') || message.includes('calculat')) skills.push('mathematics');
    if (message.includes('design') || message.includes('architect')) skills.push('design');
    
    return skills;
  }
  
  /**
   * Synthesize multiple responses
   */
  synthesizeResponses(responses) {
    const validResponses = responses.filter(r => r.success);
    
    if (validResponses.length === 0) return "Let's reconsider this topic.";
    
    const synthesis = validResponses
      .map(r => `${r.agent.name}: ${r.response.content}`)
      .join('\n\n');
    
    return `Based on the discussion so far:\n\n${synthesis}\n\nWhat are your thoughts on these perspectives?`;
  }
  
  /**
   * Check if consensus is reached
   */
  checkConsensus(responses) {
    const validResponses = responses.filter(r => r.success);
    
    if (validResponses.length < 2) return false;
    
    // Check for agreement indicators
    const agreementPhrases = ['agree', 'consensus', 'aligned', 'same', 'correct'];
    const agreementCount = validResponses.filter(r => 
      agreementPhrases.some(phrase => 
        r.response.content.toLowerCase().includes(phrase)
      )
    ).length;
    
    return agreementCount / validResponses.length > 0.7;
  }
  
  /**
   * Seek consensus among responses
   */
  async seekConsensus(responses, originalMessage) {
    const validResponses = responses.filter(r => r.success);
    
    if (validResponses.length === 0) {
      return { reached: false, statement: 'No valid responses to form consensus' };
    }
    
    // Extract key points from each response
    const keyPoints = validResponses.map(r => ({
      agent: r.agent.name,
      points: this.extractKeyPoints(r.response.content),
      confidence: r.response.confidence || 0.5
    }));
    
    // Find common themes
    const allPoints = keyPoints.flatMap(kp => kp.points);
    const pointFrequency = {};
    
    allPoints.forEach(point => {
      const normalized = point.toLowerCase().trim();
      pointFrequency[normalized] = (pointFrequency[normalized] || 0) + 1;
    });
    
    // Identify consensus points (mentioned by majority)
    const consensusThreshold = Math.ceil(validResponses.length * 0.6);
    const consensusPoints = Object.entries(pointFrequency)
      .filter(([_, freq]) => freq >= consensusThreshold)
      .map(([point, _]) => point);
    
    if (consensusPoints.length > 0) {
      // Store in meta-memory
      this.memorySystem.metaMemory.addSharedFact(
        `Consensus on: ${originalMessage.substring(0, 50)}`,
        consensusPoints.length / allPoints.length,
        validResponses.map(r => r.agent.name)
      );
      
      return {
        reached: true,
        statement: `The agents reached consensus on: ${consensusPoints.join('; ')}`,
        confidence: consensusPoints.length / allPoints.length,
        participants: validResponses.map(r => r.agent.name)
      };
    }
    
    return {
      reached: false,
      statement: 'Consensus not reached - diverse perspectives remain',
      divergentPoints: Object.keys(pointFrequency).slice(0, 5)
    };
  }
  
  /**
   * Extract key points from text
   */
  extractKeyPoints(text) {
    // Simple extraction - enhance with NLP
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    return sentences.slice(0, 3).map(s => 
      s.trim().substring(0, 100)
    );
  }
  
  /**
   * Update system metrics
   */
  updateSystemMetrics(agentMetrics) {
    // Update rolling averages
    this.performance.avgResponseTime = 
      this.performance.avgResponseTime * 0.9 + agentMetrics.avgResponseTime * 0.1;
    
    this.performance.consensusRate = 
      this.performance.consensusRate * 0.9 + (agentMetrics.consensusRate || 0) * 0.1;
    
    // Calculate system health
    const healthFactors = {
      responseTime: Math.max(0, 1 - (this.performance.avgResponseTime / 5000)), // Under 5s is good
      successRate: agentMetrics.successRate || 0,
      consensus: this.performance.consensusRate
    };
    
    this.performance.systemHealth = 
      (healthFactors.responseTime + healthFactors.successRate + healthFactors.consensus) / 3;
    
    // Emit health update
    this.emit('system-health', {
      health: this.performance.systemHealth,
      metrics: this.performance
    });
  }
  
  /**
   * Start system monitoring
   */
  startMonitoring() {
    setInterval(() => {
      // Check agent health
      for (const [id, agent] of this.agents) {
        const state = agent.getCognitiveState();
        
        if (state.circuitBreakerState.state === 'OPEN') {
          console.warn(`[Monitor] Agent ${agent.name} circuit breaker is OPEN`);
          this.emit('agent-unhealthy', { agent: id, state });
        }
      }
      
      // Check memory usage
      const memoryReport = this.memorySystem.generateMemoryReport();
      
      if (memoryReport.statistics.totalConversations > 100) {
        console.log('[Monitor] High conversation count - consider cleanup');
      }
      
      // Emit monitoring update
      this.emit('monitoring-update', {
        agents: this.agents.size,
        sessions: this.sessions.size,
        health: this.performance.systemHealth,
        memory: memoryReport.statistics
      });
      
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Get system status
   */
  getSystemStatus() {
    const agentStates = Array.from(this.agents.values()).map(a => a.getCognitiveState());
    
    return {
      orchestrator: {
        agents: this.agents.size,
        sessions: this.sessions.size,
        performance: this.performance
      },
      agents: agentStates,
      memory: this.memorySystem.generateMemoryReport().statistics,
      health: {
        overall: this.performance.systemHealth,
        components: {
          agents: agentStates.filter(a => a.metrics.successRate > 0.5).length / agentStates.length,
          memory: this.memorySystem.metaMemory.systemState.effectiveness,
          consensus: this.performance.consensusRate
        }
      }
    };
  }
  
  /**
   * Export system state
   */
  async exportSystemState(path) {
    const state = {
      timestamp: new Date().toISOString(),
      orchestrator: {
        performance: this.performance,
        sessions: Array.from(this.sessions.values())
      },
      agents: Array.from(this.agents.values()).map(a => a.exportState()),
      memory: this.memorySystem.generateMemoryReport()
    };
    
    await require('fs').promises.writeFile(path, JSON.stringify(state, null, 2));
    
    return state;
  }
}

// Export the unified system
module.exports = {
  UnifiedAgent,
  UnifiedOrchestrator
};