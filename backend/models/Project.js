const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    path: { type: String, required: true },
    content: { type: String, default: '' },
    language: { type: String, default: 'plaintext' },
    size: { type: Number, default: 0 },
    mimeType: String,
    isDirectory: { type: Boolean, default: false },
    parent: { type: String, default: null }, // parent directory path
    lastModified: { type: Date, default: Date.now },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    version: { type: Number, default: 1 },
    history: [{
        version: Number,
        content: String,
        modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        modifiedAt: { type: Date, default: Date.now },
        comment: String
    }]
});

const collaboratorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
        type: String,
        enum: ['owner', 'admin', 'write', 'read'],
        default: 'read'
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending'
    },
    permissions: [{
        type: String,
        enum: ['read', 'write', 'delete', 'invite', 'manage_settings', 'manage_git']
    }]
});

const gitConfigSchema = new mongoose.Schema({
    provider: {
        type: String,
        enum: ['github', 'gitlab', 'bitbucket'],
        default: 'github'
    },
    repositoryUrl: String,
    repositoryName: String,
    branch: { type: String, default: 'main' },
    owner: String,
    isPrivate: { type: Boolean, default: true },
    lastSync: Date,
    autoSync: { type: Boolean, default: false },
    webhookUrl: String,
    deployKey: String,
    accessToken: String // encrypted
});

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 500
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Project settings
    settings: {
        visibility: {
            type: String,
            enum: ['private', 'public', 'team'],
            default: 'private'
        },
        language: String, // primary language
        framework: String,
        template: String,
        aiEnabled: { type: Boolean, default: true },
        autoSave: { type: Boolean, default: true },
        linting: { type: Boolean, default: true },
        prettier: { type: Boolean, default: true }
    },
    
    // File system
    files: [fileSchema],
    rootDirectory: { type: String, default: '/' },
    
    // Collaboration
    collaborators: [collaboratorSchema],
    isTeamProject: { type: Boolean, default: false },
    maxCollaborators: { type: Number, default: 5 },
    
    // Git integration
    git: gitConfigSchema,
    
    // Statistics
    stats: {
        totalFiles: { type: Number, default: 0 },
        totalLines: { type: Number, default: 0 },
        totalSize: { type: Number, default: 0 }, // in bytes
        languages: [{ language: String, percentage: Number }],
        lastActivity: { type: Date, default: Date.now },
        commits: { type: Number, default: 0 },
        branches: { type: Number, default: 1 }
    },
    
    // Activity tracking
    activity: [{
        type: {
            type: String,
            enum: ['file_created', 'file_modified', 'file_deleted', 'file_renamed', 
                   'collaborator_added', 'collaborator_removed', 'git_push', 'git_pull'],
            required: true
        },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        details: mongoose.Schema.Types.Mixed,
        timestamp: { type: Date, default: Date.now }
    }],
    
    // Environment variables
    environment: [{
        key: String,
        value: String, // encrypted
        isSecret: { type: Boolean, default: false }
    }],
    
    // Deployment
    deployment: {
        provider: String, // vercel, netlify, etc.
        url: String,
        lastDeployment: Date,
        autoDeployment: { type: Boolean, default: false },
        buildCommand: String,
        outputDirectory: String
    },
    
    // Backup and restore
    backups: [{
        id: String,
        timestamp: { type: Date, default: Date.now },
        size: Number,
        description: String,
        fileCount: Number
    }],
    
    // AI integration
    ai: {
        enabled: { type: Boolean, default: true },
        model: { type: String, default: 'gemini-1.5-flash' },
        contextWindow: { type: Number, default: 10 },
        autoComplete: { type: Boolean, default: true },
        codeReview: { type: Boolean, default: false },
        suggestions: [{
            id: String,
            type: String,
            suggestion: String,
            confidence: Number,
            applied: { type: Boolean, default: false },
            createdAt: { type: Date, default: Date.now }
        }]
    },
    
    // Tags and categories
    tags: [String],
    category: String,
    
    // Status
    status: {
        type: String,
        enum: ['active', 'archived', 'deleted'],
        default: 'active'
    },
    
    // Star and fork system
    stars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    forks: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        createdAt: { type: Date, default: Date.now }
    }],
    forkedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    
    // Access tracking
    lastAccessedAt: { type: Date, default: Date.now },
    accessCount: { type: Number, default: 0 }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
projectSchema.index({ owner: 1, name: 1 });
projectSchema.index({ 'collaborators.user': 1 });
projectSchema.index({ tags: 1 });
projectSchema.index({ category: 1 });
projectSchema.index({ 'settings.visibility': 1 });
projectSchema.index({ lastAccessedAt: -1 });
projectSchema.index({ 'stats.lastActivity': -1 });
projectSchema.index({ 'git.repositoryUrl': 1 });

// Virtual fields
projectSchema.virtual('starCount').get(function() {
    return this.stars.length;
});

projectSchema.virtual('forkCount').get(function() {
    return this.forks.length;
});

projectSchema.virtual('collaboratorCount').get(function() {
    return this.collaborators.filter(c => c.status === 'accepted').length;
});

projectSchema.virtual('totalCollaborators').get(function() {
    return this.collaborators.length;
});

// Pre-save middleware
projectSchema.pre('save', function(next) {
    // Update stats
    this.stats.totalFiles = this.files.filter(f => !f.isDirectory).length;
    this.stats.totalSize = this.files.reduce((total, file) => total + (file.size || 0), 0);
    this.stats.totalLines = this.files.reduce((total, file) => {
        if (!file.isDirectory && file.content) {
            return total + file.content.split('\n').length;
        }
        return total;
    }, 0);
    
    // Update last activity
    this.stats.lastActivity = new Date();
    
    next();
});

// Instance methods
projectSchema.methods.addFile = function(filePath, content = '', language = 'plaintext') {
    const existingFile = this.files.find(f => f.path === filePath);
    if (existingFile) {
        throw new Error('File already exists');
    }
    
    const fileName = filePath.split('/').pop();
    const parentPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
    
    const newFile = {
        name: fileName,
        path: filePath,
        content,
        language,
        size: Buffer.byteLength(content, 'utf8'),
        parent: parentPath,
        version: 1,
        history: [{
            version: 1,
            content,
            modifiedAt: new Date()
        }]
    };
    
    this.files.push(newFile);
    return newFile;
};

projectSchema.methods.updateFile = function(filePath, content, userId) {
    const file = this.files.find(f => f.path === filePath);
    if (!file) {
        throw new Error('File not found');
    }
    
    // Add to history
    file.history.push({
        version: file.version + 1,
        content: file.content,
        modifiedBy: userId,
        modifiedAt: new Date()
    });
    
    // Update file
    file.content = content;
    file.size = Buffer.byteLength(content, 'utf8');
    file.version += 1;
    file.lastModified = new Date();
    file.modifiedBy = userId;
    
    return file;
};

projectSchema.methods.deleteFile = function(filePath) {
    const fileIndex = this.files.findIndex(f => f.path === filePath);
    if (fileIndex === -1) {
        throw new Error('File not found');
    }
    
    this.files.splice(fileIndex, 1);
    return true;
};

projectSchema.methods.addCollaborator = function(userId, role = 'read', invitedBy) {
    const existingCollaborator = this.collaborators.find(c => c.user.toString() === userId);
    if (existingCollaborator) {
        throw new Error('User is already a collaborator');
    }
    
    this.collaborators.push({
        user: userId,
        role,
        invitedBy,
        status: 'pending'
    });
    
    return this.collaborators[this.collaborators.length - 1];
};

projectSchema.methods.removeCollaborator = function(userId) {
    const collaboratorIndex = this.collaborators.findIndex(c => c.user.toString() === userId);
    if (collaboratorIndex === -1) {
        throw new Error('Collaborator not found');
    }
    
    this.collaborators.splice(collaboratorIndex, 1);
    return true;
};

projectSchema.methods.getCollaboratorRole = function(userId) {
    const collaborator = this.collaborators.find(c => 
        c.user.toString() === userId && c.status === 'accepted'
    );
    return collaborator ? collaborator.role : null;
};

projectSchema.methods.canUserAccess = function(userId, action = 'read') {
    // Owner has all permissions
    if (this.owner.toString() === userId) {
        return true;
    }
    
    const role = this.getCollaboratorRole(userId);
    if (!role) return false;
    
    const permissions = {
        read: ['read', 'write', 'admin'],
        write: ['write', 'admin'],
        delete: ['admin'],
        invite: ['admin'],
        manage_settings: ['admin'],
        manage_git: ['admin']
    };
    
    return permissions[action]?.includes(role) || false;
};

projectSchema.methods.addToActivity = function(type, userId, details = {}) {
    this.activity.unshift({
        type,
        user: userId,
        details,
        timestamp: new Date()
    });
    
    // Keep only last 100 activities
    if (this.activity.length > 100) {
        this.activity = this.activity.slice(0, 100);
    }
};

projectSchema.methods.star = function(userId) {
    if (!this.stars.includes(userId)) {
        this.stars.push(userId);
    }
};

projectSchema.methods.unstar = function(userId) {
    this.stars = this.stars.filter(id => id.toString() !== userId);
};

projectSchema.methods.fork = function(userId, newProjectId) {
    this.forks.push({
        user: userId,
        project: newProjectId,
        createdAt: new Date()
    });
};

// Static methods
projectSchema.statics.findByOwner = function(userId) {
    return this.find({ owner: userId, status: 'active' });
};

projectSchema.statics.findByCollaborator = function(userId) {
    return this.find({
        'collaborators.user': userId,
        'collaborators.status': 'accepted',
        status: 'active'
    });
};

projectSchema.statics.findPublic = function() {
    return this.find({ 'settings.visibility': 'public', status: 'active' });
};

projectSchema.statics.search = function(query, userId) {
    const searchCriteria = {
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
        ],
        $and: [
            { status: 'active' },
            {
                $or: [
                    { 'settings.visibility': 'public' },
                    { owner: userId },
                    { 'collaborators.user': userId }
                ]
            }
        ]
    };
    
    return this.find(searchCriteria);
};

module.exports = mongoose.model('Project', projectSchema);