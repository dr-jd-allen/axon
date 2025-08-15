const express = require('express');
const path = require('path');
const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Root route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>AXON Test Server</h1>
        <p>Server is working!</p>
        <ul>
          <li><a href="/index.html">Main Interface</a></li>
          <li><a href="/monitor.html">Monitor</a></li>
          <li><a href="/monitor-enhanced.html">Enhanced Monitor</a></li>
        </ul>
      </body>
    </html>
  `);
});

app.listen(3002, () => {
  console.log('Test server running on http://localhost:3002');
});