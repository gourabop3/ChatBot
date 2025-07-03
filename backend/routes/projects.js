const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all projects for the authenticated user
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, category, visibility } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {
            $or: [
                { owner: req.user._id },
                { 
                    'collaborators.user': req.user._id,
                    'collaborators.status': 'accepted'
                }
            ],
            status: 'active'
        };

        if (search) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { tags: { $in: [new RegExp(search, 'i')] } }
                ]
            });
        }

        if (category) {
            query.category = category;
        }

        if (visibility) {
            query['settings.visibility'] = visibility;
        }

        const projects = await Project.find(query)
            .populate('owner', 'username firstName lastName avatar')
            .populate('collaborators.user', 'username firstName lastName avatar')
            .sort({ lastAccessedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Project.countDocuments(query);

        res.json({
            projects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Get a specific project
router.get('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('owner', 'username firstName lastName avatar')
            .populate('collaborators.user', 'username firstName lastName avatar')
            .populate('activity.user', 'username firstName lastName avatar');

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user has access
        if (!project.canUserAccess(req.user._id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Update access tracking
        project.lastAccessedAt = new Date();
        project.accessCount += 1;
        await project.save();

        res.json(project);

    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// Create a new project
router.post('/', auth, [
    body('name').isLength({ min: 1, max: 100 }).withMessage('Project name is required and must be less than 100 characters'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Check if user can create more projects
        if (!req.user.canCreateProject()) {
            return res.status(403).json({ 
                error: 'Project limit reached for your plan',
                upgradeUrl: '/pricing'
            });
        }

        const { name, description, settings, category, tags, template } = req.body;

        const project = new Project({
            name,
            description,
            owner: req.user._id,
            settings: {
                ...settings,
                visibility: settings?.visibility || 'private'
            },
            category,
            tags: tags || []
        });

        // Add template files if specified
        if (template) {
            await addTemplateFiles(project, template);
        }

        await project.save();

        // Update user project count
        req.user.usage.projectsCount += 1;
        await req.user.save();

        // Add activity
        project.addToActivity('project_created', req.user._id);
        await project.save();

        const populatedProject = await Project.findById(project._id)
            .populate('owner', 'username firstName lastName avatar');

        res.status(201).json({
            project: populatedProject,
            message: 'Project created successfully'
        });

    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// Update project
router.put('/:id', auth, [
    body('name').optional().isLength({ min: 1, max: 100 }),
    body('description').optional().isLength({ max: 500 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check permissions
        if (!project.canUserAccess(req.user._id, 'write')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { name, description, settings, category, tags } = req.body;
        const updates = {};

        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (settings) updates.settings = { ...project.settings, ...settings };
        if (category !== undefined) updates.category = category;
        if (tags !== undefined) updates.tags = tags;

        const updatedProject = await Project.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).populate('owner', 'username firstName lastName avatar')
         .populate('collaborators.user', 'username firstName lastName avatar');

        // Add activity
        updatedProject.addToActivity('project_updated', req.user._id, { updates: Object.keys(updates) });
        await updatedProject.save();

        res.json({
            project: updatedProject,
            message: 'Project updated successfully'
        });

    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Delete project
router.delete('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Only owner can delete
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the project owner can delete this project' });
        }

        // Soft delete
        project.status = 'deleted';
        await project.save();

        // Update user project count
        req.user.usage.projectsCount = Math.max(0, req.user.usage.projectsCount - 1);
        await req.user.save();

        res.json({ message: 'Project deleted successfully' });

    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// File operations
router.post('/:id/files', auth, [
    body('path').notEmpty().withMessage('File path is required'),
    body('content').optional().isString(),
    body('language').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!project.canUserAccess(req.user._id, 'write')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { path, content = '', language } = req.body;

        try {
            const file = project.addFile(path, content, language);
            project.addToActivity('file_created', req.user._id, { filePath: path });
            await project.save();

            res.status(201).json({
                file,
                message: 'File created successfully'
            });

        } catch (fileError) {
            res.status(400).json({ error: fileError.message });
        }

    } catch (error) {
        console.error('Create file error:', error);
        res.status(500).json({ error: 'Failed to create file' });
    }
});

// Update file
router.put('/:id/files/*', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!project.canUserAccess(req.user._id, 'write')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const filePath = '/' + req.params[0];
        const { content } = req.body;

        try {
            const file = project.updateFile(filePath, content, req.user._id);
            project.addToActivity('file_modified', req.user._id, { filePath });
            await project.save();

            res.json({
                file,
                message: 'File updated successfully'
            });

        } catch (fileError) {
            res.status(400).json({ error: fileError.message });
        }

    } catch (error) {
        console.error('Update file error:', error);
        res.status(500).json({ error: 'Failed to update file' });
    }
});

// Delete file
router.delete('/:id/files/*', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!project.canUserAccess(req.user._id, 'write')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const filePath = '/' + req.params[0];

        try {
            project.deleteFile(filePath);
            project.addToActivity('file_deleted', req.user._id, { filePath });
            await project.save();

            res.json({ message: 'File deleted successfully' });

        } catch (fileError) {
            res.status(400).json({ error: fileError.message });
        }

    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Collaboration routes
router.post('/:id/collaborators', auth, [
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['read', 'write', 'admin']).withMessage('Invalid role')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!project.canUserAccess(req.user._id, 'invite')) {
            return res.status(403).json({ error: 'Insufficient permissions to invite collaborators' });
        }

        const { email, role } = req.body;

        // Find user to invite
        const userToInvite = await User.findByEmail(email);
        if (!userToInvite) {
            return res.status(404).json({ error: 'User not found' });
        }

        try {
            const collaborator = project.addCollaborator(userToInvite._id, role, req.user._id);
            project.addToActivity('collaborator_added', req.user._id, { 
                collaboratorId: userToInvite._id,
                role 
            });
            await project.save();

            // TODO: Send email invitation

            res.status(201).json({
                collaborator,
                message: 'Collaborator invited successfully'
            });

        } catch (collabError) {
            res.status(400).json({ error: collabError.message });
        }

    } catch (error) {
        console.error('Add collaborator error:', error);
        res.status(500).json({ error: 'Failed to add collaborator' });
    }
});

// Remove collaborator
router.delete('/:id/collaborators/:userId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!project.canUserAccess(req.user._id, 'invite')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        try {
            project.removeCollaborator(req.params.userId);
            project.addToActivity('collaborator_removed', req.user._id, { 
                collaboratorId: req.params.userId 
            });
            await project.save();

            res.json({ message: 'Collaborator removed successfully' });

        } catch (collabError) {
            res.status(400).json({ error: collabError.message });
        }

    } catch (error) {
        console.error('Remove collaborator error:', error);
        res.status(500).json({ error: 'Failed to remove collaborator' });
    }
});

// Star/unstar project
router.post('/:id/star', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!project.canUserAccess(req.user._id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const isStarred = project.stars.includes(req.user._id);

        if (isStarred) {
            project.unstar(req.user._id);
        } else {
            project.star(req.user._id);
        }

        await project.save();

        res.json({
            starred: !isStarred,
            starCount: project.starCount,
            message: isStarred ? 'Project unstarred' : 'Project starred'
        });

    } catch (error) {
        console.error('Star project error:', error);
        res.status(500).json({ error: 'Failed to star/unstar project' });
    }
});

// Fork project
router.post('/:id/fork', auth, async (req, res) => {
    try {
        const originalProject = await Project.findById(req.params.id);
        if (!originalProject) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user can access the project
        if (originalProject.settings.visibility === 'private' && 
            !originalProject.canUserAccess(req.user._id)) {
            return res.status(403).json({ error: 'Cannot fork private project' });
        }

        // Check if user can create more projects
        if (!req.user.canCreateProject()) {
            return res.status(403).json({ 
                error: 'Project limit reached for your plan',
                upgradeUrl: '/pricing'
            });
        }

        // Create forked project
        const forkedProject = new Project({
            name: `${originalProject.name} (Fork)`,
            description: originalProject.description,
            owner: req.user._id,
            files: originalProject.files.map(file => ({
                ...file.toObject(),
                _id: undefined,
                modifiedBy: req.user._id,
                lastModified: new Date(),
                version: 1,
                history: [{
                    version: 1,
                    content: file.content,
                    modifiedBy: req.user._id,
                    modifiedAt: new Date(),
                    comment: 'Forked from original project'
                }]
            })),
            settings: {
                ...originalProject.settings,
                visibility: 'private' // Forks are private by default
            },
            category: originalProject.category,
            tags: [...originalProject.tags],
            forkedFrom: originalProject._id
        });

        await forkedProject.save();

        // Update original project fork count
        originalProject.fork(req.user._id, forkedProject._id);
        await originalProject.save();

        // Update user project count
        req.user.usage.projectsCount += 1;
        await req.user.save();

        const populatedProject = await Project.findById(forkedProject._id)
            .populate('owner', 'username firstName lastName avatar');

        res.status(201).json({
            project: populatedProject,
            message: 'Project forked successfully'
        });

    } catch (error) {
        console.error('Fork project error:', error);
        res.status(500).json({ error: 'Failed to fork project' });
    }
});

// Get project activity
router.get('/:id/activity', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('activity.user', 'username firstName lastName avatar')
            .select('activity');

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (!project.canUserAccess(req.user._id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ activity: project.activity });

    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ error: 'Failed to fetch project activity' });
    }
});

// Helper function to add template files
async function addTemplateFiles(project, template) {
    const templates = {
        'react': {
            'package.json': JSON.stringify({
                "name": project.name.toLowerCase().replace(/\s+/g, '-'),
                "version": "0.1.0",
                "dependencies": {
                    "react": "^18.0.0",
                    "react-dom": "^18.0.0"
                },
                "scripts": {
                    "start": "react-scripts start",
                    "build": "react-scripts build"
                }
            }, null, 2),
            'src/App.js': `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>Welcome to ${project.name}</h1>
      <p>Start building your React app!</p>
    </div>
  );
}

export default App;`,
            'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
            'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>${project.name}</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>`
        },
        'node': {
            'package.json': JSON.stringify({
                "name": project.name.toLowerCase().replace(/\s+/g, '-'),
                "version": "1.0.0",
                "main": "index.js",
                "scripts": {
                    "start": "node index.js",
                    "dev": "nodemon index.js"
                },
                "dependencies": {
                    "express": "^4.18.0"
                }
            }, null, 2),
            'index.js': `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Hello from ${project.name}!' });
});

app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});`,
            'README.md': `# ${project.name}

${project.description || 'A Node.js application built with Express.js'}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open http://localhost:3000 in your browser.`
        }
    };

    const templateFiles = templates[template];
    if (templateFiles) {
        for (const [filePath, content] of Object.entries(templateFiles)) {
            const language = getLanguageFromPath(filePath);
            project.addFile(`/${filePath}`, content, language);
        }
    }
}

function getLanguageFromPath(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown'
    };
    return langMap[ext] || 'plaintext';
}

module.exports = router;