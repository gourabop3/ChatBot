#!/bin/bash

# Cursor AI - Complete System Startup Script
echo "🚀 Starting Cursor AI - Complete Full-Stack Code Editor Platform"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) ✓"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

print_success "npm $(npm -v) ✓"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    print_warning "MongoDB is not installed or not in PATH."
    print_warning "Please install MongoDB and ensure it's running on localhost:27017"
else
    print_success "MongoDB found ✓"
fi

# Check if backend directory exists
if [ ! -d "backend" ]; then
    print_error "Backend directory not found. Please run this script from the project root."
    exit 1
fi

# Check if .env exists in backend
if [ ! -f "backend/.env" ]; then
    print_warning ".env file not found in backend directory"
    if [ -f "backend/.env.example" ]; then
        print_status "Copying .env.example to .env..."
        cp backend/.env.example backend/.env
        print_warning "Please edit backend/.env with your actual configuration values"
        print_warning "Required: GEMINI_API_KEY, STRIPE keys, GITHUB OAuth keys"
    else
        print_error "No .env.example file found. Please create backend/.env manually."
        exit 1
    fi
fi

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend

if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install backend dependencies"
        exit 1
    fi
    print_success "Backend dependencies installed ✓"
else
    print_success "Backend dependencies already installed ✓"
fi

# Check if MongoDB is running
print_status "Checking MongoDB connection..."
if ! nc -z localhost 27017 2>/dev/null; then
    print_warning "MongoDB is not running on localhost:27017"
    print_status "Attempting to start MongoDB..."
    
    # Try different ways to start MongoDB
    if command -v systemctl &> /dev/null; then
        sudo systemctl start mongod
    elif command -v brew &> /dev/null; then
        brew services start mongodb/brew/mongodb-community
    else
        print_warning "Please start MongoDB manually and run this script again"
    fi
    
    # Wait a moment and check again
    sleep 3
    if ! nc -z localhost 27017 2>/dev/null; then
        print_error "Could not connect to MongoDB. Please start MongoDB manually."
        print_error "Run: sudo systemctl start mongod (Linux) or brew services start mongodb/brew/mongodb-community (macOS)"
        exit 1
    fi
fi

print_success "MongoDB connection ✓"

# Start backend server
print_status "Starting backend server..."
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Check if backend is running
if ! curl -s http://localhost:5000/api/health &> /dev/null; then
    print_error "Backend server failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

print_success "Backend server started on http://localhost:5000 ✓"

# Go back to root directory
cd ..

# Start frontend server
print_status "Starting frontend server..."

# Check if live-server is available
if command -v live-server &> /dev/null; then
    live-server --port=3000 --host=localhost &
    FRONTEND_PID=$!
    print_success "Frontend server started with live-server on http://localhost:3000 ✓"
elif command -v python3 &> /dev/null; then
    python3 -m http.server 3000 &
    FRONTEND_PID=$!
    print_success "Frontend server started with Python on http://localhost:3000 ✓"
elif command -v python &> /dev/null; then
    python -m http.server 3000 &
    FRONTEND_PID=$!
    print_success "Frontend server started with Python on http://localhost:3000 ✓"
else
    print_error "No suitable server found. Please install live-server or Python"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Display startup information
echo ""
echo "=================================================================="
echo -e "${GREEN}🎉 Cursor AI is now running!${NC}"
echo "=================================================================="
echo ""
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:5000"
echo -e "${BLUE}📊 Health Check:${NC} http://localhost:5000/api/health"
echo ""
echo -e "${YELLOW}⚠️  Important Setup Steps:${NC}"
echo "1. Edit backend/.env with your API keys:"
echo "   - GEMINI_API_KEY (from Google AI Studio)"
echo "   - STRIPE_SECRET_KEY & STRIPE_PUBLISHABLE_KEY"
echo "   - GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET"
echo ""
echo "2. Set up Stripe webhook endpoint:"
echo "   - URL: http://localhost:5000/api/payments/webhook"
echo "   - Events: customer.subscription.*, invoice.payment_*"
echo ""
echo "3. Configure GitHub OAuth app:"
echo "   - Authorization callback URL: http://localhost:3000/auth/github/callback"
echo ""
echo -e "${GREEN}🚀 Features Available:${NC}"
echo "✅ AI-powered code editor with Monaco Editor"
echo "✅ Real-time collaboration"
echo "✅ GitHub integration"
echo "✅ Stripe payment processing"
echo "✅ 7 specialized AI agents"
echo "✅ Project management & templates"
echo "✅ User authentication & profiles"
echo ""
echo -e "${BLUE}🔧 Development URLs:${NC}"
echo "• API Documentation: Check COMPLETE_SYSTEM_GUIDE.md"
echo "• Socket.IO Test: http://localhost:5000/socket.io/"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    print_status "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    print_success "All servers stopped. Goodbye! 👋"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Keep the script running
wait