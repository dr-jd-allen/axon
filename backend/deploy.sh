#!/bin/bash

# AXON Backend Deployment Script

echo "🚀 AXON Backend Deployment Script"
echo "================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
fi

# Create database directory if needed
mkdir -p data

# Check if PM2 is installed (for production)
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 detected - using for process management"
    
    # Stop existing instance if running
    pm2 stop axon-backend 2>/dev/null || true
    
    # Start with PM2
    pm2 start server.js --name axon-backend
    pm2 save
    
    echo "✅ Backend started with PM2"
    echo "📊 View logs: pm2 logs axon-backend"
    echo "🔄 Restart: pm2 restart axon-backend"
else
    echo "💡 PM2 not detected - starting in foreground"
    echo "   For production, install PM2: npm install -g pm2"
    echo ""
    echo "Starting server..."
    node server.js
fi