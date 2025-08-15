# AXON Backend Server

Backend server for the Agentic Executive Oversight Network (AXON) - enabling real-time inter-LLM communication.

## Features

- **Settings Persistence**: Store and retrieve agent configurations, API keys, and parameters
- **Real-time Communication**: WebSocket support for streaming LLM responses
- **Multi-LLM Support**: Integrated with OpenAI and Anthropic APIs
- **Database Storage**: SQLite database for conversations, settings, and agent data
- **Memory Management**: Support for conversation history and reinforcement learning
- **Secure API Keys**: Encrypted storage of sensitive API keys

## Prerequisites

- Node.js 16+ 
- npm or yarn

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://dr-jd-allen.github.io
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Endpoints

### Settings Management
- `GET /api/settings/:userId` - Get user settings
- `POST /api/settings/:userId` - Save user settings

### Agent Management
- `GET /api/agents/:userId` - Get user's agents
- `POST /api/agents/:userId` - Save agents

### Specializations
- `GET /api/specializations/:userId` - Get specializations
- `POST /api/specializations/:userId` - Save specializations

### Conversations
- `POST /api/conversations/:userId` - Save a message
- `GET /api/conversations/:userId/:sessionId` - Get conversation history

### Chat
- `POST /api/chat/:userId` - Send chat message (non-streaming)

### WebSocket Events

#### Client to Server:
- `chat` - Send a message to agents
- `start_auto_discussion` - Start automated agent discussion
- `generate_summary` - Generate conversation summary

#### Server to Client:
- `connected` - Connection established
- `agent_typing` - Agent is typing
- `agent_response_chunk` - Streaming response chunk
- `agent_response_complete` - Response completed
- `auto_discussion_message` - Auto-discussion update
- `summary_generated` - Summary ready

## Database Schema

The SQLite database includes tables for:
- `settings` - User settings and configurations
- `agents` - Agent definitions and states
- `conversations` - Message history
- `memory_tags` - Reinforcement learning tags
- `specializations` - Agent type definitions

## Deployment Options

### Local Development
The server runs on `http://localhost:3001` by default.

### Production Deployment

#### Option 1: Node.js VPS
1. Clone the repository
2. Install dependencies
3. Set environment variables
4. Use PM2 or similar for process management

#### Option 2: Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

#### Option 3: Serverless (with modifications)
- AWS Lambda with API Gateway
- Vercel Functions
- Netlify Functions

## Security Considerations

1. **API Keys**: Store securely in environment variables
2. **CORS**: Configure allowed origins properly
3. **Rate Limiting**: Implement for production use
4. **HTTPS**: Use SSL certificates in production
5. **Input Validation**: Sanitize all user inputs

## Frontend Integration

Update your frontend's configuration:

```javascript
const BACKEND_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://your-backend-url.com';

const WS_URL = window.location.hostname === 'localhost'
    ? 'ws://localhost:3001'
    : 'wss://your-backend-url.com';
```

## Troubleshooting

### Database Issues
- Check write permissions for `axon.db`
- Delete `axon.db` to reset database

### WebSocket Connection
- Ensure CORS is properly configured
- Check firewall settings for WebSocket ports

### API Key Errors
- Verify API keys are correctly set
- Check rate limits on LLM providers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details