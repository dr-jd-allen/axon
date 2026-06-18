const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Debug logging
console.log('=== SERVER DEBUG INFO ===');
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('Frontend relative path:', path.join(__dirname, '..', 'frontend'));
console.log('Frontend absolute path:', path.resolve(__dirname, '..', 'frontend'));
console.log('Frontend exists?', fs.existsSync(path.resolve(__dirname, '..', 'frontend')));
console.log('=========================');

// WebSocket service will be initialized after server starts
let wsService;

// Initialize services
const llmService = require('./llm-service');
const apiKeyService = require('./api-key-service');
const { errorHandler, asyncHandler, ValidationError } = require('./error-handler');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend directory - use absolute path
const frontendPath = path.resolve(__dirname, '..', 'frontend');
console.log('Serving static files from:', frontendPath);

// List frontend files for debugging
if (fs.existsSync(frontendPath)) {
  console.log('Frontend files found:');
  fs.readdirSync(frontendPath).forEach(file => {
    console.log('  -', file);
  });
} else {
  console.error('ERROR: Frontend directory not found at:', frontendPath);
}

// Serve static files - try different approaches
app.use('/static', express.static(frontendPath));
app.use('/frontend', express.static(frontendPath));

// Direct file routes
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/monitor.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'monitor.html'));
});

app.get('/monitor-enhanced.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'monitor-enhanced.html'));
});

// Root route
app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  console.log('Root request - serving:', indexPath);
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>Frontend not found</h1>
      <p>Looking for: ${indexPath}</p>
      <p>Directory exists: ${fs.existsSync(frontendPath)}</p>
      <p>Working directory: ${process.cwd()}</p>
      <p>Try these links:</p>
      <ul>
        <li><a href="/index.html">/index.html</a></li>
        <li><a href="/static/index.html">/static/index.html</a></li>
        <li><a href="/frontend/index.html">/frontend/index.html</a></li>
      </ul>
    `);
  }
});

// Initialize SQLite database
const dbPath = path.join(__dirname, 'axon.db');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  // Settings table
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
  )`);

  // Agents table
  db.run(`CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    agent_id INTEGER,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    avatar TEXT,
    active BOOLEAN DEFAULT 0,
    prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Conversations table
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    session_id TEXT,
    sender_type TEXT,
    sender_name TEXT,
    message TEXT,
    avatar TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    tokens INTEGER DEFAULT 0
  )`);

  // Memory tags table
  db.run(`CREATE TABLE IF NOT EXISTS memory_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    message_id INTEGER,
    agent_id INTEGER,
    tag TEXT,
    reward REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Specializations table
  db.run(`CREATE TABLE IF NOT EXISTS specializations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Routes

// Get all settings
app.get('/api/settings/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  
  db.all('SELECT setting_key, setting_value FROM settings WHERE user_id = ?', [userId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Convert array to object
    const settings = {};
    rows.forEach(row => {
      try {
        settings[row.setting_key] = JSON.parse(row.setting_value);
      } catch {
        settings[row.setting_key] = row.setting_value;
      }
    });
    
    res.json(settings);
  });
});

// Save settings
app.post('/api/settings/:userId?', asyncHandler(async (req, res) => {
  const userId = req.params.userId || 'default';
  const settings = req.body;
  
  // Handle API keys separately if provided
  if (settings.agentApiKeys && Object.keys(settings.agentApiKeys).length > 0) {
    try {
      await apiKeyService.saveApiKeys(userId, settings.agentApiKeys);
      // Don't save raw API keys to settings table
      delete settings.agentApiKeys;
    } catch (error) {
      console.error('Error saving API keys:', error);
      return res.status(500).json({ error: 'Failed to save API keys', details: error.message });
    }
  }
  
  const stmt = db.prepare(`INSERT OR REPLACE INTO settings (user_id, setting_key, setting_value, updated_at) 
                          VALUES (?, ?, ?, CURRENT_TIMESTAMP)`);
  
  Object.keys(settings).forEach(key => {
    const value = typeof settings[key] === 'object' ? JSON.stringify(settings[key]) : settings[key];
    stmt.run(userId, key, value);
  });
  
  stmt.finalize();
  res.json({ success: true });
}));

// Get API key status
app.get('/api/keys/status/:userId?', asyncHandler(async (req, res) => {
  const userId = req.params.userId || 'default';
  const status = apiKeyService.getApiKeyStatus(userId);
  res.json(status);
}))

// Get agents
app.get('/api/agents/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  
  db.all('SELECT * FROM agents WHERE user_id = ? ORDER BY agent_id', [userId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Save agents
app.post('/api/agents/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  const agents = req.body;
  
  // Clear existing agents
  db.run('DELETE FROM agents WHERE user_id = ?', [userId], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stmt = db.prepare(`INSERT INTO agents (user_id, agent_id, name, type, avatar, active, prompt) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)`);
    
    agents.forEach(agent => {
      stmt.run(userId, agent.id, agent.name, agent.type, agent.avatar, agent.active ? 1 : 0, agent.prompt || '');
    });
    
    stmt.finalize();
    res.json({ success: true });
  });
});

// Get specializations
app.get('/api/specializations/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  
  db.all('SELECT * FROM specializations WHERE user_id = ? ORDER BY id', [userId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Save specializations
app.post('/api/specializations/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  const specializations = req.body;
  
  // Clear existing specializations
  db.run('DELETE FROM specializations WHERE user_id = ?', [userId], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stmt = db.prepare(`INSERT INTO specializations (user_id, name, title, avatar) 
                            VALUES (?, ?, ?, ?)`);
    
    specializations.forEach(spec => {
      stmt.run(userId, spec.name, spec.title, spec.avatar);
    });
    
    stmt.finalize();
    res.json({ success: true });
  });
});

// Save conversation message
app.post('/api/conversations/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  const { session_id, sender_type, sender_name, message, avatar, tokens } = req.body;
  
  db.run(`INSERT INTO conversations (user_id, session_id, sender_type, sender_name, message, avatar, tokens) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, session_id, sender_type, sender_name, message, avatar, tokens || 0],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, success: true });
    }
  );
});

// Get conversation history
app.get('/api/conversations/:userId?/:sessionId?', (req, res) => {
  const userId = req.params.userId || 'default';
  const sessionId = req.params.sessionId;
  
  let query = 'SELECT * FROM conversations WHERE user_id = ?';
  const params = [userId];
  
  if (sessionId) {
    query += ' AND session_id = ?';
    params.push(sessionId);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT 100';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.reverse());
  });
});

// Save memory tag
app.post('/api/memory-tags/:userId?', (req, res) => {
  const userId = req.params.userId || 'default';
  const { message_id, agent_id, tag, reward } = req.body;
  
  db.run(`INSERT INTO memory_tags (user_id, message_id, agent_id, tag, reward) 
          VALUES (?, ?, ?, ?, ?)`,
    [userId, message_id, agent_id, tag, reward || 0],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, success: true });
    }
  );
});

// Get memory tags
app.get('/api/memory-tags/:userId?/:agentId?', (req, res) => {
  const userId = req.params.userId || 'default';
  const agentId = req.params.agentId;
  
  let query = 'SELECT * FROM memory_tags WHERE user_id = ?';
  const params = [userId];
  
  if (agentId) {
    query += ' AND agent_id = ?';
    params.push(agentId);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// === Memory API Endpoints (Recent Chats Access) ===

// Memory stats
app.get('/api/memory/stats', (req, res) => {
  const userId = req.query.userId || 'default';

  db.get(
    `SELECT COUNT(DISTINCT session_id) as totalSessions, COUNT(*) as totalMessages, MAX(timestamp) as lastSync
     FROM conversations WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      // Estimate memory usage from message content
      db.get(
        `SELECT SUM(LENGTH(message)) as totalBytes FROM conversations WHERE user_id = ?`,
        [userId],
        (err2, sizeRow) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({
            totalSessions: row?.totalSessions || 0,
            totalMessages: row?.totalMessages || 0,
            memoryUsage: sizeRow?.totalBytes || 0,
            lastSync: row?.lastSync || null
          });
        }
      );
    }
  );
});

// Recent sessions
app.get('/api/memory/sessions', (req, res) => {
  const userId = req.query.userId || 'default';
  const limit = parseInt(req.query.limit) || 5;

  db.all(
    `SELECT session_id, MIN(timestamp) as started, MAX(timestamp) as timestamp,
            COUNT(*) as messageCount, GROUP_CONCAT(DISTINCT sender_name) as agentNames,
            MIN(message) as firstMessage
     FROM conversations
     WHERE user_id = ? AND session_id IS NOT NULL
     GROUP BY session_id
     ORDER BY MAX(timestamp) DESC
     LIMIT ?`,
    [userId, limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const sessions = (rows || []).map(row => ({
        sessionId: row.session_id,
        topic: row.firstMessage ? row.firstMessage.substring(0, 80) + (row.firstMessage.length > 80 ? '...' : '') : 'Untitled Session',
        agents: row.agentNames ? row.agentNames.split(',') : [],
        messageCount: row.messageCount,
        timestamp: row.timestamp,
        started: row.started
      }));

      res.json(sessions);
    }
  );
});

// Agent evolution data
app.get('/api/memory/agent-evolution', (req, res) => {
  const userId = req.query.userId || 'default';

  db.all(
    `SELECT sender_name, COUNT(*) as interactionCount,
            COUNT(DISTINCT session_id) as sessionCount
     FROM conversations
     WHERE user_id = ? AND sender_type = 'agent'
     GROUP BY sender_name`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const evolution = {};
      (rows || []).forEach(row => {
        const stage = row.interactionCount > 100 ? 'Advanced' :
                      row.interactionCount > 50 ? 'Intermediate' :
                      row.interactionCount > 10 ? 'Developing' : 'Nascent';
        evolution[row.sender_name] = {
          evolutionStage: stage,
          interactionCount: row.interactionCount,
          sessionCount: row.sessionCount,
          skills: [],
          traits: {}
        };
      });

      // Enrich with memory tag data
      db.all(
        `SELECT mt.agent_id, mt.tag, AVG(mt.reward) as avgReward, COUNT(*) as count
         FROM memory_tags mt WHERE mt.user_id = ?
         GROUP BY mt.agent_id, mt.tag ORDER BY avgReward DESC`,
        [userId],
        (err2, tagRows) => {
          if (err2) return res.json(evolution);

          (tagRows || []).forEach(tag => {
            // Find agent by id in evolution data
            Object.values(evolution).forEach(agent => {
              if (tag.tag) {
                agent.skills.push(tag.tag);
                agent.traits[tag.tag] = tag.avgReward;
              }
            });
          });

          res.json(evolution);
        }
      );
    }
  );
});

// Consensus topics
app.get('/api/memory/consensus', (req, res) => {
  const userId = req.query.userId || 'default';

  // Find topics where multiple agents discussed similar content
  db.all(
    `SELECT session_id, GROUP_CONCAT(DISTINCT sender_name) as agents,
            COUNT(DISTINCT sender_name) as agentCount, COUNT(*) as messageCount,
            MIN(message) as sampleMessage
     FROM conversations
     WHERE user_id = ? AND sender_type = 'agent' AND session_id IS NOT NULL
     GROUP BY session_id
     HAVING agentCount > 1
     ORDER BY messageCount DESC
     LIMIT 10`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const topics = (rows || []).map(row => ({
        topic: row.sampleMessage ? row.sampleMessage.substring(0, 100) : 'Discussion',
        confidence: Math.min(row.agentCount / 3, 1),
        agents: row.agents ? row.agents.split(',') : [],
        messageCount: row.messageCount
      }));

      res.json(topics);
    }
  );
});

// Search knowledge base
app.post('/api/memory/search', (req, res) => {
  const userId = req.query.userId || 'default';
  const { query } = req.body;

  if (!query) return res.status(400).json({ error: 'Query is required' });

  // SQLite LIKE-based search
  const searchTerm = `%${query}%`;
  db.all(
    `SELECT id, session_id, sender_name, message, timestamp
     FROM conversations
     WHERE user_id = ? AND message LIKE ?
     ORDER BY timestamp DESC
     LIMIT 20`,
    [userId, searchTerm],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const results = (rows || []).map(row => ({
        topic: row.sender_name || 'Message',
        content: row.message.length > 300 ? row.message.substring(0, 300) + '...' : row.message,
        sessionId: row.session_id,
        timestamp: row.timestamp
      }));

      res.json(results);
    }
  );
});

// Export memories
app.get('/api/memory/export', (req, res) => {
  const userId = req.query.userId || 'default';

  db.all(
    `SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp`,
    [userId],
    (err, conversations) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(
        `SELECT * FROM memory_tags WHERE user_id = ? ORDER BY created_at`,
        [userId],
        (err2, tags) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const exportData = {
            exportDate: new Date().toISOString(),
            userId,
            conversations: conversations || [],
            memoryTags: tags || []
          };

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename=axon-memories-${new Date().toISOString().split('T')[0]}.json`);
          res.json(exportData);
        }
      );
    }
  );
});

// Cleanup old memories
app.post('/api/memory/cleanup', (req, res) => {
  const userId = req.query.userId || 'default';
  const { days } = req.body;

  if (!days || days < 1) return res.status(400).json({ error: 'Valid number of days is required' });

  db.run(
    `DELETE FROM conversations WHERE user_id = ? AND timestamp < datetime('now', '-' || ? || ' days')`,
    [userId, days],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, deleted: this.changes });
    }
  );
});

// Reset all memories
app.post('/api/memory/reset', (req, res) => {
  const userId = req.query.userId || 'default';

  db.run('DELETE FROM conversations WHERE user_id = ?', [userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    const deletedConversations = this.changes;
    db.run('DELETE FROM memory_tags WHERE user_id = ?', [userId], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true, deletedConversations, deletedTags: this.changes });
    });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// LLM chat endpoint (for non-streaming requests)
app.post('/api/chat/:userId?', async (req, res) => {
  const userId = req.params.userId || 'default';
  const { agents, message, settings, sessionId } = req.body;
  
  try {
    const responses = {};
    
    for (const agent of agents) {
      const agentConfig = {
        model: settings.agentModels?.[agent.type] || 'gpt-4o',
        parameters: settings.agentParameters[agent.type] || {},
        prompt: settings.agentPrompts[agent.type] || ''
      };
      
      // Use API key service to get the appropriate key
      let apiKey;
      try {
        // Try user-provided key first, then fall back to API key service
        apiKey = settings.agentApiKeys?.[agent.type] || apiKeyService.getApiKey(agent.type);
      } catch (error) {
        console.log(`Warning: No API key available for agent type: ${agent.type}`);
        responses[agent.id] = { error: `No API key configured for ${agent.type} agent. ${error.message}` };
        continue;
      }
      
      try {
        const response = await llmService.generateResponse(
          agentConfig,
          [{ role: 'user', content: message }],
          apiKey
        );
        
        responses[agent.id] = {
          content: response.content,
          usage: response.usage
        };
      } catch (error) {
        responses[agent.id] = { error: error.message };
      }
    }
    
    res.json({ responses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server with port conflict resolution
function startServer(port) {
  server.listen(port, () => {
    console.log(`AXON Backend server running on port ${port}`);
    console.log(`Database location: ${dbPath}`);
    
    // Initialize WebSocket service after server starts
    const WebSocketService = require('./websocket-service');
    wsService = new WebSocketService(server);
    console.log(`WebSocket server ready for connections`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});