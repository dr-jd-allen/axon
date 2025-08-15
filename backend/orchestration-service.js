// Unified Orchestration Service for AXON
// Manages and coordinates multiple LLM agents with different strategies

const EventEmitter = require('events');
const llmService = require('./llm-service');
const { CircuitBreakerManager } = require('./circuit-breaker');

class OrchestrationService extends EventEmitter {
  constructor() {
    super();
    this.orchestrations = new Map(); // sessionId -> orchestration state
    this.strategies = {
      parallel: this.parallelStrategy.bind(this),
      sequential: this.sequentialStrategy.bind(this),
      consensus: this.consensusStrategy.bind(this),
      pipeline: this.pipelineStrategy.bind(this),
      competitive: this.competitiveStrategy.bind(this)
    };
  }

  // Main orchestration method
  async orchestrate(sessionId, agents, message, settings, strategy = 'parallel') {
    const orchestrationId = `${sessionId}-${Date.now()}`;
    
    // Store orchestration state
    this.orchestrations.set(orchestrationId, {
      sessionId,
      agents,
      message,
      settings,
      strategy,
      startTime: Date.now(),
      status: 'running'
    });

    try {
      const strategyFn = this.strategies[strategy];
      if (!strategyFn) {
        throw new Error(`Unknown orchestration strategy: ${strategy}`);
      }

      const result = await strategyFn(agents, message, settings, orchestrationId);
      
      // Update state
      const state = this.orchestrations.get(orchestrationId);
      state.status = 'completed';
      state.endTime = Date.now();
      state.duration = state.endTime - state.startTime;
      
      this.emit('orchestration-complete', {
        orchestrationId,
        strategy,
        duration: state.duration,
        agentCount: agents.length
      });

      return result;
    } catch (error) {
      const state = this.orchestrations.get(orchestrationId);
      state.status = 'failed';
      state.error = error.message;
      
      this.emit('orchestration-error', {
        orchestrationId,
        strategy,
        error: error.message
      });
      
      throw error;
    }
  }

  // Parallel Strategy: All agents process simultaneously
  async parallelStrategy(agents, message, settings, orchestrationId) {
    const promises = agents.map(async (agent) => {
      const breaker = CircuitBreakerManager.create(`agent-${agent.type}`, {
        failureThreshold: 3,
        resetTimeout: 30000
      });

      try {
        return await breaker.execute(async () => {
          const agentConfig = {
            model: settings.agentModels?.[agent.type] || agent.model,
            parameters: settings.agentParameters?.[agent.type] || {},
            prompt: settings.agentPrompts?.[agent.type] || agent.systemPrompt
          };

          const apiKey = this.getApiKey(agent.type, settings);
          
          const response = await llmService.generateResponse(
            agentConfig,
            [{ role: 'user', content: message }],
            apiKey,
            { 
              enableTools: settings.enableTools || false,
              agentType: agent.type 
            }
          );

          return {
            agent,
            response: response.content,
            usage: response.usage,
            toolCalls: response.toolCalls,
            success: true
          };
        });
      } catch (error) {
        console.error(`Agent ${agent.name} failed:`, error.message);
        return {
          agent,
          error: error.message,
          success: false
        };
      }
    });

    const results = await Promise.allSettled(promises);
    
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        agent: null,
        error: result.reason?.message || 'Unknown error',
        success: false
      }
    );
  }

  // Sequential Strategy: Agents process in chain, each seeing previous responses
  async sequentialStrategy(agents, message, settings, orchestrationId) {
    const results = [];
    const conversationHistory = [{ role: 'user', content: message }];
    
    for (const agent of agents) {
      const breaker = CircuitBreakerManager.create(`agent-${agent.type}`, {
        failureThreshold: 3,
        resetTimeout: 30000
      });

      try {
        const result = await breaker.execute(async () => {
          const agentConfig = {
            model: settings.agentModels?.[agent.type] || agent.model,
            parameters: settings.agentParameters?.[agent.type] || {},
            prompt: settings.agentPrompts?.[agent.type] || agent.systemPrompt
          };

          const apiKey = this.getApiKey(agent.type, settings);
          
          const response = await llmService.generateResponse(
            agentConfig,
            conversationHistory,
            apiKey,
            { 
              enableTools: settings.enableTools || false,
              agentType: agent.type 
            }
          );

          return {
            agent,
            response: response.content,
            usage: response.usage,
            toolCalls: response.toolCalls,
            success: true
          };
        });

        results.push(result);
        conversationHistory.push({ 
          role: 'assistant', 
          content: result.response,
          name: agent.name 
        });

      } catch (error) {
        console.error(`Agent ${agent.name} failed in sequence:`, error.message);
        results.push({
          agent,
          error: error.message,
          success: false
        });
        
        // Optionally continue or break the chain
        if (settings.breakOnError) {
          break;
        }
      }
    }

    return results;
  }

  // Consensus Strategy: Multiple agents must agree
  async consensusStrategy(agents, message, settings, orchestrationId) {
    const threshold = settings.consensusThreshold || 0.7; // 70% agreement by default
    
    // First, get all responses in parallel
    const responses = await this.parallelStrategy(agents, message, settings, orchestrationId);
    
    // Analyze responses for consensus
    const successfulResponses = responses.filter(r => r.success);
    
    if (successfulResponses.length < agents.length * threshold) {
      throw new Error(`Consensus not reached. Only ${successfulResponses.length}/${agents.length} agents responded successfully`);
    }

    // Simple consensus: find common themes
    // In production, use more sophisticated NLP analysis
    const consensusData = {
      responses: successfulResponses,
      agreementLevel: successfulResponses.length / agents.length,
      summary: this.summarizeResponses(successfulResponses)
    };

    return consensusData;
  }

  // Pipeline Strategy: Each agent transforms the output of the previous
  async pipelineStrategy(agents, message, settings, orchestrationId) {
    let currentInput = message;
    const results = [];

    for (const agent of agents) {
      const breaker = CircuitBreakerManager.create(`agent-${agent.type}`, {
        failureThreshold: 3,
        resetTimeout: 30000
      });

      try {
        const result = await breaker.execute(async () => {
          const agentConfig = {
            model: settings.agentModels?.[agent.type] || agent.model,
            parameters: settings.agentParameters?.[agent.type] || {},
            prompt: agent.pipelinePrompt || agent.systemPrompt || 
              `Process and transform this input: ${currentInput}`
          };

          const apiKey = this.getApiKey(agent.type, settings);
          
          const response = await llmService.generateResponse(
            agentConfig,
            [{ role: 'user', content: currentInput }],
            apiKey,
            { 
              enableTools: settings.enableTools || false,
              agentType: agent.type 
            }
          );

          return {
            agent,
            input: currentInput,
            output: response.content,
            usage: response.usage,
            success: true
          };
        });

        results.push(result);
        currentInput = result.output; // Use output as next input

      } catch (error) {
        console.error(`Pipeline broke at agent ${agent.name}:`, error.message);
        results.push({
          agent,
          input: currentInput,
          error: error.message,
          success: false
        });
        
        if (settings.breakOnError !== false) {
          break; // Stop pipeline on error by default
        }
      }
    }

    return {
      pipeline: results,
      finalOutput: results[results.length - 1]?.output || null
    };
  }

  // Competitive Strategy: First successful response wins
  async competitiveStrategy(agents, message, settings, orchestrationId) {
    const timeout = settings.competitiveTimeout || 10000; // 10 second default
    
    const promises = agents.map(async (agent) => {
      const breaker = CircuitBreakerManager.create(`agent-${agent.type}`, {
        failureThreshold: 3,
        resetTimeout: 30000
      });

      return breaker.execute(async () => {
        const agentConfig = {
          model: settings.agentModels?.[agent.type] || agent.model,
          parameters: settings.agentParameters?.[agent.type] || {},
          prompt: settings.agentPrompts?.[agent.type] || agent.systemPrompt
        };

        const apiKey = this.getApiKey(agent.type, settings);
        
        const response = await llmService.generateResponse(
          agentConfig,
          [{ role: 'user', content: message }],
          apiKey,
          { 
            enableTools: settings.enableTools || false,
            agentType: agent.type 
          }
        );

        return {
          agent,
          response: response.content,
          usage: response.usage,
          responseTime: Date.now() - this.orchestrations.get(orchestrationId).startTime,
          success: true
        };
      });
    });

    try {
      // Race with timeout
      const result = await Promise.race([
        Promise.any(promises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Competitive timeout')), timeout)
        )
      ]);

      return result;
    } catch (error) {
      if (error.message === 'Competitive timeout') {
        throw new Error('No agent responded within the timeout period');
      }
      throw error;
    }
  }

  // Helper: Get API key for agent
  getApiKey(agentType, settings) {
    // Priority: settings > environment > error
    const apiKeyService = require('./api-key-service');
    
    try {
      // First try user-provided key, then API key service
      return settings.agentApiKeys?.[agentType] || apiKeyService.getApiKey(agentType);
    } catch (error) {
      console.warn(`API key not found for ${agentType}, attempting fallback`);
      
      // Try to map agent type to provider and get that key
      const providerMap = {
        generalist: 'openai',
        researcher: 'openai', 
        coder: 'openai',
        analyst: 'openai',
        teacher: 'openai',
        explorer: 'openai',
        synthesizer: 'google',
        philosopher: 'anthropic'
      };
      
      const provider = providerMap[agentType];
      if (provider) {
        try {
          return apiKeyService.getApiKey(provider);
        } catch (providerError) {
          console.warn(`Provider ${provider} key not available for ${agentType}`);
        }
      }
      
      // Last resort: try OpenAI as it's most commonly available
      try {
        return apiKeyService.getApiKey('openai');
      } catch (openaiError) {
        throw new Error(`No API key available for agent type: ${agentType}. Tried ${agentType}, ${provider}, and openai.`);
      }
    }
  }

  // Helper: Summarize multiple responses
  summarizeResponses(responses) {
    // Simple implementation - in production, use NLP
    const allText = responses.map(r => r.response).join('\n\n');
    const wordCount = allText.split(/\s+/).length;
    
    return {
      responseCount: responses.length,
      totalWords: wordCount,
      averageLength: Math.round(wordCount / responses.length),
      agents: responses.map(r => r.agent.name)
    };
  }

  // Get status of a specific orchestration
  getStatus(orchestrationId) {
    return this.orchestrations.get(orchestrationId) || null;
  }

  // Get all active orchestrations
  getAllStatus() {
    const statuses = [];
    this.orchestrations.forEach((state, id) => {
      if (state.status === 'running') {
        statuses.push({
          id,
          sessionId: state.sessionId,
          strategy: state.strategy,
          agentCount: state.agents.length,
          duration: Date.now() - state.startTime
        });
      }
    });
    return statuses;
  }

  // Clean up old orchestrations
  cleanup(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [id, state] of this.orchestrations.entries()) {
      if (state.endTime && (now - state.endTime) > maxAge) {
        this.orchestrations.delete(id);
      }
    }
  }
}

module.exports = new OrchestrationService();