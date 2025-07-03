const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Basic user information
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    firstName: {
        type: String,
        trim: true,
        maxlength: 50
    },
    lastName: {
        type: String,
        trim: true,
        maxlength: 50
    },
    avatar: {
        type: String,
        default: null
    },
    
    // Subscription and billing
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'pro', 'team', 'enterprise'],
            default: 'free'
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'canceled', 'trial'],
            default: 'active'
        },
        stripeCustomerId: String,
        stripeSubscriptionId: String,
        currentPeriodStart: Date,
        currentPeriodEnd: Date,
        trialEndsAt: {
            type: Date,
            default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
        }
    },
    
    // GitHub integration
    github: {
        id: String,
        username: String,
        accessToken: String,
        refreshToken: String,
        connectedAt: Date
    },
    
    // Usage and limits
    usage: {
        aiRequests: {
            count: { type: Number, default: 0 },
            resetDate: { type: Date, default: Date.now }
        },
        storageUsed: { type: Number, default: 0 }, // in bytes
        projectsCount: { type: Number, default: 0 },
        collaboratorsCount: { type: Number, default: 0 }
    },
    
    // Preferences
    preferences: {
        theme: {
            type: String,
            enum: ['dark', 'light', 'auto'],
            default: 'dark'
        },
        editor: {
            fontSize: { type: Number, default: 14 },
            fontFamily: { type: String, default: 'Monaco' },
            tabSize: { type: Number, default: 2 },
            wordWrap: { type: Boolean, default: true },
            minimap: { type: Boolean, default: true }
        },
        ai: {
            enabled: { type: Boolean, default: true },
            autoComplete: { type: Boolean, default: true },
            contextLines: { type: Number, default: 10 }
        },
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            collaboration: { type: Boolean, default: true }
        }
    },
    
    // Security
    lastLogin: Date,
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    
    // Activity
    lastActiveAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    
    // Permissions and roles
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user'
    },
    permissions: [{
        type: String,
        enum: ['create_project', 'invite_users', 'manage_billing', 'admin_access']
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'github.id': 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ lastActiveAt: -1 });

// Virtual fields
userSchema.virtual('fullName').get(function() {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

userSchema.virtual('isTrialActive').get(function() {
    return this.subscription.trialEndsAt && this.subscription.trialEndsAt > new Date();
});

userSchema.virtual('subscriptionDaysRemaining').get(function() {
    if (!this.subscription.currentPeriodEnd) return null;
    const daysRemaining = Math.ceil((this.subscription.currentPeriodEnd - new Date()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
    // Hash password if modified
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    
    // Update lastActiveAt
    if (this.isModified('isOnline') && this.isOnline) {
        this.lastActiveAt = new Date();
    }
    
    next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function() {
    const user = this.toObject();
    delete user.password;
    delete user.emailVerificationToken;
    delete user.passwordResetToken;
    delete user.twoFactorSecret;
    delete user.github.accessToken;
    delete user.github.refreshToken;
    return user;
};

userSchema.methods.canCreateProject = function() {
    const limits = {
        free: 3,
        pro: 50,
        team: 100,
        enterprise: Infinity
    };
    return this.usage.projectsCount < limits[this.subscription.plan];
};

userSchema.methods.canUseAI = function() {
    const limits = {
        free: 100,
        pro: 1000,
        team: 5000,
        enterprise: Infinity
    };
    
    // Reset monthly counter if needed
    const now = new Date();
    const resetDate = new Date(this.usage.aiRequests.resetDate);
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
        this.usage.aiRequests.count = 0;
        this.usage.aiRequests.resetDate = now;
    }
    
    return this.usage.aiRequests.count < limits[this.subscription.plan];
};

userSchema.methods.incrementAIUsage = function() {
    this.usage.aiRequests.count += 1;
    return this.save();
};

userSchema.methods.updateActivity = function() {
    this.lastActiveAt = new Date();
    this.isOnline = true;
    return this.save();
};

// Static methods
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByGithubId = function(githubId) {
    return this.findOne({ 'github.id': githubId });
};

userSchema.statics.getActiveUsers = function() {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    return this.find({ lastActiveAt: { $gte: fifteenMinutesAgo } });
};

module.exports = mongoose.model('User', userSchema);