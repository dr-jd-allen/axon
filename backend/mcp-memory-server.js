// MCP (Model Context Protocol) Server for AXON Memory System
// Provides filesystem and vector database access for memory persistence

const express = require('express');
const { EnhancedMemorySystem } = require('./enhanced-memory-system');
const PromptManager = require('./prompt-manager');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MCPMemoryServer {
  constructor(config = {}) {
    this.config = {
      port: config.port || 3005,
      memoryPath: config.memoryPath || path.join(__dirname, '..', 'memory-store'),
      chromaPath: config.chromaPath || path.join(__dirname, '..', 'chroma-db'),
      enableChroma: config.enableChroma || false,
      enableFilesystem: config.enableFilesystem !== false,
      ...config
    };
    
    // Initialize components
    this.memorySystem = new EnhancedMemorySystem({
      persistencePath: this.config.memoryPath,
      mcpServerUrl: `http://localhost:${this.config.port}`,
      useChromaDB: this.config.enableChroma
    });
    
    this.promptManager = new PromptManager({
      promptsPath: path.join(this.config.memoryPath, 'prompts')
    });
    
    // Express app for MCP endpoints
    this.app = express();
    this.app.use(express.json({ limit: '10mb' }));
    
    // Memory stores
    this.stores = {
      filesystem: null,
      chromadb: null,
      inmemory: new Map()
    };
    
    this.setupEndpoints();
    this.initialize();
  }
  
  async initialize() {
    // Initialize filesystem store
    if (this.config.enableFilesystem) {
      await fs.mkdir(this.config.memoryPath, { recursive: true });
      this.stores.filesystem = {
        path: this.config.memoryPath,
        initialized: true
      };
    }
    
    // Initialize ChromaDB if enabled
    if (this.config.enableChroma) {
      try {
        const { ChromaClient } = require('chromadb');
        const client = new ChromaClient({ path: this.config.chromaPath });
        
        // Create collections
        this.stores.chromadb = {
          client,
          collections: {
            model: await client.getOrCreateCollection({ name: 'axon_model_memory' }),
            conversation: await client.getOrCreateCollection({ name: 'axon_conversation_memory' }),
            meta: await client.getOrCreateCollection({ name: 'axon_meta_memory' })
          }
        };
        
        console.log('ChromaDB initialized successfully');
      } catch (error) {
        console.error('Failed to initialize ChromaDB:', error);
        this.config.enableChroma = false;
      }
    }
    
    // Start server
    this.server = this.app.listen(this.config.port, () => {
      console.log(`MCP Memory Server running on port ${this.config.port}`);
    });
  }
  
  setupEndpoints() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        stores: {
          filesystem: this.config.enableFilesystem,
          chromadb: this.config.enableChroma,
          inmemory: true
        },
        timestamp: new Date().toISOString()
      });
    });
    
    // ===== Model Memory Endpoints =====
    
    // Store model memory
    this.app.post('/memory/model/:agentId', async (req, res) => {
      try {
        const { agentId } = req.params;
        const { traits, preferences, beliefs, skills, emotions, reinforcement } = req.body;
        
        // Get or create model memory
        const modelMemory = this.memorySystem.getModelMemory(agentId, req.body.agentName || agentId);
        
        // Update memory components
        if (traits) {
          for (const [trait, data] of Object.entries(traits)) {
            modelMemory.addTrait(trait, data.value, data.confidence);
          }
        }
        
        if (preferences) {
          for (const [pref, data] of Object.entries(preferences)) {
            modelMemory.addPreference(pref, data.value, data.context);
          }
        }
        
        if (reinforcement) {
          modelMemory.applyReinforcement(
            reinforcement.action,
            reinforcement.reward,
            reinforcement.state
          );
        }
        
        // Persist to stores
        await this.persistModelMemory(agentId, modelMemory);
        
        res.json({
          success: true,
          agentId,
          summary: modelMemory.generatePersonalitySummary()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get model memory
    this.app.get('/memory/model/:agentId', async (req, res) => {
      try {
        const { agentId } = req.params;
        const modelMemory = this.memorySystem.modelMemories.get(agentId);
        
        if (!modelMemory) {
          return res.status(404).json({ error: 'Agent memory not found' });
        }
        
        res.json({
          agentId,
          memory: modelMemory.toJSON(),
          summary: modelMemory.generatePersonalitySummary()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Apply reinforcement learning
    this.app.post('/memory/model/:agentId/reinforce', async (req, res) => {
      try {
        const { agentId } = req.params;
        const { action, reward, state } = req.body;
        
        this.memorySystem.applyReinforcement(agentId, action, reward, state);
        
        res.json({
          success: true,
          message: `Reinforcement applied: ${reward > 0 ? 'positive' : 'negative'}`
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // ===== Conversation Memory Endpoints =====
    
    // Add message to conversation
    this.app.post('/memory/conversation/:sessionId/message', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { agentId, agentName, message, metadata } = req.body;
        
        const result = await this.memorySystem.processMessage(
          sessionId,
          agentId,
          agentName,
          message,
          metadata
        );
        
        res.json({
          success: true,
          context: result.conversationContext,
          shouldAvoid: Array.from(result.conversationContext.avoidedTopics || [])
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get conversation context
    this.app.get('/memory/conversation/:sessionId/context', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const convMemory = this.memorySystem.getConversationMemory(sessionId);
        
        res.json({
          sessionId,
          context: convMemory.getContext(req.query.limit || 10),
          summary: convMemory.generateSummary()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Check if topic should be avoided
    this.app.get('/memory/conversation/:sessionId/avoid/:topic', async (req, res) => {
      try {
        const { sessionId, topic } = req.params;
        const shouldAvoid = this.memorySystem.shouldAvoidTopic(sessionId, topic);
        
        res.json({ topic, shouldAvoid });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // ===== Meta Memory Endpoints =====
    
    // Update user profile
    this.app.post('/memory/meta/user', async (req, res) => {
      try {
        this.memorySystem.metaMemory.updateUserProfile(req.body);
        
        res.json({
          success: true,
          userContext: this.memorySystem.metaMemory.userProfile
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Add collaboration goal
    this.app.post('/memory/meta/goal', async (req, res) => {
      try {
        const { goal, type, metadata } = req.body;
        const goalObject = this.memorySystem.metaMemory.addGoal(goal, type, metadata);
        
        res.json({
          success: true,
          goal: goalObject
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Update goal progress
    this.app.put('/memory/meta/goal/:goalId/progress', async (req, res) => {
      try {
        const { goalId } = req.params;
        const { progress } = req.body;
        
        this.memorySystem.metaMemory.updateGoalProgress(goalId, progress);
        
        res.json({
          success: true,
          goalId,
          progress
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Add shared understanding
    this.app.post('/memory/meta/shared', async (req, res) => {
      try {
        const { type, content } = req.body;
        
        switch (type) {
          case 'fact':
            this.memorySystem.metaMemory.addSharedFact(
              content.fact,
              content.confidence,
              content.sources
            );
            break;
          
          case 'concept':
            this.memorySystem.metaMemory.addSharedConcept(
              content.concept,
              content.definition,
              content.examples
            );
            break;
          
          case 'decision':
            this.memorySystem.metaMemory.addDecision(
              content.decision,
              content.participants,
              content.reasoning
            );
            break;
          
          default:
            throw new Error(`Unknown shared understanding type: ${type}`);
        }
        
        res.json({
          success: true,
          type,
          content
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get current context
    this.app.get('/memory/meta/context', async (req, res) => {
      try {
        const context = this.memorySystem.metaMemory.getCurrentContext();
        
        res.json({
          context,
          summary: this.memorySystem.metaMemory.generateSummary()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // ===== Prompt Management Endpoints =====
    
    // Set agent prompt
    this.app.post('/prompts/agent/:agentId', async (req, res) => {
      try {
        const { agentId } = req.params;
        const { prompt } = req.body;
        
        const result = this.promptManager.setAgentPrompt(agentId, prompt);
        
        res.json({
          success: true,
          agentId,
          prompt: result
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get agent prompt
    this.app.get('/prompts/agent/:agentId', async (req, res) => {
      try {
        const { agentId } = req.params;
        const context = req.query;
        
        const prompt = this.promptManager.buildAgentPrompt(agentId, context);
        
        res.json({
          agentId,
          prompt,
          configuration: this.promptManager.getAgentConfiguration(agentId)
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Set collective prompt
    this.app.post('/prompts/collective', async (req, res) => {
      try {
        const { prompt } = req.body;
        
        this.promptManager.setCollectivePrompt(prompt);
        
        res.json({
          success: true,
          prompt
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get all prompt configurations
    this.app.get('/prompts/all', async (req, res) => {
      try {
        const configurations = this.promptManager.getAllConfigurations();
        
        res.json(configurations);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // ===== Search and Query Endpoints =====
    
    // Vector search across memories
    this.app.post('/search/vector', async (req, res) => {
      try {
        const { query, type, limit } = req.body;
        
        if (!this.config.enableChroma) {
          return res.status(501).json({ error: 'ChromaDB not enabled' });
        }
        
        const results = await this.vectorSearch(query, type, limit);
        
        res.json({
          query,
          results
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // ===== Persistence Endpoints =====
    
    // Save all memories
    this.app.post('/persist/save', async (req, res) => {
      try {
        await this.memorySystem.saveMemories();
        await this.promptManager.savePrompts();
        
        res.json({
          success: true,
          message: 'All memories and prompts saved'
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Generate memory report
    this.app.get('/report', async (req, res) => {
      try {
        const report = this.memorySystem.generateMemoryReport();
        
        res.json(report);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Export memories
    this.app.get('/export', async (req, res) => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportPath = path.join(this.config.memoryPath, `export-${timestamp}.json`);
        
        const memoryReport = this.memorySystem.generateMemoryReport();
        const promptConfig = await this.promptManager.exportConfiguration(
          path.join(this.config.memoryPath, `prompts-export-${timestamp}.json`)
        );
        
        const exportData = {
          timestamp,
          memory: memoryReport,
          prompts: promptConfig,
          version: '1.0'
        };
        
        await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
        
        res.json({
          success: true,
          exportPath,
          data: exportData
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
  
  // Persist model memory to stores
  async persistModelMemory(agentId, modelMemory) {
    const data = modelMemory.toJSON();
    
    // Save to filesystem
    if (this.config.enableFilesystem) {
      const filePath = path.join(
        this.config.memoryPath,
        'models',
        `${agentId}.json`
      );
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }
    
    // Save to ChromaDB
    if (this.config.enableChroma && this.stores.chromadb) {
      const embedding = await this.generateEmbedding(
        modelMemory.generatePersonalitySummary()
      );
      
      await this.stores.chromadb.collections.model.upsert({
        ids: [agentId],
        embeddings: [embedding],
        metadatas: [{
          agentId,
          agentName: data.agentName,
          timestamp: new Date().toISOString(),
          traitsCount: data.personality.traits.length,
          preferencesCount: data.personality.preferences.length,
          rewardsCount: data.reinforcement.rewards.length
        }],
        documents: [JSON.stringify(data)]
      });
    }
    
    // Save to in-memory store
    this.stores.inmemory.set(`model:${agentId}`, data);
  }
  
  // Vector search implementation
  async vectorSearch(query, type = 'all', limit = 10) {
    if (!this.stores.chromadb) {
      throw new Error('ChromaDB not initialized');
    }
    
    const embedding = await this.generateEmbedding(query);
    const results = [];
    
    const collections = type === 'all' 
      ? Object.values(this.stores.chromadb.collections)
      : [this.stores.chromadb.collections[type]];
    
    for (const collection of collections) {
      const searchResults = await collection.query({
        queryEmbeddings: [embedding],
        nResults: Math.min(limit, 10)
      });
      
      if (searchResults.documents && searchResults.documents[0]) {
        searchResults.documents[0].forEach((doc, idx) => {
          results.push({
            document: doc,
            metadata: searchResults.metadatas[0][idx],
            distance: searchResults.distances[0][idx],
            collection: collection.name
          });
        });
      }
    }
    
    return results.sort((a, b) => a.distance - b.distance).slice(0, limit);
  }
  
  // Generate embedding (stub - replace with actual embedding service)
  async generateEmbedding(text) {
    const hash = crypto.createHash('sha256').update(text).digest();
    const embedding = [];
    
    for (let i = 0; i < 384; i++) {
      embedding.push(hash[i % hash.length] / 255.0 - 0.5);
    }
    
    return embedding;
  }
  
  // Shutdown server
  async shutdown() {
    await this.memorySystem.saveMemories();
    await this.promptManager.savePrompts();
    
    if (this.server) {
      this.server.close();
    }
  }
}

// Export for use as module
module.exports = MCPMemoryServer;

// Run standalone if executed directly
if (require.main === module) {
  const server = new MCPMemoryServer({
    port: process.env.MCP_PORT || 3005,
    enableChroma: process.env.ENABLE_CHROMA === 'true',
    memoryPath: process.env.MEMORY_PATH || path.join(__dirname, '..', 'memory-store')
  });
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down MCP Memory Server...');
    await server.shutdown();
    process.exit(0);
  });
}