const Project = require('../models/Project');
const User = require('../models/User');

class CollaborationService {
    constructor(io) {
        this.io = io;
        this.activeUsers = new Map(); // Track active users per project
        this.cursors = new Map(); // Track cursor positions
        this.operationQueue = new Map(); // Track pending operations
    }

    // Handle user joining a project
    async handleUserJoin(socket, projectId) {
        try {
            const userId = socket.userId;
            if (!userId) {
                socket.emit('collaboration-error', { error: 'User not authenticated' });
                return;
            }

            // Verify user has access to project
            const project = await Project.findById(projectId);
            if (!project || !project.canUserAccess(userId)) {
                socket.emit('collaboration-error', { error: 'Access denied to project' });
                return;
            }

            // Join project room
            socket.join(projectId);

            // Track active user
            if (!this.activeUsers.has(projectId)) {
                this.activeUsers.set(projectId, new Map());
            }

            const projectUsers = this.activeUsers.get(projectId);
            const user = await User.findById(userId).select('username firstName lastName avatar');
            
            projectUsers.set(socket.id, {
                userId,
                socketId: socket.id,
                username: user.username,
                fullName: user.fullName,
                avatar: user.avatar,
                joinedAt: new Date(),
                lastActivity: new Date(),
                cursor: null
            });

            // Notify others about new user
            socket.to(projectId).emit('user-joined', {
                socketId: socket.id,
                user: {
                    id: userId,
                    username: user.username,
                    fullName: user.fullName,
                    avatar: user.avatar
                }
            });

            // Send current active users to new user
            const activeUsersList = Array.from(projectUsers.values())
                .filter(u => u.socketId !== socket.id)
                .map(u => ({
                    socketId: u.socketId,
                    user: {
                        id: u.userId,
                        username: u.username,
                        fullName: u.fullName,
                        avatar: u.avatar
                    },
                    cursor: u.cursor
                }));

            socket.emit('active-users', { users: activeUsersList });

            // Send current project state
            socket.emit('project-joined', {
                projectId,
                activeUsers: activeUsersList.length + 1
            });

            console.log(`User ${user.username} joined project ${projectId}`);

        } catch (error) {
            console.error('User join error:', error);
            socket.emit('collaboration-error', { error: 'Failed to join project' });
        }
    }

    // Handle user leaving
    handleUserLeave(socket) {
        try {
            // Find and remove user from all projects
            for (const [projectId, projectUsers] of this.activeUsers) {
                if (projectUsers.has(socket.id)) {
                    const userData = projectUsers.get(socket.id);
                    projectUsers.delete(socket.id);

                    // Notify others about user leaving
                    socket.to(projectId).emit('user-left', {
                        socketId: socket.id,
                        userId: userData.userId
                    });

                    // Remove cursor
                    this.cursors.delete(socket.id);

                    // Clean up empty project rooms
                    if (projectUsers.size === 0) {
                        this.activeUsers.delete(projectId);
                    }

                    console.log(`User ${userData.username} left project ${projectId}`);
                    break;
                }
            }
        } catch (error) {
            console.error('User leave error:', error);
        }
    }

    // Handle real-time code changes
    async handleCodeChange(socket, data) {
        try {
            const { projectId, filePath, operation, content, position, timestamp } = data;
            
            if (!projectId || !filePath) {
                socket.emit('collaboration-error', { error: 'Missing project or file information' });
                return;
            }

            // Verify user has write access
            const project = await Project.findById(projectId);
            if (!project || !project.canUserAccess(socket.userId, 'write')) {
                socket.emit('collaboration-error', { error: 'Insufficient permissions' });
                return;
            }

            // Apply operational transform for conflict resolution
            const transformedOperation = this.transformOperation(projectId, operation, data);

            // Broadcast to other users in the project
            socket.to(projectId).emit('code-change', {
                socketId: socket.id,
                filePath,
                operation: transformedOperation,
                content,
                position,
                timestamp,
                userId: socket.userId
            });

            // Queue operation for batch save
            this.queueOperation(projectId, filePath, {
                operation: transformedOperation,
                content,
                userId: socket.userId,
                timestamp
            });

            // Update project in database (debounced)
            this.debouncedSave(projectId, filePath, content);

        } catch (error) {
            console.error('Code change error:', error);
            socket.emit('collaboration-error', { error: 'Failed to process code change' });
        }
    }

    // Handle cursor movement
    handleCursorMove(socket, data) {
        try {
            const { projectId, filePath, position, selection } = data;

            // Update cursor position
            this.cursors.set(socket.id, {
                filePath,
                position,
                selection,
                timestamp: Date.now()
            });

            // Update user activity
            const projectUsers = this.activeUsers.get(projectId);
            if (projectUsers && projectUsers.has(socket.id)) {
                const userData = projectUsers.get(socket.id);
                userData.lastActivity = new Date();
                userData.cursor = { filePath, position, selection };
            }

            // Broadcast cursor position to others
            socket.to(projectId).emit('cursor-move', {
                socketId: socket.id,
                userId: socket.userId,
                filePath,
                position,
                selection
            });

        } catch (error) {
            console.error('Cursor move error:', error);
        }
    }

    // Handle file operations
    async handleFileOperation(socket, data) {
        try {
            const { projectId, operation, filePath, newPath, content } = data;

            // Verify permissions
            const project = await Project.findById(projectId);
            if (!project || !project.canUserAccess(socket.userId, 'write')) {
                socket.emit('collaboration-error', { error: 'Insufficient permissions' });
                return;
            }

            let result;
            let activityType;

            switch (operation) {
                case 'create':
                    result = project.addFile(filePath, content || '');
                    activityType = 'file_created';
                    break;
                case 'delete':
                    project.deleteFile(filePath);
                    result = { path: filePath };
                    activityType = 'file_deleted';
                    break;
                case 'rename':
                    // Implement file rename logic
                    result = this.renameFile(project, filePath, newPath);
                    activityType = 'file_renamed';
                    break;
                default:
                    throw new Error('Unknown file operation');
            }

            // Add activity and save
            project.addToActivity(activityType, socket.userId, { 
                filePath, 
                newPath: newPath || undefined 
            });
            await project.save();

            // Broadcast to all users in project
            this.io.to(projectId).emit('file-operation', {
                operation,
                filePath,
                newPath,
                content,
                result,
                userId: socket.userId,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('File operation error:', error);
            socket.emit('collaboration-error', { error: `File operation failed: ${error.message}` });
        }
    }

    // Operational Transform for conflict resolution
    transformOperation(projectId, operation, data) {
        // Simple operational transform implementation
        // In production, use a library like ShareJS or Y.js
        
        const pendingOps = this.operationQueue.get(`${projectId}:${data.filePath}`) || [];
        
        // Transform against pending operations
        let transformedOp = { ...operation };
        
        for (const pendingOp of pendingOps) {
            if (pendingOp.timestamp < data.timestamp) {
                transformedOp = this.transformAgainstOperation(transformedOp, pendingOp.operation);
            }
        }

        return transformedOp;
    }

    // Transform one operation against another
    transformAgainstOperation(op1, op2) {
        // Simplified transformation logic
        // This should be replaced with a proper OT algorithm
        
        if (op1.type === 'insert' && op2.type === 'insert') {
            if (op1.position >= op2.position) {
                op1.position += op2.length || op2.text?.length || 0;
            }
        } else if (op1.type === 'delete' && op2.type === 'insert') {
            if (op1.position > op2.position) {
                op1.position += op2.length || op2.text?.length || 0;
            }
        } else if (op1.type === 'insert' && op2.type === 'delete') {
            if (op1.position > op2.position) {
                op1.position -= op2.length || 1;
            }
        }

        return op1;
    }

    // Queue operations for batch processing
    queueOperation(projectId, filePath, operation) {
        const key = `${projectId}:${filePath}`;
        if (!this.operationQueue.has(key)) {
            this.operationQueue.set(key, []);
        }
        
        this.operationQueue.get(key).push(operation);

        // Clean up old operations (keep only last 100)
        const queue = this.operationQueue.get(key);
        if (queue.length > 100) {
            this.operationQueue.set(key, queue.slice(-100));
        }
    }

    // Debounced save to prevent too many database writes
    debouncedSave(projectId, filePath, content) {
        const key = `save_${projectId}_${filePath}`;
        
        // Clear existing timeout
        if (this.saveTimeouts && this.saveTimeouts.has(key)) {
            clearTimeout(this.saveTimeouts.get(key));
        }

        // Set new timeout
        if (!this.saveTimeouts) {
            this.saveTimeouts = new Map();
        }

        this.saveTimeouts.set(key, setTimeout(async () => {
            try {
                const project = await Project.findById(projectId);
                if (project) {
                    project.updateFile(filePath, content, 'system');
                    await project.save();
                }
                this.saveTimeouts.delete(key);
            } catch (error) {
                console.error('Debounced save error:', error);
            }
        }, 2000)); // Save after 2 seconds of inactivity
    }

    // File rename utility
    renameFile(project, oldPath, newPath) {
        const file = project.files.find(f => f.path === oldPath);
        if (!file) {
            throw new Error('File not found');
        }

        // Check if new path already exists
        const existingFile = project.files.find(f => f.path === newPath);
        if (existingFile) {
            throw new Error('File with new name already exists');
        }

        // Update file path and name
        file.path = newPath;
        file.name = newPath.split('/').pop();
        
        // Update parent directory if changed
        const newParent = newPath.substring(0, newPath.lastIndexOf('/')) || '/';
        file.parent = newParent;

        return file;
    }

    // Get project statistics
    getProjectStats(projectId) {
        const projectUsers = this.activeUsers.get(projectId);
        if (!projectUsers) {
            return {
                activeUsers: 0,
                users: []
            };
        }

        const users = Array.from(projectUsers.values()).map(user => ({
            socketId: user.socketId,
            userId: user.userId,
            username: user.username,
            fullName: user.fullName,
            avatar: user.avatar,
            joinedAt: user.joinedAt,
            lastActivity: user.lastActivity,
            cursor: user.cursor
        }));

        return {
            activeUsers: users.length,
            users
        };
    }

    // Send typing indicators
    handleTypingStart(socket, data) {
        const { projectId, filePath } = data;
        socket.to(projectId).emit('typing-start', {
            socketId: socket.id,
            userId: socket.userId,
            filePath
        });
    }

    handleTypingStop(socket, data) {
        const { projectId, filePath } = data;
        socket.to(projectId).emit('typing-stop', {
            socketId: socket.id,
            userId: socket.userId,
            filePath
        });
    }

    // Comment system for collaborative review
    async handleAddComment(socket, data) {
        try {
            const { projectId, filePath, lineNumber, comment, thread } = data;

            const project = await Project.findById(projectId);
            if (!project || !project.canUserAccess(socket.userId)) {
                socket.emit('collaboration-error', { error: 'Access denied' });
                return;
            }

            const commentData = {
                id: require('uuid').v4(),
                userId: socket.userId,
                filePath,
                lineNumber,
                comment,
                thread: thread || null,
                timestamp: new Date(),
                resolved: false
            };

            // Store comment (you might want a separate Comments model)
            // For now, we'll broadcast it
            this.io.to(projectId).emit('comment-added', commentData);

        } catch (error) {
            console.error('Add comment error:', error);
            socket.emit('collaboration-error', { error: 'Failed to add comment' });
        }
    }

    // Live sharing features
    async handleScreenShare(socket, data) {
        const { projectId, action, streamId } = data;
        
        if (action === 'start') {
            socket.to(projectId).emit('screen-share-started', {
                userId: socket.userId,
                streamId
            });
        } else if (action === 'stop') {
            socket.to(projectId).emit('screen-share-stopped', {
                userId: socket.userId
            });
        }
    }

    // Voice/video chat coordination
    async handleVoiceChat(socket, data) {
        const { projectId, action, offer, answer, candidate } = data;
        
        // Forward WebRTC signaling messages
        socket.to(projectId).emit('voice-chat-signal', {
            from: socket.userId,
            action,
            offer,
            answer,
            candidate
        });
    }

    // Project presence awareness
    async updatePresence(socket, data) {
        const { projectId, status, activity } = data;
        
        const projectUsers = this.activeUsers.get(projectId);
        if (projectUsers && projectUsers.has(socket.id)) {
            const userData = projectUsers.get(socket.id);
            userData.status = status; // online, away, busy
            userData.activity = activity; // editing, reviewing, idle
            userData.lastActivity = new Date();

            // Broadcast presence update
            socket.to(projectId).emit('presence-update', {
                userId: socket.userId,
                status,
                activity
            });
        }
    }

    // Cleanup inactive users
    cleanupInactiveUsers() {
        const now = Date.now();
        const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

        for (const [projectId, projectUsers] of this.activeUsers) {
            for (const [socketId, userData] of projectUsers) {
                if (now - userData.lastActivity.getTime() > inactiveThreshold) {
                    projectUsers.delete(socketId);
                    this.cursors.delete(socketId);
                    
                    // Notify others about inactive user
                    this.io.to(projectId).emit('user-inactive', {
                        socketId,
                        userId: userData.userId
                    });
                }
            }

            // Clean up empty projects
            if (projectUsers.size === 0) {
                this.activeUsers.delete(projectId);
            }
        }
    }

    // Get collaboration analytics
    getAnalytics(projectId) {
        const projectUsers = this.activeUsers.get(projectId);
        const operations = this.operationQueue.get(projectId) || [];

        return {
            activeUsers: projectUsers ? projectUsers.size : 0,
            totalOperations: operations.length,
            recentActivity: operations.slice(-10),
            cursors: Array.from(this.cursors.entries())
                .filter(([socketId]) => projectUsers && projectUsers.has(socketId))
                .map(([socketId, cursor]) => ({ socketId, ...cursor }))
        };
    }
}

// Start cleanup interval
setInterval(() => {
    // This would be called on the collaboration service instance
    // collaborationService.cleanupInactiveUsers();
}, 60000); // Check every minute

module.exports = CollaborationService;