const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const paymentRoutes = require('./routes/payments');

// Import services (optional)
let CollaborationService, AgentService, GitService;

try {
    CollaborationService = require('./services/collaborationService');
    AgentService = require('./services/agentService');
    GitService = require('./services/gitService');
} catch (error) {
    console.warn('⚠️ Warning: Some service modules could not be loaded:', error.message);
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cursor-ai', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
    console.log('✅ Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
});

// Initialize services
let collaborationService, agentService, gitService;

try {
    if (CollaborationService) {
        collaborationService = new CollaborationService(io);
    }
    if (AgentService) {
        agentService = new AgentService(io);
    }
    if (GitService) {
        gitService = new GitService();
    }
    console.log('✅ Services initialized successfully');
} catch (error) {
    console.warn('⚠️ Warning: Some services failed to initialize:', error.message);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`👤 User connected: ${socket.id}`);

    // Join project room
    socket.on('join-project', (projectId) => {
        socket.join(projectId);
        if (collaborationService) {
            collaborationService.handleUserJoin(socket, projectId);
        }
        console.log(`📁 User ${socket.id} joined project ${projectId}`);
    });

    // Handle code changes for real-time collaboration
    socket.on('code-change', (data) => {
        if (collaborationService) {
            collaborationService.handleCodeChange(socket, data);
        }
    });

    // Handle cursor movement
    socket.on('cursor-move', (data) => {
        if (collaborationService) {
            collaborationService.handleCursorMove(socket, data);
        }
    });

    // Handle AI agent requests
    socket.on('agent-request', async (data) => {
        if (agentService) {
            await agentService.handleAgentRequest(socket, data);
        } else {
            socket.emit('agent-response', { error: 'Agent service not available' });
        }
    });

    // Handle file operations
    socket.on('file-operation', (data) => {
        if (collaborationService) {
            collaborationService.handleFileOperation(socket, data);
        }
    });

    // Handle GitHub operations
    socket.on('git-operation', async (data) => {
        if (gitService) {
            await gitService.handleGitOperation(socket, data);
        } else {
            socket.emit('git-response', { error: 'Git service not available' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (collaborationService) {
            collaborationService.handleUserLeave(socket);
        }
        console.log(`👋 User disconnected: ${socket.id}`);
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/payments', paymentRoutes);

// Simple placeholder routes for missing endpoints
app.get('/api/github/*', (req, res) => {
    res.json({ message: 'GitHub integration coming soon' });
});

app.get('/api/agents/*', (req, res) => {
    res.json({ message: 'AI agents coming soon' });
});

app.get('/api/collaboration/*', (req, res) => {
    res.json({ message: 'Collaboration features coming soon' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Process terminated');
        mongoose.connection.close();
    });
});

module.exports = app;