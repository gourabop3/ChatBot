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
const githubRoutes = require('./routes/github');
const agentRoutes = require('./routes/agents');
const collaborationRoutes = require('./routes/collaboration');

// Import services
const CollaborationService = require('./services/collaborationService');
const AgentService = require('./services/agentService');
const GitService = require('./services/gitService');

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
const collaborationService = new CollaborationService(io);
const agentService = new AgentService(io);
const gitService = new GitService();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`👤 User connected: ${socket.id}`);

    // Join project room
    socket.on('join-project', (projectId) => {
        socket.join(projectId);
        collaborationService.handleUserJoin(socket, projectId);
        console.log(`📁 User ${socket.id} joined project ${projectId}`);
    });

    // Handle code changes for real-time collaboration
    socket.on('code-change', (data) => {
        collaborationService.handleCodeChange(socket, data);
    });

    // Handle cursor movement
    socket.on('cursor-move', (data) => {
        collaborationService.handleCursorMove(socket, data);
    });

    // Handle AI agent requests
    socket.on('agent-request', async (data) => {
        await agentService.handleAgentRequest(socket, data);
    });

    // Handle file operations
    socket.on('file-operation', (data) => {
        collaborationService.handleFileOperation(socket, data);
    });

    // Handle GitHub operations
    socket.on('git-operation', async (data) => {
        await gitService.handleGitOperation(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        collaborationService.handleUserLeave(socket);
        console.log(`👋 User disconnected: ${socket.id}`);
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/collaboration', collaborationRoutes);

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