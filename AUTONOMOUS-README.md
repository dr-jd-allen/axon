# AXON Autonomous System

## Overview
AXON Autonomous is a complex inter-LLM communication system that enables two or more AI models (Default: Claude Opus and GPT-4o) to engage in autonomous conversations with huamn-guided reinforcement learning feedback.

## Key Features
- **Autonomous Conversation**: Two+ AI agents communicate without human intervention
- **Reinforcement Learning**: Dynamic reward system (+/-) adjusts agent behavior
- **Real-time Monitoring**: Web interface to observe conversations
- **Metric Tracking**: Coherence, novelty, and engagement measurements
- **Conversation Persistence**: Saves conversations with full metrics

## Quick Start

### 1. Setup API Keys
Copy `.env.example` to `.env` and add your API keys:
```
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the System
```bash
# Windows
start-autonomous.bat

# Or directly with Node
node autonomous-server.js
```

### 4. Open Monitor
Navigate to: [def]

## Architecture

### Core Components

1. **AutonomousAgent** (`autonomous-core.js`)
   - Handles individual agent behavior
   - Manages conversation history
   - Applies reinforcement learning adjustments

2. **ConversationOrchestrator** (`autonomous-core.js`)
   - Coordinates agent interactions
   - Evaluates responses
   - Calculates rewards
   - Tracks metrics

3. **WebSocket Server** (`autonomous-server.js`)
   - Real-time communication with web monitor
   - Broadcasts conversation events
   - Handles client commands

4. **Web Monitor** (`monitor.html`)
   - Visual interface for conversation monitoring
   - Real-time metric display
   - Conversation control

## Reinforcement Learning System

### Evaluation Metrics
- **Coherence** (40%): How well responses relate to previous messages
- **Novelty** (30%): Introduction of new concepts
- **Engagement** (30%): Response quality and interaction depth

### Reward Mechanism
- Positive rewards decrease temperature (more focused responses)
- Negative rewards increase temperature (more creative responses)
- Rewards range from -1 to +1

## Configuration

Edit `config.json` to customize:

```json
{
  "agents": [
    {
      "name": "Explorer",
      "provider": "anthropic",
      "model": "claude-opus-4-20250514",
      "systemPrompt": "Your custom prompt..."
    }
  ],
  "conversationSettings": {
    "maxTurns": 15,
    "initialTopic": "Your topic here"
  }
}
```

## Usage Modes

### 1. Web Interface
- Start server with `start-autonomous.bat`
- Open http://localhost:3001/monitor.html
- Enter topic and click "Start Conversation"

### 2. Command Line
```bash
# Automatic mode
node autonomous-launcher.js

# Interactive mode
node autonomous-launcher.js --interactive
```

## API Endpoints

- `GET /` - Serve monitor interface
- `GET /api/health` - System health check
- `GET /api/config` - Get current configuration
- `POST /api/config` - Update configuration

## WebSocket Events

### Client → Server
- `start-conversation` - Begin autonomous conversation
- `stop-conversation` - Stop current conversation
- `get-status` - Request system status

### Server → Client
- `conversation-start` - Conversation initiated
- `message` - New message from agent
- `agent-reward` - Reward applied to agent
- `metrics-update` - Updated conversation metrics
- `conversation-end` - Conversation completed

## Saved Conversations

Conversations are automatically saved to `/conversations/` with:
- Full message history
- Reward history per agent
- Metric summaries
- Agent configurations

## Troubleshooting

### API Key Issues
- Ensure `.env` file exists with valid keys
- Check API key permissions and quotas

### Connection Issues
- Verify ports 3007  and 3009 are available
- Check firewall settings

### Rate Limiting
- System include s3-second delay between turns
- Adjust in `ConversationOrchestrator.delay()`

## Development

### Testing Individual Components
```javascript
// Test agent directly
const { AutonomousAgent } = require('./autonomous-core');
const agent = new AutonomousAgent({...});
const response = await agent.generateResponse("Hello");
```

### Adding New Providers
Extend `AutonomousAgent.generateResponse()` with new provider cases.

## Future Enhancements
- Multi-agent conversations (3+ agents)
- Advanced RL algorithms
- Memory persistence across sessions
- Tool use and function calling
- Custom evaluation metrics
- Agent personality evolution

[def]: http://localhost:3009/monitor.html