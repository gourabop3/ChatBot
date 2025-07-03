#!/bin/bash

# 🚀 Cursor AI Deployment Script
# This script helps deploy Cursor AI to Render or other platforms

echo "🚀 Cursor AI Deployment Helper"
echo "================================"

# Check if we're in the right directory
if [ ! -f "render.yaml" ]; then
    echo "❌ Error: render.yaml not found. Please run this script from the project root."
    exit 1
fi

# Check if frontend folder exists
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend folder not found."
    exit 1
fi

# Check if backend folder exists
if [ ! -d "backend" ]; then
    echo "❌ Error: backend folder not found."
    exit 1
fi

echo "✅ Project structure validated"

# Display project structure
echo ""
echo "📁 Project Structure:"
echo "├── frontend/          # Static frontend files"
echo "│   ├── index.html"
echo "│   ├── script.js"
echo "│   ├── styles.css"
echo "│   └── package.json"
echo "├── backend/           # Node.js backend"
echo "│   ├── server.js"
echo "│   ├── package.json"
echo "│   └── routes/"
echo "├── render.yaml        # Render deployment config"
echo "└── RENDER_DEPLOYMENT_GUIDE.md"

echo ""
echo "🔧 Deployment Options:"
echo "1. Deploy to Render (using Blueprint)"
echo "2. Deploy Frontend Only (Static Site)"
echo "3. Deploy Backend Only (Web Service)"
echo "4. Manual Deployment Guide"
echo "5. Exit"

read -p "Choose an option (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🌐 Deploying to Render using Blueprint..."
        echo ""
        echo "Follow these steps:"
        echo "1. Go to https://render.com"
        echo "2. Click 'New +' → 'Blueprint'"
        echo "3. Connect your GitHub repository"
        echo "4. Render will detect render.yaml and create:"
        echo "   - cursor-ai-backend (Web Service)"
        echo "   - cursor-ai-frontend (Static Site)"
        echo ""
        echo "📝 Don't forget to set environment variables:"
        echo "   - MONGODB_URI"
        echo "   - JWT_SECRET"
        echo "   - GEMINI_API_KEY"
        echo "   - STRIPE_SECRET_KEY"
        echo "   - STRIPE_PUBLISHABLE_KEY"
        echo "   - STRIPE_WEBHOOK_SECRET"
        echo "   - GITHUB_CLIENT_ID"
        echo "   - GITHUB_CLIENT_SECRET"
        ;;
    2)
        echo ""
        echo "🎨 Deploying Frontend Only..."
        echo ""
        echo "Frontend is in the 'frontend/' folder and can be deployed to:"
        echo "• Render (Static Site)"
        echo "• Netlify"
        echo "• Vercel"
        echo "• GitHub Pages"
        echo ""
        echo "For Render:"
        echo "1. New → Static Site"
        echo "2. Connect repository"
        echo "3. Set Publish Directory: frontend"
        echo "4. No build command needed"
        ;;
    3)
        echo ""
        echo "⚙️  Deploying Backend Only..."
        echo ""
        echo "Backend is in the 'backend/' folder:"
        echo "1. New → Web Service"
        echo "2. Connect repository"
        echo "3. Build Command: cd backend && npm install"
        echo "4. Start Command: cd backend && npm start"
        echo "5. Set all required environment variables"
        ;;
    4)
        echo ""
        echo "📖 Opening deployment guide..."
        if command -v open &> /dev/null; then
            open RENDER_DEPLOYMENT_GUIDE.md
        elif command -v xdg-open &> /dev/null; then
            xdg-open RENDER_DEPLOYMENT_GUIDE.md
        else
            echo "Please open RENDER_DEPLOYMENT_GUIDE.md manually"
        fi
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment preparation complete!"
echo ""
echo "📚 Additional Resources:"
echo "• Frontend README: frontend/README.md"
echo "• Backend README: backend/README.md"
echo "• Complete Guide: COMPLETE_SYSTEM_GUIDE.md"
echo "• Deployment Guide: RENDER_DEPLOYMENT_GUIDE.md"
echo "• GitHub OAuth Setup: GITHUB_OAUTH_SETUP.md"
echo "• Quick GitHub Setup: QUICK_GITHUB_SETUP.md"
echo ""
echo "🆘 Need help? Check the troubleshooting section in the deployment guide."