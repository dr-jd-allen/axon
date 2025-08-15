const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Absolute path to frontend
const FRONTEND_PATH = 'C:\\Users\\jdall\\axon\\frontend';

console.log('Starting simple server...');
console.log('Serving files from:', FRONTEND_PATH);

// Serve frontend files
app.use(express.static(FRONTEND_PATH));

// Explicit route for root
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

// Handle API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Simple server running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <h1>404 - Not Found</h1>
    <p>Requested: ${req.url}</p>
    <p>Available files:</p>
    <ul>
      <li><a href="/index.html">/index.html</a></li>
      <li><a href="/monitor.html">/monitor.html</a></li>
      <li><a href="/monitor-enhanced.html">/monitor-enhanced.html</a></li>
    </ul>
  `);
});

app.listen(3001, () => {
  console.log('Simple server running on http://localhost:3001');
  console.log('Try accessing:');
  console.log('  http://localhost:3001/');
  console.log('  http://localhost:3001/index.html');
});