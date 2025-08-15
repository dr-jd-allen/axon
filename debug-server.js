const express = require('express');
const path = require('path');
const fs = require('fs');

console.log('=== DEBUG SERVER STARTUP ===');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('');

// Check what files are visible
console.log('Files in current directory:');
fs.readdirSync('.').forEach(file => {
  console.log('  -', file);
});

console.log('\nChecking frontend directory:');
const frontendPath = path.join(__dirname, 'frontend');
console.log('Frontend path:', frontendPath);
console.log('Frontend exists?', fs.existsSync(frontendPath));

if (fs.existsSync(frontendPath)) {
  console.log('Frontend files:');
  fs.readdirSync(frontendPath).forEach(file => {
    console.log('  -', file);
  });
}

const app = express();

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files
app.use(express.static(frontendPath));

// Root handler
app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  console.log('Trying to serve:', indexPath);
  console.log('File exists?', fs.existsSync(indexPath));
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <h1>Frontend files not found!</h1>
      <p>Looking in: ${frontendPath}</p>
      <p>Working directory: ${process.cwd()}</p>
      <p>Script directory: ${__dirname}</p>
    `);
  }
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`\nDebug server running on http://localhost:${PORT}`);
});