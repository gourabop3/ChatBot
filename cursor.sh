#!/bin/bash

# Cursor AI - Development Setup for Cursor IDE
echo "🎯 Cursor AI - Optimized Development Setup for Cursor IDE"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

print_cursor() {
    echo -e "${PURPLE}[CURSOR]${NC} $1"
}

print_dev() {
    echo -e "${CYAN}[DEV]${NC} $1"
}

# Check if running in Cursor IDE
check_cursor_env() {
    if [[ "$TERM_PROGRAM" == "cursor" ]] || [[ -n "$CURSOR_SESSION" ]] || [[ -n "$CURSOR_WORKSPACE" ]]; then
        print_cursor "Detected Cursor IDE environment ✓"
        return 0
    else
        print_warning "Not detected in Cursor IDE - script optimized for Cursor but will work in any environment"
        return 1
    fi
}

# Quick dependency check
check_dependencies() {
    print_status "Checking development dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js 16+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js 16+ required. Current: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js $(node -v)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found"
        exit 1
    fi
    
    print_success "npm $(npm -v)"
}

# Setup environment for development
setup_dev_environment() {
    print_dev "Setting up development environment..."
    
    # Check and copy .env file
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            print_status "Creating .env from example..."
            cp backend/.env.example backend/.env
            print_warning "Edit backend/.env with your API keys before running servers"
        else
            print_error "No .env.example found. Create backend/.env manually."
        fi
    else
        print_success "Environment file exists"
    fi
    
    # Install dependencies if needed
    if [ ! -d "backend/node_modules" ]; then
        print_status "Installing backend dependencies..."
        cd backend && npm install && cd ..
        print_success "Backend dependencies installed"
    else
        print_success "Backend dependencies already installed"
    fi
}

# Development mode with hot reload
start_dev_mode() {
    print_dev "Starting development mode with hot reload..."
    
    # Create a simple development configuration
    cat > .cursor-dev.json << EOF
{
  "name": "Cursor AI Development",
  "type": "compound",
  "configurations": [
    {
      "name": "Backend Server",
      "type": "node",
      "request": "launch",
      "program": "backend/server.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"]
    }
  ]
}
EOF
    
    print_success "Created .cursor-dev.json for debugging"
    
    # Start backend in development mode
    print_status "Starting backend server with hot reload..."
    cd backend
    
    # Check if nodemon is available for hot reload
    if npm list nodemon &> /dev/null || npm list -g nodemon &> /dev/null; then
        print_dev "Using nodemon for hot reload"
        npm run dev &
    else
        print_dev "Starting with standard node"
        node server.js &
    fi
    
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to start
    sleep 3
    
    # Check backend health
    if curl -s http://localhost:5000/api/health &> /dev/null; then
        print_success "Backend server running on http://localhost:5000"
    else
        print_error "Backend failed to start"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    
    # Start frontend with live reload
    print_status "Starting frontend with live reload..."
    
    if command -v live-server &> /dev/null; then
        live-server --port=3000 --host=localhost --quiet &
        FRONTEND_PID=$!
        print_success "Frontend server with live-server on http://localhost:3000"
    elif command -v python3 &> /dev/null; then
        python3 -m http.server 3000 &
        FRONTEND_PID=$!
        print_success "Frontend server with Python on http://localhost:3000"
    else
        print_warning "Install live-server for better development experience: npm install -g live-server"
        print_error "No suitable server found for frontend"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
}

# Show development information
show_dev_info() {
    echo ""
    echo "========================================================"
    echo -e "${PURPLE}🎯 Cursor AI Development Ready!${NC}"
    echo "========================================================"
    echo ""
    echo -e "${CYAN}📱 Frontend:${NC} http://localhost:3000"
    echo -e "${CYAN}🔧 Backend API:${NC} http://localhost:5000"
    echo -e "${CYAN}📊 Health:${NC} http://localhost:5000/api/health"
    echo ""
    echo -e "${PURPLE}🎯 Cursor IDE Tips:${NC}"
    echo "• Use Ctrl+Shift+P → 'Debug: Start Debugging' to debug backend"
    echo "• AI chat in Cursor can help with code improvements"
    echo "• Use Cursor's code completion alongside the project's AI features"
    echo "• Check .cursor-dev.json for debugging configuration"
    echo ""
    echo -e "${YELLOW}⚠️  Development Setup:${NC}"
    echo "1. Edit backend/.env with your API keys:"
    echo "   - GEMINI_API_KEY (Google AI Studio)"
    echo "   - STRIPE_SECRET_KEY & STRIPE_PUBLISHABLE_KEY"
    echo "   - GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET"
    echo ""
    echo -e "${GREEN}🚀 Quick Development Commands:${NC}"
    echo "• npm run dev (in backend/) - Start with hot reload"
    echo "• npm test (in backend/) - Run tests"
    echo "• npm run lint (in backend/) - Code linting"
    echo ""
    echo -e "${BLUE}📝 Project Structure:${NC}"
    echo "• frontend/ - Static web files"
    echo "• backend/ - Node.js API server"
    echo "• *.md files - Documentation and guides"
    echo ""
    echo -e "${CYAN}Press Ctrl+C to stop development servers${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    echo ""
    print_status "Stopping development servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    print_success "Development environment stopped. Happy coding in Cursor! 🎯"
    exit 0
}

# Main execution
main() {
    check_cursor_env
    check_dependencies
    setup_dev_environment
    start_dev_mode
    show_dev_info
    
    # Trap Ctrl+C for cleanup
    trap cleanup SIGINT
    
    # Keep script running
    wait
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        echo "Cursor AI - Development Setup for Cursor IDE"
        echo ""
        echo "Usage: ./cursor.sh [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --setup-only   Only setup environment, don't start servers"
        echo "  --quick        Skip dependency checks (faster startup)"
        echo ""
        echo "This script optimizes the development environment for Cursor IDE users."
        exit 0
        ;;
    --setup-only)
        check_cursor_env
        check_dependencies
        setup_dev_environment
        print_success "Environment setup complete. Run ./cursor.sh to start servers."
        exit 0
        ;;
    --quick)
        print_cursor "Quick mode - skipping some checks"
        setup_dev_environment
        start_dev_mode
        show_dev_info
        trap cleanup SIGINT
        wait
        ;;
    *)
        main
        ;;
esac