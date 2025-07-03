const { Octokit } = require('octokit');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Project = require('../models/Project');
const User = require('../models/User');

class GitService {
    constructor() {
        this.tempDir = path.join(process.cwd(), 'temp');
        this.ensureTempDir();
    }

    async ensureTempDir() {
        try {
            await fs.access(this.tempDir);
        } catch {
            await fs.mkdir(this.tempDir, { recursive: true });
        }
    }

    // Initialize Octokit with user's GitHub token
    getOctokit(accessToken) {
        return new Octokit({
            auth: accessToken
        });
    }

    // Handle Git operations from Socket.IO
    async handleGitOperation(socket, data) {
        try {
            const { operation, projectId, ...params } = data;
            const userId = socket.userId; // Assume this is set during authentication

            switch (operation) {
                case 'connect-github':
                    await this.connectGitHub(socket, userId, params);
                    break;
                case 'create-repository':
                    await this.createRepository(socket, userId, projectId, params);
                    break;
                case 'push-to-github':
                    await this.pushToGitHub(socket, userId, projectId, params);
                    break;
                case 'pull-from-github':
                    await this.pullFromGitHub(socket, userId, projectId, params);
                    break;
                case 'sync-repository':
                    await this.syncRepository(socket, userId, projectId);
                    break;
                case 'get-branches':
                    await this.getBranches(socket, userId, projectId);
                    break;
                case 'create-branch':
                    await this.createBranch(socket, userId, projectId, params);
                    break;
                case 'switch-branch':
                    await this.switchBranch(socket, userId, projectId, params);
                    break;
                default:
                    socket.emit('git-error', { error: 'Unknown Git operation' });
            }
        } catch (error) {
            console.error('Git operation error:', error);
            socket.emit('git-error', { error: error.message });
        }
    }

    // Connect user's GitHub account
    async connectGitHub(socket, userId, { accessToken }) {
        try {
            const octokit = this.getOctokit(accessToken);
            const { data: user } = await octokit.rest.users.getAuthenticated();

            // Update user with GitHub information
            await User.findByIdAndUpdate(userId, {
                'github.id': user.id,
                'github.username': user.login,
                'github.accessToken': accessToken, // Should be encrypted in production
                'github.connectedAt': new Date()
            });

            socket.emit('github-connected', {
                username: user.login,
                avatar: user.avatar_url,
                name: user.name
            });
        } catch (error) {
            socket.emit('git-error', { error: 'Failed to connect GitHub account' });
        }
    }

    // Create a new GitHub repository
    async createRepository(socket, userId, projectId, { name, description, isPrivate = true }) {
        try {
            const user = await User.findById(userId);
            const project = await Project.findById(projectId);

            if (!user.github.accessToken) {
                throw new Error('GitHub account not connected');
            }

            const octokit = this.getOctokit(user.github.accessToken);

            // Create repository on GitHub
            const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
                name,
                description,
                private: isPrivate,
                auto_init: false
            });

            // Update project with Git configuration
            project.git = {
                provider: 'github',
                repositoryUrl: repo.html_url,
                repositoryName: repo.name,
                branch: 'main',
                owner: repo.owner.login,
                isPrivate: repo.private,
                lastSync: new Date()
            };

            await project.save();

            // Add activity
            project.addToActivity('git_repository_created', userId, {
                repository: repo.html_url
            });

            socket.emit('repository-created', {
                repository: repo,
                project: project.toObject()
            });

            // Auto-push current files if any
            if (project.files.length > 0) {
                await this.pushToGitHub(socket, userId, projectId, {
                    commitMessage: 'Initial commit from Cursor AI'
                });
            }

        } catch (error) {
            socket.emit('git-error', { error: `Failed to create repository: ${error.message}` });
        }
    }

    // Push project files to GitHub
    async pushToGitHub(socket, userId, projectId, { commitMessage = 'Update from Cursor AI', branch = 'main' }) {
        try {
            const user = await User.findById(userId);
            const project = await Project.findById(projectId);

            if (!user.github.accessToken || !project.git.repositoryUrl) {
                throw new Error('GitHub not configured for this project');
            }

            const octokit = this.getOctokit(user.github.accessToken);
            
            // Create working directory
            const workDir = path.join(this.tempDir, `${projectId}_${Date.now()}`);
            await fs.mkdir(workDir, { recursive: true });

            try {
                // Initialize git repository
                const git = simpleGit(workDir);
                await git.init();
                await git.addConfig('user.name', user.github.username);
                await git.addConfig('user.email', user.email);

                // Add remote
                const repoUrl = `https://${user.github.accessToken}@github.com/${project.git.owner}/${project.git.repositoryName}.git`;
                await git.addRemote('origin', repoUrl);

                // Create files from project
                for (const file of project.files) {
                    if (!file.isDirectory) {
                        const filePath = path.join(workDir, file.path.replace(/^\//, ''));
                        const fileDir = path.dirname(filePath);
                        
                        await fs.mkdir(fileDir, { recursive: true });
                        await fs.writeFile(filePath, file.content || '');
                    }
                }

                // Add, commit and push
                await git.add('.');
                await git.commit(commitMessage);

                try {
                    // Try to pull first in case there are remote changes
                    await git.pull('origin', branch);
                } catch (pullError) {
                    // If pull fails, it might be the first push
                    console.log('Pull failed, proceeding with push:', pullError.message);
                }

                await git.push('origin', branch);

                // Update project
                project.git.lastSync = new Date();
                project.stats.commits += 1;
                await project.save();

                // Add activity
                project.addToActivity('git_push', userId, {
                    commitMessage,
                    branch,
                    fileCount: project.files.filter(f => !f.isDirectory).length
                });

                socket.emit('push-complete', {
                    message: 'Successfully pushed to GitHub',
                    commitMessage,
                    branch,
                    repository: project.git.repositoryUrl
                });

            } finally {
                // Clean up working directory
                await this.cleanupDirectory(workDir);
            }

        } catch (error) {
            socket.emit('git-error', { error: `Failed to push to GitHub: ${error.message}` });
        }
    }

    // Pull changes from GitHub
    async pullFromGitHub(socket, userId, projectId, { branch = 'main' } = {}) {
        try {
            const user = await User.findById(userId);
            const project = await Project.findById(projectId);

            if (!user.github.accessToken || !project.git.repositoryUrl) {
                throw new Error('GitHub not configured for this project');
            }

            const octokit = this.getOctokit(user.github.accessToken);
            
            // Get repository contents
            const { data: contents } = await octokit.rest.repos.getContent({
                owner: project.git.owner,
                repo: project.git.repositoryName,
                path: '',
                ref: branch
            });

            // Clear existing files (except directories)
            project.files = project.files.filter(f => f.isDirectory);

            // Recursively fetch all files
            await this.fetchRepositoryContents(octokit, project, '', contents, branch);

            // Update project
            project.git.lastSync = new Date();
            project.git.branch = branch;
            await project.save();

            // Add activity
            project.addToActivity('git_pull', userId, {
                branch,
                repository: project.git.repositoryUrl
            });

            socket.emit('pull-complete', {
                message: 'Successfully pulled from GitHub',
                branch,
                fileCount: project.files.filter(f => !f.isDirectory).length,
                project: project.toObject()
            });

        } catch (error) {
            socket.emit('git-error', { error: `Failed to pull from GitHub: ${error.message}` });
        }
    }

    // Recursively fetch repository contents
    async fetchRepositoryContents(octokit, project, basePath, contents, branch) {
        for (const item of contents) {
            const itemPath = basePath ? `${basePath}/${item.name}` : item.name;

            if (item.type === 'dir') {
                // Add directory
                project.files.push({
                    name: item.name,
                    path: `/${itemPath}`,
                    isDirectory: true,
                    parent: basePath ? `/${basePath}` : '/'
                });

                // Fetch directory contents
                const { data: dirContents } = await octokit.rest.repos.getContent({
                    owner: project.git.owner,
                    repo: project.git.repositoryName,
                    path: itemPath,
                    ref: branch
                });

                await this.fetchRepositoryContents(octokit, project, itemPath, dirContents, branch);

            } else if (item.type === 'file') {
                // Fetch file content
                const { data: fileData } = await octokit.rest.repos.getContent({
                    owner: project.git.owner,
                    repo: project.git.repositoryName,
                    path: itemPath,
                    ref: branch
                });

                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                const language = this.getLanguageFromExtension(item.name);

                project.files.push({
                    name: item.name,
                    path: `/${itemPath}`,
                    content: content,
                    language: language,
                    size: fileData.size,
                    isDirectory: false,
                    parent: basePath ? `/${basePath}` : '/',
                    lastModified: new Date()
                });
            }
        }
    }

    // Get repository branches
    async getBranches(socket, userId, projectId) {
        try {
            const user = await User.findById(userId);
            const project = await Project.findById(projectId);

            if (!user.github.accessToken || !project.git.repositoryUrl) {
                throw new Error('GitHub not configured for this project');
            }

            const octokit = this.getOctokit(user.github.accessToken);
            
            const { data: branches } = await octokit.rest.repos.listBranches({
                owner: project.git.owner,
                repo: project.git.repositoryName
            });

            socket.emit('branches-fetched', {
                branches: branches.map(b => ({
                    name: b.name,
                    sha: b.commit.sha,
                    protected: b.protected
                })),
                currentBranch: project.git.branch
            });

        } catch (error) {
            socket.emit('git-error', { error: `Failed to fetch branches: ${error.message}` });
        }
    }

    // Create a new branch
    async createBranch(socket, userId, projectId, { branchName, fromBranch = 'main' }) {
        try {
            const user = await User.findById(userId);
            const project = await Project.findById(projectId);

            if (!user.github.accessToken || !project.git.repositoryUrl) {
                throw new Error('GitHub not configured for this project');
            }

            const octokit = this.getOctokit(user.github.accessToken);
            
            // Get reference commit
            const { data: ref } = await octokit.rest.git.getRef({
                owner: project.git.owner,
                repo: project.git.repositoryName,
                ref: `heads/${fromBranch}`
            });

            // Create new branch
            await octokit.rest.git.createRef({
                owner: project.git.owner,
                repo: project.git.repositoryName,
                ref: `refs/heads/${branchName}`,
                sha: ref.object.sha
            });

            socket.emit('branch-created', {
                message: `Branch '${branchName}' created successfully`,
                branchName,
                fromBranch
            });

        } catch (error) {
            socket.emit('git-error', { error: `Failed to create branch: ${error.message}` });
        }
    }

    // Switch to a different branch
    async switchBranch(socket, userId, projectId, { branchName }) {
        try {
            const project = await Project.findById(projectId);
            
            // Update project branch
            project.git.branch = branchName;
            await project.save();

            // Pull files from the new branch
            await this.pullFromGitHub(socket, userId, projectId, { branch: branchName });

            socket.emit('branch-switched', {
                message: `Switched to branch '${branchName}'`,
                branchName
            });

        } catch (error) {
            socket.emit('git-error', { error: `Failed to switch branch: ${error.message}` });
        }
    }

    // Sync repository (both pull and push)
    async syncRepository(socket, userId, projectId) {
        try {
            // First pull to get latest changes
            await this.pullFromGitHub(socket, userId, projectId);
            
            // Then push any local changes
            await this.pushToGitHub(socket, userId, projectId, {
                commitMessage: 'Sync from Cursor AI'
            });

            socket.emit('sync-complete', {
                message: 'Repository synchronized successfully'
            });

        } catch (error) {
            socket.emit('git-error', { error: `Failed to sync repository: ${error.message}` });
        }
    }

    // Get commit history
    async getCommitHistory(userId, projectId, page = 1, perPage = 20) {
        try {
            const user = await User.findById(userId);
            const project = await Project.findById(projectId);

            if (!user.github.accessToken || !project.git.repositoryUrl) {
                throw new Error('GitHub not configured for this project');
            }

            const octokit = this.getOctokit(user.github.accessToken);
            
            const { data: commits } = await octokit.rest.repos.listCommits({
                owner: project.git.owner,
                repo: project.git.repositoryName,
                sha: project.git.branch,
                page,
                per_page: perPage
            });

            return commits.map(commit => ({
                sha: commit.sha,
                message: commit.commit.message,
                author: {
                    name: commit.commit.author.name,
                    email: commit.commit.author.email,
                    date: commit.commit.author.date
                },
                committer: {
                    name: commit.commit.committer.name,
                    email: commit.commit.committer.email,
                    date: commit.commit.committer.date
                },
                url: commit.html_url
            }));

        } catch (error) {
            throw new Error(`Failed to fetch commit history: ${error.message}`);
        }
    }

    // Get file diff between commits
    async getFileDiff(userId, projectId, sha1, sha2, filePath) {
        try {
            const user = await User.findById(userId);
            const project = await Project.findById(projectId);

            if (!user.github.accessToken || !project.git.repositoryUrl) {
                throw new Error('GitHub not configured for this project');
            }

            const octokit = this.getOctokit(user.github.accessToken);
            
            const { data: comparison } = await octokit.rest.repos.compareCommits({
                owner: project.git.owner,
                repo: project.git.repositoryName,
                base: sha1,
                head: sha2
            });

            const file = comparison.files.find(f => f.filename === filePath);
            
            return {
                filename: file?.filename,
                status: file?.status,
                additions: file?.additions,
                deletions: file?.deletions,
                changes: file?.changes,
                patch: file?.patch
            };

        } catch (error) {
            throw new Error(`Failed to get file diff: ${error.message}`);
        }
    }

    // Utility functions
    async cleanupDirectory(dirPath) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
        } catch (error) {
            console.error('Failed to cleanup directory:', error);
        }
    }

    getLanguageFromExtension(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const langMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'html': 'html',
            'css': 'css',
            'py': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'php': 'php',
            'rb': 'ruby',
            'go': 'go',
            'rs': 'rust',
            'md': 'markdown',
            'json': 'json',
            'xml': 'xml',
            'yml': 'yaml',
            'yaml': 'yaml'
        };
        return langMap[ext] || 'plaintext';
    }

    // GitHub OAuth helper methods
    static getGitHubAuthUrl(clientId, redirectUri, state) {
        const scope = 'repo,user:email';
        return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
    }

    static async exchangeCodeForToken(clientId, clientSecret, code) {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error_description || data.error);
        }

        return data.access_token;
    }
}

module.exports = GitService;