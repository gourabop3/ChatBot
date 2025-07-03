const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const GitService = require('../services/gitService');
const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '7d'
    });
};

// Register new user
router.post('/register', [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, firstName, lastName } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
            });
        }

        // Create new user
        const user = new User({
            username,
            email,
            password,
            firstName,
            lastName
        });

        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            token,
            user: user.toSafeObject(),
            message: 'User registered successfully'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
router.post('/login', [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.updateActivity();

        // Generate token
        const token = generateToken(user._id);

        res.json({
            token,
            user: user.toSafeObject(),
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        await req.user.updateActivity();
        res.json({ user: req.user.toSafeObject() });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user information' });
    }
});

// Update user profile
router.put('/profile', auth, [
    body('firstName').optional().isLength({ max: 50 }),
    body('lastName').optional().isLength({ max: 50 }),
    body('username').optional().isLength({ min: 3, max: 30 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { firstName, lastName, username } = req.body;
        const updates = {};

        if (firstName !== undefined) updates.firstName = firstName;
        if (lastName !== undefined) updates.lastName = lastName;
        if (username !== undefined) {
            // Check if username is already taken
            const existingUser = await User.findOne({ 
                username, 
                _id: { $ne: req.user._id } 
            });
            if (existingUser) {
                return res.status(400).json({ error: 'Username already taken' });
            }
            updates.username = username;
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        );

        res.json({
            user: user.toSafeObject(),
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Update user preferences
router.put('/preferences', auth, async (req, res) => {
    try {
        const { theme, editor, ai, notifications } = req.body;
        const updates = {};

        if (theme) updates['preferences.theme'] = theme;
        if (editor) {
            Object.keys(editor).forEach(key => {
                updates[`preferences.editor.${key}`] = editor[key];
            });
        }
        if (ai) {
            Object.keys(ai).forEach(key => {
                updates[`preferences.ai.${key}`] = ai[key];
            });
        }
        if (notifications) {
            Object.keys(notifications).forEach(key => {
                updates[`preferences.notifications.${key}`] = notifications[key];
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true }
        );

        res.json({
            preferences: user.preferences,
            message: 'Preferences updated successfully'
        });

    } catch (error) {
        console.error('Preferences update error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// Change password
router.put('/password', auth, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;

        // Verify current password
        const user = await User.findById(req.user._id);
        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// GitHub OAuth - Get authorization URL
router.get('/github/url', (req, res) => {
    try {
        const state = require('crypto').randomBytes(16).toString('hex');
        const redirectUri = `${process.env.FRONTEND_URL}/auth/github/callback`;
        
        const authUrl = GitService.getGitHubAuthUrl(
            process.env.GITHUB_CLIENT_ID,
            redirectUri,
            state
        );

        // Store state in session or database for verification
        res.json({ 
            authUrl,
            state // Client should store this for verification
        });

    } catch (error) {
        console.error('GitHub auth URL error:', error);
        res.status(500).json({ error: 'Failed to generate GitHub auth URL' });
    }
});

// GitHub OAuth callback
router.post('/github/callback', [
    body('code').notEmpty().withMessage('Authorization code is required'),
    body('state').notEmpty().withMessage('State parameter is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { code, state } = req.body;

        // Exchange code for access token
        const accessToken = await GitService.exchangeCodeForToken(
            process.env.GITHUB_CLIENT_ID,
            process.env.GITHUB_CLIENT_SECRET,
            code
        );

        // Get GitHub user info
        const octokit = new (require('octokit').Octokit)({ auth: accessToken });
        const { data: githubUser } = await octokit.rest.users.getAuthenticated();

        // Check if user exists with this GitHub ID
        let user = await User.findByGithubId(githubUser.id);

        if (user) {
            // Update GitHub info for existing user
            user.github = {
                id: githubUser.id,
                username: githubUser.login,
                accessToken: accessToken, // Should be encrypted in production
                connectedAt: new Date()
            };
            await user.save();
        } else {
            // Check if user exists with same email
            user = await User.findByEmail(githubUser.email);

            if (user) {
                // Link GitHub account to existing user
                user.github = {
                    id: githubUser.id,
                    username: githubUser.login,
                    accessToken: accessToken,
                    connectedAt: new Date()
                };
                await user.save();
            } else {
                // Create new user from GitHub
                user = new User({
                    username: githubUser.login,
                    email: githubUser.email,
                    firstName: githubUser.name?.split(' ')[0] || '',
                    lastName: githubUser.name?.split(' ').slice(1).join(' ') || '',
                    avatar: githubUser.avatar_url,
                    emailVerified: true, // GitHub emails are verified
                    github: {
                        id: githubUser.id,
                        username: githubUser.login,
                        accessToken: accessToken,
                        connectedAt: new Date()
                    }
                });

                // Set a random password for GitHub users
                user.password = require('crypto').randomBytes(32).toString('hex');
                await user.save();
            }
        }

        // Generate JWT token
        const token = generateToken(user._id);

        res.json({
            token,
            user: user.toSafeObject(),
            message: 'GitHub authentication successful'
        });

    } catch (error) {
        console.error('GitHub callback error:', error);
        res.status(500).json({ error: 'GitHub authentication failed' });
    }
});

// Connect GitHub account to existing user
router.post('/github/connect', auth, [
    body('code').notEmpty().withMessage('Authorization code is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { code } = req.body;

        // Exchange code for access token
        const accessToken = await GitService.exchangeCodeForToken(
            process.env.GITHUB_CLIENT_ID,
            process.env.GITHUB_CLIENT_SECRET,
            code
        );

        // Get GitHub user info
        const octokit = new (require('octokit').Octokit)({ auth: accessToken });
        const { data: githubUser } = await octokit.rest.users.getAuthenticated();

        // Check if GitHub account is already connected to another user
        const existingUser = await User.findByGithubId(githubUser.id);
        if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
            return res.status(400).json({ 
                error: 'This GitHub account is already connected to another user' 
            });
        }

        // Update user with GitHub info
        req.user.github = {
            id: githubUser.id,
            username: githubUser.login,
            accessToken: accessToken,
            connectedAt: new Date()
        };
        await req.user.save();

        res.json({
            github: {
                username: githubUser.login,
                avatar: githubUser.avatar_url,
                connectedAt: req.user.github.connectedAt
            },
            message: 'GitHub account connected successfully'
        });

    } catch (error) {
        console.error('GitHub connect error:', error);
        res.status(500).json({ error: 'Failed to connect GitHub account' });
    }
});

// Disconnect GitHub account
router.delete('/github/disconnect', auth, async (req, res) => {
    try {
        req.user.github = {
            id: null,
            username: null,
            accessToken: null,
            connectedAt: null
        };
        await req.user.save();

        res.json({ message: 'GitHub account disconnected successfully' });

    } catch (error) {
        console.error('GitHub disconnect error:', error);
        res.status(500).json({ error: 'Failed to disconnect GitHub account' });
    }
});

// Logout (for client-side token clearing)
router.post('/logout', auth, async (req, res) => {
    try {
        // Update user activity
        req.user.isOnline = false;
        await req.user.save();

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Delete account
router.delete('/account', auth, [
    body('password').notEmpty().withMessage('Password is required to delete account')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { password } = req.body;

        // Verify password
        const isMatch = await req.user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect password' });
        }

        // Delete user (cascade delete projects and other related data)
        await User.findByIdAndDelete(req.user._id);

        res.json({ message: 'Account deleted successfully' });

    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const Project = require('../models/Project');
        
        const [projectCount, collaborationCount] = await Promise.all([
            Project.countDocuments({ owner: req.user._id, status: 'active' }),
            Project.countDocuments({ 
                'collaborators.user': req.user._id,
                'collaborators.status': 'accepted',
                status: 'active'
            })
        ]);

        const stats = {
            projects: projectCount,
            collaborations: collaborationCount,
            subscription: req.user.subscription,
            usage: req.user.usage,
            joinedAt: req.user.createdAt,
            lastActive: req.user.lastActiveAt
        };

        res.json(stats);

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get user statistics' });
    }
});

module.exports = router;