#!/bin/bash
# AXON Launcher for Linux/macOS

echo ""
echo "===================================="
echo "      AXON LAUNCHER v1.0          "
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "✗ Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js detected: $(node --version)"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "✗ Backend directory not found at $BACKEND_DIR"
    exit 1
fi

# Check/create .env file
if [ ! -f "$BACKEND_DIR/.env" ]; then
    if [ -f "$BACKEND_DIR/env.example" ]; then
        echo "Creating .env file from example..."
        cp "$BACKEND_DIR/env.example" "$BACKEND_DIR/.env"
        echo ""
        echo "IMPORTANT: Please edit backend/.env file and add your API keys!"
        echo ""
    fi
fi

# Install dependencies if needed
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    npm install
    cd "$SCRIPT_DIR"
fi

# Check if backend is already running
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "✓ Backend server is already running on port 3001"
else
    echo "Starting AXON backend server..."
    cd "$BACKEND_DIR"
    node server.js &
    BACKEND_PID=$!
    cd "$SCRIPT_DIR"
    
    # Wait for backend to start
    echo "Waiting for backend to initialize..."
    for i in {1..10}; do
        if curl -s http://localhost:3001/api/health > /dev/null; then
            echo "✓ Backend is ready!"
            break
        fi
        sleep 1
    done
fi

# Open frontend
echo "Opening AXON in your browser..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$SCRIPT_DIR/index.html"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open "$SCRIPT_DIR/index.html"
fi

echo ""
echo "===================================="
echo "    AXON is now running!"
echo "===================================="
echo ""
echo "Backend:  http://localhost:3001"
echo "Frontend: file://$SCRIPT_DIR/index.html"
echo ""
echo "Press Ctrl+C to stop AXON"
echo ""

# Keep script running
if [ ! -z "$BACKEND_PID" ]; then
    wait $BACKEND_PID
else
    tail -f /dev/null
fi