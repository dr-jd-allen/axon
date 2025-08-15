const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const toolService = require('./tool-service');
const { 
  RateLimitError, 
  ModelNotSupportedError, 
  ContextWindowExceededError,
  mapProviderError 
} = require('./error-handler');
const cacheService = require('./cache-service').getInstance();
const { CircuitBreakerManager } = require('./circuit-breaker');

// Model configurations
const MODEL_CONFIGS = {
  // OpenAI models (updated for August 2025)
  'gpt-4o': { provider: 'openai', apiName: 'gpt-4o', contextWindow: 128000 },
  'gpt-4.5-research-preview': { provider: 'openai', apiName: 'gpt-4.5-research-preview', contextWindow: 128000 },
  'gpt-4.1-latest': { provider: 'openai', apiName: 'gpt-4.1-latest', contextWindow: 128000 },
  'o1-preview': { provider: 'openai', apiName: 'o1-preview', contextWindow: 128000 },
  'o1-mini': { provider: 'openai', apiName: 'o1-mini', contextWindow: 128000 },
  'o3-pro': { provider: 'openai', apiName: 'o3-pro', contextWindow: 256000 },
  'o3-pro-deep-research': { provider: 'openai', apiName: 'o3-pro-deep-research', contextWindow: 256000 },
  'o4-mini-deep-research': { provider: 'openai', apiName: 'o4-mini-deep-research', contextWindow: 128000 },
  
  // Anthropic models
  'claude-3-opus-20240229': { provider: 'anthropic', apiName: 'claude-3-opus-20240229', contextWindow: 200000 },
  'claude-3-sonnet-20240229': { provider: 'anthropic', apiName: 'claude-3-sonnet-20240229', contextWindow: 200000 },
  'claude-3-haiku-20240307': { provider: 'anthropic', apiName: 'claude-3-haiku-20240307', contextWindow: 200000 },
  'claude-opus-4-20250514': { provider: 'anthropic', apiName: 'claude-opus-4-20250514', contextWindow: 200000 },
  'claude-sonnet-4-20250514': { provider: 'anthropic', apiName: 'claude-sonnet-4-20250514', contextWindow: 200000 },
  
  // Google models (working with AI Studio)
  'gemini-1.5-pro': { provider: 'google', apiName: 'gemini-1.5-pro', contextWindow: 1000000 },
  'gemini-1.5-flash': { provider: 'google', apiName: 'gemini-1.5-flash', contextWindow: 1000000 },
  'gemini-2.5-pro': { provider: 'google', apiName: 'gemini-2.5-pro', contextWindow: 1000000 },
  'gemini-2.5-flash': { provider: 'google', apiName: 'gemini-2.5-flash', contextWindow: 1000000 },
  'gemini-2.0-flash': { provider: 'google', apiName: 'gemini-2.0-flash', contextWindow: 1000000 }
};

// Rate limiting configuration
class RateLimiter {
  constructor(requestsPerMinute, burstSize = 10) {
    this.limit = requestsPerMinute;
    this.burstSize = burstSize;
    this.requests = [];
    this.tokens = burstSize; // Token bucket for burst handling
    this.lastRefill = Date.now();
    this.refillRate = requestsPerMinute / 60000; // tokens per ms
  }
  
  async checkLimit() {
    const now = Date.now();
    
    // Refill tokens based on time passed
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.burstSize, this.tokens + tokensToAdd);
    this.lastRefill = now;
    
    // Clean old requests
    this.requests = this.requests.filter(time => now - time < 60000);
    
    // Check if we have tokens available for burst
    if (this.tokens >= 1) {
      this.tokens--;
      this.requests.push(now);
      return;
    }
    
    // Check regular rate limit
    if (this.requests.length >= this.limit) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 60000 - (now - oldestRequest) + 1000; // Add 1 second buffer
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    this.requests.push(now);
  }
  
  getStatus() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 60000);
    return {
      currentRequests: this.requests.length,
      limit: this.limit,
      tokens: Math.floor(this.tokens),
      burstSize: this.burstSize
    };
  }
}

class LLMService {
  constructor() {
    this.openaiClients = {};
    this.anthropicClients = {};
    this.googleClients = {};
    this.rateLimiters = {
      openai: new RateLimiter(500), // 500 requests per minute
      anthropic: new RateLimiter(1000), // 1000 requests per minute
      google: new RateLimiter(1000) // 1000 requests per minute
    };
  }

  // Initialize OpenAI client for a specific API key
  initOpenAI(apiKey) {
    if (!this.openaiClients[apiKey]) {
      this.openaiClients[apiKey] = new OpenAI({ apiKey });
    }
    return this.openaiClients[apiKey];
  }

  // Initialize Anthropic client for a specific API key
  initAnthropic(apiKey) {
    if (!this.anthropicClients[apiKey]) {
      this.anthropicClients[apiKey] = new Anthropic({ apiKey });
    }
    return this.anthropicClients[apiKey];
  }

  // Initialize Google client for a specific API key
  initGoogle(apiKey) {
    if (!this.googleClients[apiKey]) {
      // Google Gemini uses REST API
      this.googleClients[apiKey] = { apiKey };
    }
    return this.googleClients[apiKey];
  }

  // Get model configuration
  getModelConfig(model) {
    return MODEL_CONFIGS[model] || null;
  }

  // Retry with exponential backoff
  async retryWithBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        // Check if error is retryable
        const isRetryable = error.status === 429 || // Rate limit
                          error.status === 500 || // Server error
                          error.status === 502 || // Bad gateway
                          error.status === 503 || // Service unavailable
                          error.status === 504;   // Gateway timeout
        
        if (!isRetryable) throw error;
        
        const waitTime = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(`Retrying after ${waitTime}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // Generate response based on agent configuration
  async generateResponse(agentConfig, messages, apiKey, options = {}) {
    const { model, parameters, prompt } = agentConfig;
    const { enableTools = false, agentType = null } = options;
    
    // Get model configuration
    const modelConfig = this.getModelConfig(model);
    if (!modelConfig) {
      throw new Error(`Model ${model} is not supported. Available models: ${Object.keys(MODEL_CONFIGS).join(', ')}`);
    }
    
    // Add system prompt if provided
    const fullMessages = prompt 
      ? [{ role: 'system', content: prompt }, ...messages]
      : messages;

    // Get circuit breaker for this model
    const circuitBreaker = CircuitBreakerManager.getBreaker(model, {
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      halfOpenRequests: 1
    });

    try {
      // Execute with circuit breaker
      return await circuitBreaker.execute(async () => {
        // Check rate limit
        await this.rateLimiters[modelConfig.provider].checkLimit();
        
        // Check context window
        const estimatedTokens = this.estimateTokenCount(fullMessages);
        if (estimatedTokens > modelConfig.contextWindow) {
          throw new ContextWindowExceededError(
            estimatedTokens, 
            modelConfig.contextWindow, 
            model
          );
        }
        
        // Get available tools if enabled
        const tools = enableTools ? toolService.getAvailableTools(agentType) : null;
        
        // Route to appropriate provider
        return await this.retryWithBackoff(async () => {
          try {
            switch (modelConfig.provider) {
              case 'openai':
                return await this.generateOpenAIResponse(modelConfig, fullMessages, parameters, apiKey, tools);
              case 'anthropic':
                return await this.generateAnthropicResponse(modelConfig, fullMessages, parameters, apiKey, tools);
              case 'google':
                return await this.generateGoogleResponse(modelConfig, fullMessages, parameters, apiKey, tools);
              default:
                throw new Error(`Provider ${modelConfig.provider} not implemented`);
            }
          } catch (error) {
            // Map provider-specific errors to our custom errors
            throw mapProviderError(modelConfig.provider, error);
          }
        });
      }, async () => {
        // Fallback function when circuit is open
        console.log(`Circuit open for ${model}, attempting fallback...`);
        
        // Try alternative model from same provider
        const fallbackModel = this.getFallbackModel(model, modelConfig.provider);
        if (fallbackModel) {
          const fallbackConfig = this.getModelConfig(fallbackModel);
          console.log(`Using fallback model: ${fallbackModel}`);
          
          // Recursive call with fallback model
          return await this.generateResponse(
            { ...agentConfig, model: fallbackModel },
            messages,
            apiKey,
            options
          );
        }
        
        throw new Error(`Model ${model} is unavailable and no fallback found`);
      });
    } catch (error) {
      console.error('LLM Error Details:', {
        model: model,
        provider: modelConfig?.provider,
        error: error.message,
        code: error.code,
        type: error.type,
        status: error.status,
        circuitState: circuitBreaker.getStatus().state
      });
      throw error;
    }
  }

  // Get fallback model for a given model
  getFallbackModel(model, provider) {
    const fallbacks = {
      // OpenAI fallbacks (updated for August 2025)
      'gpt-4.5-research-preview': 'gpt-4.1-latest',
      'gpt-4.1-latest': 'gpt-4o',
      'o3-pro-deep-research': 'o3-pro',
      'o3-pro': 'gpt-4o',
      'o4-mini-deep-research': 'o1-mini',
      'o1-preview': 'gpt-4o',
      
      // Anthropic fallbacks
      'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514': 'claude-3-opus-20240229',
      'claude-3-opus-20240229': 'claude-3-sonnet-20240229',
      
      // Google fallbacks
      'gemini-2.5-pro': 'gemini-2.5-flash',
      'gemini-2.5-flash': 'gemini-2.0-flash',
      'gemini-2.0-flash': 'gemini-1.5-pro',
      'gemini-1.5-pro': 'gemini-1.5-flash'
    };
    
    return fallbacks[model] || null;
  }

  // Generate OpenAI response
  async generateOpenAIResponse(modelConfig, messages, parameters, apiKey, tools = null) {
    const client = this.initOpenAI(apiKey);
    
    const requestParams = {
      model: modelConfig.apiName,
      messages: messages,
      temperature: parameters.temperature || 0.7,
      top_p: parameters.topP || 0.9,
      max_tokens: parameters.maxTokens || 1000,
      presence_penalty: parameters.repetitionPenalty ? (parameters.repetitionPenalty - 1) : 0,
    };
    
    // Add tools if available
    if (tools) {
      requestParams.tools = toolService.toOpenAIFormat(tools);
      requestParams.tool_choice = 'auto';
    }
    
    const response = await client.chat.completions.create(requestParams);
    
    // Check if tool was called
    const toolCalls = toolService.parseFunctionCall(response, 'openai');
    if (toolCalls) {
      // Execute tools and get results
      const toolResults = [];
      for (const toolCall of toolCalls) {
        try {
          const result = await toolService.executeTool(toolCall.name, toolCall.arguments);
          toolResults.push(toolService.formatToolResult(result, toolCall, 'openai'));
        } catch (error) {
          toolResults.push(toolService.formatToolResult(
            { error: error.message }, 
            toolCall, 
            'openai'
          ));
        }
      }
      
      // Add tool results to messages and make another call
      const updatedMessages = [
        ...messages,
        response.choices[0].message,
        ...toolResults
      ];
      
      const finalResponse = await client.chat.completions.create({
        model: modelConfig.apiName,
        messages: updatedMessages,
        temperature: parameters.temperature || 0.7,
        max_tokens: parameters.maxTokens || 1000,
      });
      
      return {
        content: finalResponse.choices[0].message.content,
        usage: {
          prompt_tokens: (response.usage?.prompt_tokens || 0) + (finalResponse.usage?.prompt_tokens || 0),
          completion_tokens: (response.usage?.completion_tokens || 0) + (finalResponse.usage?.completion_tokens || 0),
          total_tokens: (response.usage?.total_tokens || 0) + (finalResponse.usage?.total_tokens || 0)
        },
        toolCalls: toolCalls
      };
    }
    
    return {
      content: response.choices[0].message.content,
      usage: response.usage
    };
  }

  // Generate Anthropic response
  async generateAnthropicResponse(modelConfig, messages, parameters, apiKey, tools = null) {
    const client = this.initAnthropic(apiKey);
    
    // Convert messages to Anthropic format
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));
    
    const requestParams = {
      model: modelConfig.apiName,
      messages: anthropicMessages,
      system: systemPrompt,
      temperature: parameters.temperature || 0.7,
      top_p: parameters.topP || 0.9,
      max_tokens: parameters.maxTokens || 1000,
    };
    
    // Add tools if available
    if (tools) {
      requestParams.tools = toolService.toAnthropicFormat(tools);
    }
    
    try {
      const response = await client.messages.create(requestParams);
      
      // Check if we got an HTML error response (common authentication issue)
      if (typeof response === 'string' && response.includes('<!DOCTYPE')) {
        throw new Error('Received HTML response instead of JSON - likely an authentication error. Please check your Anthropic API key.');
      }
      
      if (!response.content || !Array.isArray(response.content)) {
        throw new Error('Invalid response format from Anthropic API');
      }
      
      // Check if tool was called
      const toolCalls = toolService.parseFunctionCall(response, 'anthropic');
      if (toolCalls) {
        // Execute tools and get results
        const toolResults = [];
        for (const toolCall of toolCalls) {
          try {
            const result = await toolService.executeTool(toolCall.name, toolCall.arguments);
            toolResults.push(toolService.formatToolResult(result, toolCall, 'anthropic'));
          } catch (error) {
            toolResults.push(toolService.formatToolResult(
              { error: error.message }, 
              toolCall, 
              'anthropic'
            ));
          }
        }
        
        // Add tool results to messages and make another call
        const updatedMessages = [
          ...anthropicMessages,
          { role: 'assistant', content: response.content },
          ...toolResults.map(tr => ({ role: 'user', content: JSON.stringify(tr) }))
        ];
        
        const finalResponse = await client.messages.create({
          model: modelConfig.apiName,
          messages: updatedMessages,
          system: systemPrompt,
          temperature: parameters.temperature || 0.7,
          max_tokens: parameters.maxTokens || 1000,
        });
        
        return {
          content: finalResponse.content[0].text,
          usage: {
            prompt_tokens: response.usage.input_tokens + finalResponse.usage.input_tokens,
            completion_tokens: response.usage.output_tokens + finalResponse.usage.output_tokens,
            total_tokens: (response.usage.input_tokens + response.usage.output_tokens) + 
                         (finalResponse.usage.input_tokens + finalResponse.usage.output_tokens)
          },
          toolCalls: toolCalls
        };
      }
      
      return {
        content: response.content[0].text,
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        }
      };
      
    } catch (error) {
      // Enhanced error handling for common issues
      if (error.message && error.message.includes('<!DOCTYPE')) {
        throw new Error('Authentication failed: Received HTML error page. Please verify your Anthropic API key is correct.');
      }
      
      if (error.status === 401) {
        throw new Error('Anthropic API authentication failed. Please check your API key.');
      }
      
      if (error.status === 429) {
        throw new Error('Anthropic API rate limit exceeded. Please wait before retrying.');
      }
      
      throw error;
    }
  }

  // Estimate token count (rough approximation)
  estimateTokenCount(messages) {
    let totalChars = 0;
    messages.forEach(msg => {
      totalChars += (msg.content || '').length;
    });
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  // Generate Google Gemini response (AI Studio)
  async generateGoogleResponse(modelConfig, messages, parameters, apiKey, tools = null) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.apiName}:generateContent?key=${apiKey}`;
    
    // Convert messages to Gemini format  
    const parts = messages.map(msg => ({
      text: msg.content
    }));
    
    const requestBody = {
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: parameters.temperature || 0.7,
        topP: parameters.topP || 0.9,
        maxOutputTokens: parameters.maxTokens || 1000,
      }
    };
    
    // Add tools if available
    if (tools) {
      requestBody.tools = toolService.toGoogleFormat(tools);
    }
    
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return this.processGoogleResponse(response.data, requestBody, url, tools);
  }
  
  // Process Google API response
  async processGoogleResponse(responseData, requestBody, url, tools) {
    if (!responseData.candidates || responseData.candidates.length === 0) {
      throw new Error('No response from Google API');
    }
    
    // Check if tool was called
    const toolCalls = toolService.parseFunctionCall(responseData, 'google');
    if (toolCalls) {
      // Execute tools and get results
      const toolResults = [];
      for (const toolCall of toolCalls) {
        try {
          const result = await toolService.executeTool(toolCall.name, toolCall.arguments);
          toolResults.push(toolService.formatToolResult(result, toolCall, 'google'));
        } catch (error) {
          toolResults.push(toolService.formatToolResult(
            { error: error.message }, 
            toolCall, 
            'google'
          ));
        }
      }
      
      // For tool responses, we'd need to make another call
      // Simplified for now - return the initial response
      return {
        content: responseData.candidates[0].content.parts[0].text || 'Tool execution completed',
        usage: {
          prompt_tokens: responseData.usageMetadata?.promptTokenCount || 0,
          completion_tokens: responseData.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: responseData.usageMetadata?.totalTokenCount || 0
        },
        toolCalls: toolCalls
      };
    }
    
    const content = responseData.candidates[0].content.parts[0].text;
    const usageMetadata = responseData.usageMetadata || {};
    
    return {
      content: content,
      usage: {
        prompt_tokens: usageMetadata.promptTokenCount || 0,
        completion_tokens: usageMetadata.candidatesTokenCount || 0,
        total_tokens: usageMetadata.totalTokenCount || 0
      }
    };
  }

  // Original generateResponse method content moved to separate provider methods
  async generateResponseOld(agentConfig, messages, apiKey) {
    const { model, parameters, prompt } = agentConfig;
    
    // Add system prompt if provided
    const fullMessages = prompt 
      ? [{ role: 'system', content: prompt }, ...messages]
      : messages;

    try {
      if (model.includes('gpt') || model.includes('o1') || model.includes('o3') || model.includes('o4')) {
        // This old method is kept for reference but not used
        throw new Error('Please use the new generateResponse method');
      }
    } catch (error) {
      throw error;
    }
  }

  // Stream response for real-time communication
  async *streamResponse(agentConfig, messages, apiKey) {
    const { model, parameters, prompt } = agentConfig;
    
    // Get model configuration
    const modelConfig = this.getModelConfig(model);
    if (!modelConfig) {
      throw new Error(`Model ${model} is not supported`);
    }
    
    const fullMessages = prompt 
      ? [{ role: 'system', content: prompt }, ...messages]
      : messages;

    try {
      // Check rate limit
      await this.rateLimiters[modelConfig.provider].checkLimit();
      
      switch (modelConfig.provider) {
        case 'openai':
          yield* this.streamOpenAIResponse(modelConfig, fullMessages, parameters, apiKey);
          break;
        case 'anthropic':
          yield* this.streamAnthropicResponse(modelConfig, fullMessages, parameters, apiKey);
          break;
        case 'google':
          yield* this.streamGoogleResponse(modelConfig, fullMessages, parameters, apiKey);
          break;
        default:
          throw new Error(`Streaming not implemented for provider ${modelConfig.provider}`);
      }
    } catch (error) {
      console.error('Stream Error:', error);
      throw error;
    }
  }

  // Stream OpenAI response
  async *streamOpenAIResponse(modelConfig, messages, parameters, apiKey) {
    const client = this.initOpenAI(apiKey);
    
    const stream = await client.chat.completions.create({
      model: modelConfig.apiName,
      messages: messages,
      temperature: parameters.temperature || 0.7,
      top_p: parameters.topP || 0.9,
      max_tokens: parameters.maxTokens || 1000,
      stream: true,
    });
    
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  }

  // Stream Anthropic response
  async *streamAnthropicResponse(modelConfig, messages, parameters, apiKey) {
    const client = this.initAnthropic(apiKey);
    
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));
    
    const stream = await client.messages.create({
      model: modelConfig.apiName,
      messages: anthropicMessages,
      system: systemPrompt,
      temperature: parameters.temperature || 0.7,
      stream: true,
      max_tokens: parameters.maxTokens || 1000,
    });
    
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  // Stream Google response (using non-streaming API as Google doesn't support streaming yet)
  async *streamGoogleResponse(modelConfig, messages, parameters, apiKey) {
    // Google doesn't support streaming, so we'll return the full response at once
    const response = await this.generateGoogleResponse(modelConfig, messages, parameters, apiKey);
    yield response.content;
  }

  // Old streaming methods for reference
  async *streamResponseOld(agentConfig, messages, apiKey) {
    const { model, parameters, prompt } = agentConfig;
    
    const fullMessages = prompt 
      ? [{ role: 'system', content: prompt }, ...messages]
      : messages;

    try {
      if (model.includes('gpt') || model.includes('o1') || model.includes('o3') || model.includes('o4')) {
        // This old method is kept for reference but not used
        throw new Error('Please use the new streamResponse method');
      }
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new LLMService();