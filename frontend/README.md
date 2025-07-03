# 🎨 Cursor AI Frontend

This folder contains the frontend application for Cursor AI - an AI-powered code editor platform.

## 📁 Structure

```
frontend/
├── index.html          # Main HTML file
├── script.js          # Main JavaScript application
├── styles.css         # CSS styles
├── package.json       # Frontend package configuration
└── README.md          # This file
```

## 🚀 Features

- **Monaco Editor Integration** - VS Code's editor engine
- **AI-Powered Assistance** - 7 specialized AI agents
- **Real-time Collaboration** - Multi-user editing with Socket.IO
- **GitHub Integration** - OAuth login and repository management
- **Project Management** - Create, edit, and manage coding projects
- **Modern UI** - VS Code-inspired dark theme

## 🛠️ Technology Stack

- **Editor**: Monaco Editor (VS Code engine)
- **Styling**: Custom CSS with CSS Grid and Flexbox
- **Icons**: Font Awesome
- **Real-time**: Socket.IO client
- **Authentication**: JWT with GitHub OAuth
- **API Communication**: Fetch API

## 📱 Deployment

### Static Hosting (Render, Netlify, Vercel)

This frontend is designed for static hosting and automatically detects the environment:

- **Development**: Points to `http://localhost:5000`
- **Production**: Points to `https://cursor-ai-backend.onrender.com`

### Environment Detection

The `script.js` file automatically detects the environment and configures API URLs:

```javascript
getApiBaseUrl() {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    } else {
        return 'https://cursor-ai-backend.onrender.com';
    }
}
```

### Deploy to Render

1. Connect your GitHub repository to Render
2. Create a new **Static Site**
3. Set publish directory to: `frontend`
4. No build command needed (static files)

### Deploy to Netlify

1. Connect your repository
2. Set publish directory to: `frontend`
3. No build command needed

### Deploy to Vercel

1. Import your repository
2. Set output directory to: `frontend`
3. No build command needed

## 🔧 Configuration

### Backend URL Configuration

The frontend automatically detects and configures the backend URL. If you need to customize it for your deployment:

1. Edit `script.js`
2. Update the `getApiBaseUrl()` method
3. Replace `cursor-ai-backend.onrender.com` with your backend URL

### API Endpoints

The frontend communicates with these backend endpoints:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/github/url` - GitHub OAuth URL
- `POST /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/me` - Get current user
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details

## 🎯 Key Components

### 1. Authentication System
- Login/Register forms
- GitHub OAuth integration
- JWT token management
- Auto-redirect after auth

### 2. Project Dashboard
- Recent projects display
- Quick action buttons
- User profile information
- Subscription status

### 3. Code Editor
- Monaco Editor integration
- Syntax highlighting for 15+ languages
- Auto-completion and IntelliSense
- File tab management

### 4. Real-time Collaboration
- Socket.IO integration
- Live cursor tracking
- Simultaneous editing
- User presence indicators

### 5. AI Assistant
- 7 specialized agents
- Chat interface
- Code analysis and suggestions
- Integrated help system

## 🎨 Styling

The application uses a modern dark theme inspired by VS Code:

- **Primary Colors**: Dark grays and blues
- **Accent Colors**: Blue (#007ACC) and orange
- **Typography**: -apple-system font stack
- **Layout**: CSS Grid and Flexbox
- **Responsive**: Mobile-friendly design

## 🔌 Integration Points

### Backend Integration
- RESTful API communication
- WebSocket for real-time features
- JWT authentication headers
- Error handling and notifications

### External Services
- **Monaco Editor**: CDN-loaded editor engine
- **Font Awesome**: Icon library
- **Socket.IO**: Real-time communication
- **GitHub**: OAuth authentication

## 🚀 Getting Started

### Development

1. Start the backend server (see backend/README.md)
2. Open `index.html` in a web browser
3. The app will connect to `http://localhost:5000`

### Production

1. Deploy backend to your hosting service
2. Update backend URL in `script.js` if needed
3. Deploy this frontend folder to static hosting
4. Configure environment variables in backend

## 📝 Environment Variables

The frontend doesn't use environment variables directly but connects to a backend that requires:

- `GEMINI_API_KEY` - Google AI API key
- `STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes in the frontend folder
4. Test with both development and production backends
5. Submit a pull request

## 📄 License

MIT License - see the LICENSE file for details.

---

**Built with ❤️ for the developer community**