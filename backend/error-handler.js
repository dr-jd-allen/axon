// Error handling module for AXON
// Provides centralized error management with custom error classes

// Custom error classes
class APIError extends Error {
  constructor(message, statusCode = 500, code = 'API_ERROR') {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed', provider = null) {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
    this.provider = provider;
  }
}

class ModelNotSupportedError extends APIError {
  constructor(model, availableModels = []) {
    super(`Model ${model} is not supported`, 400, 'MODEL_NOT_SUPPORTED');
    this.name = 'ModelNotSupportedError';
    this.model = model;
    this.availableModels = availableModels;
  }
}

class ContextWindowExceededError extends APIError {
  constructor(tokenCount, maxTokens, model) {
    super(`Context window exceeded: ${tokenCount} tokens (max: ${maxTokens})`, 400, 'CONTEXT_WINDOW_EXCEEDED');
    this.name = 'ContextWindowExceededError';
    this.tokenCount = tokenCount;
    this.maxTokens = maxTokens;
    this.model = model;
  }
}

class ProviderError extends APIError {
  constructor(provider, originalError) {
    super(`Provider error from ${provider}: ${originalError.message}`, 502, 'PROVIDER_ERROR');
    this.name = 'ProviderError';
    this.provider = provider;
    this.originalError = originalError;
  }
}

class ValidationError extends APIError {
  constructor(field, message) {
    super(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}

class WebSocketError extends APIError {
  constructor(message, connectionId) {
    super(message, 500, 'WEBSOCKET_ERROR');
    this.name = 'WebSocketError';
    this.connectionId = connectionId;
  }
}

// Error handler middleware for Express
function errorHandler(err, req, res, next) {
  // Log error details
  console.error('Error occurred:', {
    name: err.name,
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle different error types
  let statusCode = 500;
  let response = {
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }
  };

  if (err instanceof APIError) {
    statusCode = err.statusCode;
    response.error = {
      message: err.message,
      code: err.code,
      timestamp: err.timestamp
    };

    // Add specific error details
    if (err instanceof RateLimitError) {
      response.error.retryAfter = err.retryAfter;
      res.setHeader('Retry-After', err.retryAfter);
    } else if (err instanceof ModelNotSupportedError) {
      response.error.model = err.model;
      response.error.availableModels = err.availableModels;
    } else if (err instanceof ContextWindowExceededError) {
      response.error.tokenCount = err.tokenCount;
      response.error.maxTokens = err.maxTokens;
      response.error.model = err.model;
    } else if (err instanceof ProviderError) {
      response.error.provider = err.provider;
    } else if (err instanceof ValidationError) {
      response.error.field = err.field;
    }
  } else if (err.status || err.statusCode) {
    // Handle errors from other middleware
    statusCode = err.status || err.statusCode;
    response.error.message = err.message;
  } else if (err.name === 'ValidationError') {
    // Handle mongoose validation errors
    statusCode = 400;
    response.error = {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }))
    };
  }

  // Send error response
  res.status(statusCode).json(response);
}

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Error logging utility
class ErrorLogger {
  constructor(logFile = './logs/errors.log') {
    this.logFile = logFile;
  }

  async log(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context
    };

    // In production, this would write to a file or external logging service
    console.error('Error logged:', logEntry);
  }
}

// Provider-specific error mappers
const providerErrorMappers = {
  openai: (error) => {
    if (error.status === 429) {
      return new RateLimitError('OpenAI rate limit exceeded', 60);
    } else if (error.status === 401) {
      return new AuthenticationError('Invalid OpenAI API key', 'openai');
    } else if (error.code === 'context_length_exceeded') {
      // Extract token counts from error message if available
      return new ContextWindowExceededError(0, 0, 'openai');
    }
    return new ProviderError('openai', error);
  },

  anthropic: (error) => {
    if (error.status === 429) {
      return new RateLimitError('Anthropic rate limit exceeded', 60);
    } else if (error.status === 401) {
      return new AuthenticationError('Invalid Anthropic API key', 'anthropic');
    } else if (error.error?.type === 'invalid_request_error') {
      return new ValidationError('request', error.error.message);
    }
    return new ProviderError('anthropic', error);
  },

  google: (error) => {
    if (error.response?.status === 429) {
      return new RateLimitError('Google Gemini rate limit exceeded', 60);
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      return new AuthenticationError('Invalid Google API key', 'google');
    }
    return new ProviderError('google', error);
  }
};

// Utility to map provider errors
function mapProviderError(provider, error) {
  const mapper = providerErrorMappers[provider];
  return mapper ? mapper(error) : new ProviderError(provider, error);
}

module.exports = {
  // Error classes
  APIError,
  RateLimitError,
  AuthenticationError,
  ModelNotSupportedError,
  ContextWindowExceededError,
  ProviderError,
  ValidationError,
  WebSocketError,
  
  // Middleware and utilities
  errorHandler,
  asyncHandler,
  ErrorLogger,
  mapProviderError
};