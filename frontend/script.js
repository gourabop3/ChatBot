// Cursor AI Code Editor - Production Version
// Advanced AI-powered code editor with backend integration

class CursorAI {
    constructor() {
        // Dynamic API URL detection for deployment
        this.API_BASE_URL = this.getApiBaseUrl();
        this.SOCKET_URL = this.API_BASE_URL;
        
        this.editor = null;
        this.currentFile = null;
        this.files = new Map();
        this.openTabs = [];
        this.activeTabIndex = -1;
        this.fileIdCounter = 0;
        this.socket = null;
        this.currentProject = null;
        this.user = null;
        this.token = localStorage.getItem('cursor_ai_token');
        
        this.init();
    }

    // Detect API base URL based on environment
    getApiBaseUrl() {
        // Check if we're in development or production
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:5000';
        } else {
            // In production, construct the backend URL
            // This assumes your backend service is named 'cursor-ai-backend' on Render
            return `https://chatbot-vyqc.onrender.com`;
        }
    }

    async init() {
        try {
            // Check authentication
            if (this.token) {
                await this.validateToken();
            }
            
            await this.initMonacoEditor();
            this.initEventListeners();
            this.initSocket();
            
            if (this.user) {
                this.initFileSystem();
                this.showDashboard();
            } else {
                this.showAuthScreen();
            }
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application');
        }
    }

    // Validate authentication token
    async validateToken() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                return true;
            } else {
                localStorage.removeItem('cursor_ai_token');
                this.token = null;
                return false;
            }
        } catch (error) {
            console.error('Token validation error:', error);
            localStorage.removeItem('cursor_ai_token');
            this.token = null;
            return false;
        }
    }

    // Initialize Socket.IO connection
    initSocket() {
        if (!this.token) return;

        // Dynamically load Socket.IO
        if (typeof io === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js';
            script.onload = () => {
                this.connectSocket();
            };
            document.head.appendChild(script);
        } else {
            this.connectSocket();
        }
    }

    connectSocket() {
        this.socket = io(this.SOCKET_URL, {
            auth: {
                token: this.token
            }
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        // Real-time collaboration events
        this.socket.on('user-joined', (data) => {
            this.handleUserJoined(data);
        });

        this.socket.on('user-left', (data) => {
            this.handleUserLeft(data);
        });

        this.socket.on('code-change', (data) => {
            this.handleRemoteCodeChange(data);
        });

        this.socket.on('cursor-move', (data) => {
            this.handleRemoteCursor(data);
        });
    }

    // Show authentication screen
    showAuthScreen() {
        const placeholder = document.getElementById('editor-placeholder');
        placeholder.innerHTML = `
            <div class="auth-screen">
                <div class="auth-container">
                    <div class="logo-section">
                        <i class="fas fa-code"></i>
                        <h1>Cursor AI</h1>
                        <p>AI-Powered Code Editor Platform</p>
                    </div>
                    
                    <div class="auth-tabs">
                        <button class="auth-tab active" data-tab="login">Login</button>
                        <button class="auth-tab" data-tab="register">Register</button>
                    </div>
                    
                    <div class="auth-form" id="login-form">
                        <form id="loginForm">
                            <div class="form-group">
                                <input type="email" placeholder="Email" required>
                            </div>
                            <div class="form-group">
                                <input type="password" placeholder="Password" required>
                            </div>
                            <button type="submit" class="btn-primary">Login</button>
                        </form>
                        
                        <div class="divider">
                            <span>or</span>
                        </div>
                        
                        <button class="btn-github" onclick="cursorAI.loginWithGitHub()">
                            <i class="fab fa-github"></i>
                            Continue with GitHub
                        </button>
                    </div>
                    
                    <div class="auth-form hidden" id="register-form">
                        <form id="registerForm">
                            <div class="form-group">
                                <input type="text" placeholder="Username" required>
                            </div>
                            <div class="form-group">
                                <input type="email" placeholder="Email" required>
                            </div>
                            <div class="form-group">
                                <input type="password" placeholder="Password" required>
                            </div>
                            <button type="submit" class="btn-primary">Register</button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Add auth form handlers
        this.initAuthHandlers();
    }

    // Initialize authentication handlers
    initAuthHandlers() {
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchAuthTab(tabName);
            });
        });

        // Login form
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            await this.handleLogin({
                email: formData.get('email'),
                password: formData.get('password')
            });
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            await this.handleRegister({
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password')
            });
        });
    }

    switchAuthTab(tabName) {
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('hidden', form.id !== `${tabName}-form`);
        });
    }

    // Handle login
    async handleLogin(credentials) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('cursor_ai_token', this.token);
                
                this.initSocket();
                this.initFileSystem();
                this.showDashboard();
                this.showNotification('Login successful!');
            } else {
                this.showError(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
        }
    }

    // Handle registration
    async handleRegister(userData) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('cursor_ai_token', this.token);
                
                this.initSocket();
                this.initFileSystem();
                this.showDashboard();
                this.showNotification('Registration successful!');
            } else {
                this.showError(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Registration failed. Please try again.');
        }
    }

    // GitHub OAuth login
    async loginWithGitHub() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/auth/github/url`);
            const data = await response.json();
            
            if (response.ok) {
                // Store state for verification
                localStorage.setItem('github_oauth_state', data.state);
                window.location.href = data.authUrl;
            } else {
                this.showError('Failed to initialize GitHub login');
            }
        } catch (error) {
            console.error('GitHub login error:', error);
            this.showError('GitHub login failed');
        }
    }

    // Show dashboard
    showDashboard() {
        document.getElementById('monaco-editor').style.display = 'none';
        document.getElementById('editor-placeholder').style.display = 'flex';
        
        const placeholder = document.getElementById('editor-placeholder');
        placeholder.innerHTML = `
            <div class="dashboard">
                <div class="dashboard-header">
                    <h2>Welcome back, ${this.user.username}!</h2>
                    <div class="user-info">
                        <span>${this.user.subscription.plan} Plan</span>
                        <button class="btn-secondary" onclick="cursorAI.logout()">Logout</button>
                    </div>
                </div>
                
                <div class="dashboard-content">
                    <div class="quick-actions">
                        <button class="btn-primary" onclick="cursorAI.createNewProject()">
                            <i class="fas fa-plus"></i>
                            Create New Project
                        </button>
                        <button class="btn-secondary" onclick="cursorAI.openProjectBrowser()">
                            <i class="fas fa-folder"></i>
                            Browse Projects
                        </button>
                    </div>
                    
                    <div class="recent-projects">
                        <h3>Recent Projects</h3>
                        <div id="recent-projects-list">
                            <div class="loading">Loading projects...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.loadRecentProjects();
    }

    // Load recent projects
    async loadRecentProjects() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/projects`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.displayRecentProjects(data.projects);
            } else {
                this.showError('Failed to load projects');
            }
        } catch (error) {
            console.error('Load projects error:', error);
            this.showError('Failed to load projects');
        }
    }

    // Display recent projects
    displayRecentProjects(projects) {
        const container = document.getElementById('recent-projects-list');
        
        if (projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No projects yet. Create your first project!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(project => `
            <div class="project-card" onclick="cursorAI.openProject('${project._id}')">
                <div class="project-icon">
                    <i class="fas fa-code"></i>
                </div>
                <div class="project-info">
                    <h4>${project.name}</h4>
                    <p>${project.description || 'No description'}</p>
                    <div class="project-meta">
                        <span><i class="fas fa-clock"></i> ${this.formatDate(project.lastAccessedAt)}</span>
                        <span><i class="fas fa-file"></i> ${project.stats.totalFiles} files</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Create new project
    async createNewProject() {
        const name = prompt('Enter project name:');
        if (!name) return;

        try {
            const response = await fetch(`${this.API_BASE_URL}/api/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ name })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentProject = data.project;
                this.loadProjectFiles();
                this.showNotification('Project created successfully!');
            } else {
                this.showError(data.error || 'Failed to create project');
            }
        } catch (error) {
            console.error('Create project error:', error);
            this.showError('Failed to create project');
        }
    }

    // Open existing project
    async openProject(projectId) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const project = await response.json();
                this.currentProject = project;
                this.loadProjectFiles();
                
                // Join project room for collaboration
                if (this.socket) {
                    this.socket.emit('join-project', projectId);
                }
            } else {
                this.showError('Failed to open project');
            }
        } catch (error) {
            console.error('Open project error:', error);
            this.showError('Failed to open project');
        }
    }

    // Load project files
    loadProjectFiles() {
        // Clear existing files
        this.files.clear();
        this.openTabs = [];
        
        // Load project files
        if (this.currentProject && this.currentProject.files) {
            this.currentProject.files.forEach(file => {
                this.files.set(file._id, file);
            });
        }
        
        this.updateFileTree();
        this.showEditor();
    }

    // Show editor interface
    showEditor() {
        document.getElementById('editor-placeholder').style.display = 'none';
        document.getElementById('monaco-editor').style.display = 'block';
        
        if (this.files.size > 0) {
            // Open the first file
            const firstFile = Array.from(this.files.values())[0];
            this.openFile(firstFile);
        }
    }

    // Logout
    logout() {
        localStorage.removeItem('cursor_ai_token');
        this.token = null;
        this.user = null;
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.showAuthScreen();
    }

    // Initialize Monaco Editor (same as before)
    async initMonacoEditor() {
        return new Promise((resolve) => {
            require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
            require(['vs/editor/editor.main'], () => {
                this.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                    value: '',
                    language: 'javascript',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on'
                });

                document.getElementById('monaco-editor').style.display = 'none';
                resolve();
            });
        });
    }

    // Initialize event listeners (same as before)
    initEventListeners() {
        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchSidebarPanel(e.target.closest('.sidebar-tab').dataset.panel);
            });
        });

        // File operations
        document.getElementById('new-file-btn').addEventListener('click', () => this.createNewFile());
        document.getElementById('create-file-btn').addEventListener('click', () => this.createNewFile());
    }

    // Utility methods
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 5000);
    }

    // Placeholder methods for remaining functionality
    initFileSystem() {
        // Initialize with empty state for now
        this.updateFileTree();
    }

    updateFileTree() {
        const fileTree = document.getElementById('file-tree');
        fileTree.innerHTML = '<div class="empty-state">No files yet</div>';
    }

    createNewFile() {
        const name = prompt('Enter file name:');
        if (name) {
            this.showNotification(`File "${name}" created (placeholder)`);
        }
    }

    openFile(file) {
        if (this.editor) {
            this.editor.setValue(file.content || '');
        }
    }

    switchSidebarPanel(panelName) {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.panel === panelName);
        });

        document.querySelectorAll('.sidebar-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `${panelName}-panel`);
        });
    }

    // Collaboration handlers
    handleUserJoined(data) {
        console.log('User joined:', data);
    }

    handleUserLeft(data) {
        console.log('User left:', data);
    }

    handleRemoteCodeChange(data) {
        console.log('Remote code change:', data);
    }

    handleRemoteCursor(data) {
        console.log('Remote cursor move:', data);
    }
}

// Initialize the application
let cursorAI;
document.addEventListener('DOMContentLoaded', function() {
    cursorAI = new CursorAI();
});

// Handle GitHub OAuth callback
if (window.location.pathname === '/auth/github/callback') {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state === localStorage.getItem('github_oauth_state')) {
        // Handle GitHub callback
        fetch(`${window.location.origin}/api/auth/github/callback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, state })
        }).then(response => response.json())
          .then(data => {
              if (data.token) {
                  localStorage.setItem('cursor_ai_token', data.token);
                  window.location.href = '/';
              } else {
                  alert('GitHub authentication failed');
                  window.location.href = '/';
              }
          });
    }
}
