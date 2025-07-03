// Cursor AI Code Editor
// Advanced AI-powered code editor with Monaco Editor integration

class CursorAI {
    constructor() {
        this.API_KEY = 'AIzaSyA4rhJip9gC6nfoQ3FNq2OKCJKtYo3gM5E';
        this.API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
        
        this.editor = null;
        this.currentFile = null;
        this.files = new Map();
        this.openTabs = [];
        this.activeTabIndex = -1;
        this.fileIdCounter = 0;
        
        this.init();
    }

    async init() {
        await this.initMonacoEditor();
        this.initEventListeners();
        this.initFileSystem();
        this.showWelcomeScreen();
    }

    // Initialize Monaco Editor
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
                    wordWrap: 'on',
                    renderLineHighlight: 'all',
                    selectOnLineNumbers: true,
                    roundedSelection: false,
                    readOnly: false,
                    cursorStyle: 'line',
                    automaticLayout: true,
                    glyphMargin: true,
                    folding: true,
                    showFoldingControls: 'mouseover'
                });

                // Hide editor initially
                document.getElementById('monaco-editor').style.display = 'none';

                // Editor event listeners
                this.editor.onDidChangeModelContent(() => {
                    this.onEditorContentChange();
                });

                this.editor.onDidChangeCursorPosition((e) => {
                    this.updateCursorPosition(e.position);
                });

                // Add AI completion provider
                this.addAICompletionProvider();

                resolve();
            });
        });
    }

    // Add AI-powered completion provider
    addAICompletionProvider() {
        monaco.languages.registerCompletionItemProvider('javascript', {
            provideCompletionItems: async (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                // Get context around cursor
                const textBeforeCursor = model.getValueInRange({
                    startLineNumber: Math.max(1, position.lineNumber - 5),
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                try {
                    const suggestions = await this.getAICompletions(textBeforeCursor);
                    return {
                        suggestions: suggestions.map(suggestion => ({
                            label: suggestion,
                            kind: monaco.languages.CompletionItemKind.Text,
                            insertText: suggestion,
                            range: range
                        }))
                    };
                } catch (error) {
                    console.error('AI completion error:', error);
                    return { suggestions: [] };
                }
            }
        });
    }

    // Get AI-powered code completions
    async getAICompletions(context) {
        const prompt = `Complete this code. Provide only the completion suggestions as a JSON array of strings:\n\n${context}`;
        
        try {
            const response = await this.callGeminiAPI(prompt);
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    // Initialize event listeners
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

        // Chat functionality
        document.getElementById('send-button').addEventListener('click', () => this.handleChatMessage());
        document.getElementById('user-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleChatMessage();
            }
        });

        // AI suggestions
        document.getElementById('ai-suggest-btn').addEventListener('click', () => this.getAICodeSuggestions());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Context menu
        document.addEventListener('contextmenu', (e) => this.showContextMenu(e));
        document.addEventListener('click', () => this.hideContextMenu());

        // File upload
        document.getElementById('file-upload').addEventListener('change', (e) => this.handleFileUpload(e));

        // Tab operations
        document.getElementById('split-editor-btn').addEventListener('click', () => this.splitEditor());
    }

    // Initialize file system with sample files
    initFileSystem() {
        // Create sample files
        this.createFile('index.html', 'html', this.getSampleHTML());
        this.createFile('app.js', 'javascript', this.getSampleJS());
        this.createFile('styles.css', 'css', this.getSampleCSS());
        this.createFile('README.md', 'markdown', this.getSampleMarkdown());
        
        this.updateFileTree();
    }

    // File management
    createFile(name, language = 'plaintext', content = '') {
        const fileId = `file_${this.fileIdCounter++}`;
        const file = {
            id: fileId,
            name: name,
            language: language,
            content: content,
            isModified: false,
            lastSaved: new Date()
        };
        
        this.files.set(fileId, file);
        return file;
    }

    createNewFile() {
        const name = prompt('Enter file name:');
        if (!name) return;
        
        const language = this.getLanguageFromExtension(name);
        const file = this.createFile(name, language);
        this.openFile(file);
        this.updateFileTree();
    }

    openFile(file) {
        // Check if file is already open
        const existingTabIndex = this.openTabs.findIndex(tab => tab.id === file.id);
        
        if (existingTabIndex !== -1) {
            this.switchToTab(existingTabIndex);
            return;
        }

        // Add to open tabs
        this.openTabs.push(file);
        this.activeTabIndex = this.openTabs.length - 1;
        this.currentFile = file;

        // Update editor
        this.editor.setValue(file.content);
        monaco.editor.setModelLanguage(this.editor.getModel(), file.language);
        
        // Show editor, hide welcome screen
        document.getElementById('monaco-editor').style.display = 'block';
        document.getElementById('editor-placeholder').style.display = 'none';

        this.updateTabs();
        this.updateStatusBar();
    }

    closeFile(fileId) {
        const tabIndex = this.openTabs.findIndex(tab => tab.id === fileId);
        if (tabIndex === -1) return;

        const file = this.openTabs[tabIndex];
        
        // Check if file has unsaved changes
        if (file.isModified) {
            if (!confirm(`File "${file.name}" has unsaved changes. Close anyway?`)) {
                return;
            }
        }

        // Remove from open tabs
        this.openTabs.splice(tabIndex, 1);

        // Adjust active tab index
        if (this.activeTabIndex >= tabIndex) {
            this.activeTabIndex = Math.max(0, this.activeTabIndex - 1);
        }

        // Switch to another tab or show welcome screen
        if (this.openTabs.length > 0) {
            this.currentFile = this.openTabs[this.activeTabIndex];
            this.editor.setValue(this.currentFile.content);
            monaco.editor.setModelLanguage(this.editor.getModel(), this.currentFile.language);
        } else {
            this.currentFile = null;
            this.showWelcomeScreen();
        }

        this.updateTabs();
        this.updateStatusBar();
    }

    saveFile() {
        if (!this.currentFile) return;
        
        this.currentFile.content = this.editor.getValue();
        this.currentFile.isModified = false;
        this.currentFile.lastSaved = new Date();
        
        // Update in files map
        this.files.set(this.currentFile.id, this.currentFile);
        
        this.updateTabs();
        this.updateStatusBar();
        
        // Simulate save (in real app, this would save to server/localStorage)
        this.showNotification(`Saved ${this.currentFile.name}`);
    }

    downloadFile(fileId) {
        const file = this.files.get(fileId);
        if (!file) return;

        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Tab management
    updateTabs() {
        const tabsContainer = document.getElementById('tabs');
        tabsContainer.innerHTML = '';

        this.openTabs.forEach((file, index) => {
            const tab = document.createElement('div');
            tab.className = `tab ${index === this.activeTabIndex ? 'active' : ''}`;
            
            const icon = this.getFileIcon(file.name);
            const modifiedIndicator = file.isModified ? '●' : '';
            
            tab.innerHTML = `
                <i class="${icon}"></i>
                <span>${file.name}</span>
                <span class="modified-indicator">${modifiedIndicator}</span>
                <button class="tab-close" onclick="event.stopPropagation(); cursorAI.closeFile('${file.id}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            tab.addEventListener('click', () => this.switchToTab(index));
            tabsContainer.appendChild(tab);
        });
    }

    switchToTab(index) {
        if (index < 0 || index >= this.openTabs.length) return;
        
        this.activeTabIndex = index;
        this.currentFile = this.openTabs[index];
        
        this.editor.setValue(this.currentFile.content);
        monaco.editor.setModelLanguage(this.editor.getModel(), this.currentFile.language);
        
        this.updateTabs();
        this.updateStatusBar();
    }

    // File tree
    updateFileTree() {
        const fileTree = document.getElementById('file-tree');
        fileTree.innerHTML = '';

        Array.from(this.files.values()).forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const icon = this.getFileIcon(file.name);
            fileItem.innerHTML = `
                <i class="${icon}"></i>
                <span>${file.name}</span>
            `;
            
            fileItem.addEventListener('click', () => this.openFile(file));
            fileItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showFileContextMenu(e, file);
            });
            
            fileTree.appendChild(fileItem);
        });
    }

    // Sidebar panel switching
    switchSidebarPanel(panelName) {
        // Update tab states
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.panel === panelName);
        });

        // Show/hide panels
        document.querySelectorAll('.sidebar-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `${panelName}-panel`);
        });
    }

    // AI Chat functionality
    async handleChatMessage() {
        const userInput = document.getElementById('user-input');
        const message = userInput.value.trim();
        
        if (!message) return;
        
        // Add user message to chat
        this.addChatMessage(message, true);
        userInput.value = '';
        
        // Disable input while processing
        userInput.disabled = true;
        document.getElementById('send-button').disabled = true;

        try {
            // Prepare context-aware prompt
            const contextPrompt = this.buildContextAwarePrompt(message);
            const response = await this.callGeminiAPI(contextPrompt);
            
            // Add bot response
            this.addChatMessage(response, false);
        } catch (error) {
            console.error('Chat error:', error);
            this.addChatMessage('Sorry, I encountered an error. Please try again.', false);
        } finally {
            // Re-enable input
            userInput.disabled = false;
            document.getElementById('send-button').disabled = false;
            userInput.focus();
        }
    }

    buildContextAwarePrompt(userMessage) {
        let prompt = `You are an AI coding assistant similar to Cursor AI. `;
        
        if (this.currentFile) {
            prompt += `The user is currently editing a ${this.currentFile.language} file named "${this.currentFile.name}". `;
            prompt += `Here's the current file content:\n\n\`\`\`${this.currentFile.language}\n${this.currentFile.content}\n\`\`\`\n\n`;
        }
        
        prompt += `User question: ${userMessage}\n\n`;
        prompt += `Please provide helpful, accurate coding assistance. If suggesting code changes, provide clear explanations.`;
        
        return prompt;
    }

    async callGeminiAPI(prompt) {
        const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate response');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    addChatMessage(message, isUser) {
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

        const profileImage = document.createElement('img');
        profileImage.className = 'profile-image';
        profileImage.src = isUser ? 'user.jpg' : 'bot.jpg';
        profileImage.alt = isUser ? 'User' : 'Bot';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = this.cleanMarkdown(message);

        messageElement.appendChild(profileImage);
        messageElement.appendChild(messageContent);
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    cleanMarkdown(text) {
        return text
            .replace(/#{1,6}\s?/g, '')
            .replace(/\*\*/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // AI Code Suggestions
    async getAICodeSuggestions() {
        if (!this.currentFile) {
            this.showNotification('No file is currently open');
            return;
        }

        const prompt = `Analyze this ${this.currentFile.language} code and provide suggestions for improvements, optimizations, or potential issues:\n\n\`\`\`${this.currentFile.language}\n${this.currentFile.content}\n\`\`\``;
        
        try {
            const suggestions = await this.callGeminiAPI(prompt);
            this.switchSidebarPanel('ai-chat');
            this.addChatMessage(`Code analysis for ${this.currentFile.name}:\n\n${suggestions}`, false);
        } catch (error) {
            this.showNotification('Failed to get AI suggestions');
        }
    }

    // Editor events
    onEditorContentChange() {
        if (this.currentFile) {
            this.currentFile.isModified = true;
            this.updateTabs();
        }
    }

    updateCursorPosition(position) {
        document.getElementById('cursor-position').textContent = `Ln ${position.lineNumber}, Col ${position.column}`;
    }

    updateStatusBar() {
        if (this.currentFile) {
            document.getElementById('file-language').textContent = this.currentFile.language;
        } else {
            document.getElementById('file-language').textContent = 'Plain Text';
            document.getElementById('cursor-position').textContent = 'Ln 1, Col 1';
        }
    }

    // Utility functions
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

    getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const iconMap = {
            'js': 'fab fa-js-square',
            'ts': 'fab fa-js-square',
            'html': 'fab fa-html5',
            'css': 'fab fa-css3-alt',
            'py': 'fab fa-python',
            'java': 'fab fa-java',
            'php': 'fab fa-php',
            'rb': 'fas fa-gem',
            'go': 'fas fa-code',
            'rs': 'fas fa-code',
            'md': 'fab fa-markdown',
            'json': 'fas fa-file-code',
            'xml': 'fas fa-file-code'
        };
        return iconMap[ext] || 'fas fa-file';
    }

    showWelcomeScreen() {
        document.getElementById('monaco-editor').style.display = 'none';
        document.getElementById('editor-placeholder').style.display = 'flex';
    }

    showNotification(message) {
        // Simple notification (could be enhanced with a proper notification system)
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007acc;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }

    // Keyboard shortcuts
    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    this.saveFile();
                    break;
                case 'n':
                    e.preventDefault();
                    this.createNewFile();
                    break;
                case 'w':
                    e.preventDefault();
                    if (this.currentFile) {
                        this.closeFile(this.currentFile.id);
                    }
                    break;
                case '/':
                    e.preventDefault();
                    this.switchSidebarPanel('ai-chat');
                    document.getElementById('user-input').focus();
                    break;
            }
        }
    }

    // Context menu
    showContextMenu(e) {
        if (e.target.closest('.file-item')) {
            e.preventDefault();
            // File context menu handled separately
            return;
        }
    }

    showFileContextMenu(e, file) {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
        contextMenu.classList.remove('hidden');

        // Add event listeners for context menu items
        const items = contextMenu.querySelectorAll('.context-item');
        items.forEach(item => {
            item.onclick = () => {
                const action = item.dataset.action;
                switch (action) {
                    case 'download':
                        this.downloadFile(file.id);
                        break;
                    case 'delete':
                        this.deleteFile(file.id);
                        break;
                    case 'rename':
                        this.renameFile(file.id);
                        break;
                }
                this.hideContextMenu();
            };
        });
    }

    hideContextMenu() {
        document.getElementById('context-menu').classList.add('hidden');
    }

    deleteFile(fileId) {
        const file = this.files.get(fileId);
        if (!file) return;

        if (confirm(`Delete "${file.name}"?`)) {
            this.files.delete(fileId);
            this.closeFile(fileId);
            this.updateFileTree();
        }
    }

    renameFile(fileId) {
        const file = this.files.get(fileId);
        if (!file) return;

        const newName = prompt('Enter new name:', file.name);
        if (newName && newName !== file.name) {
            file.name = newName;
            file.language = this.getLanguageFromExtension(newName);
            this.updateFileTree();
            this.updateTabs();
        }
    }

    // File upload
    handleFileUpload(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const language = this.getLanguageFromExtension(file.name);
                const newFile = this.createFile(file.name, language, content);
                this.updateFileTree();
            };
            reader.readAsText(file);
        });
    }

    splitEditor() {
        // Placeholder for split editor functionality
        this.showNotification('Split editor functionality coming soon!');
    }

    // Sample file contents
    getSampleHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to My App</h1>
        <p>This is a sample HTML file.</p>
        <button id="btn">Click me!</button>
    </div>
    <script src="app.js"></script>
</body>
</html>`;
    }

    getSampleJS() {
        return `// Sample JavaScript file
document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('btn');
    
    button.addEventListener('click', function() {
        alert('Hello from JavaScript!');
    });
    
    // Simple counter example
    let count = 0;
    
    function increment() {
        count++;
        console.log('Count:', count);
    }
    
    // API fetch example
    async function fetchData() {
        try {
            const response = await fetch('https://api.example.com/data');
            const data = await response.json();
            console.log(data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }
});`;
    }

    getSampleCSS() {
        return `/* Sample CSS file */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    text-align: center;
    max-width: 400px;
}

h1 {
    color: #333;
    margin-bottom: 1rem;
}

p {
    color: #666;
    margin-bottom: 1.5rem;
}

button {
    background: #667eea;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s ease;
}

button:hover {
    background: #764ba2;
}`;
    }

    getSampleMarkdown() {
        return `# My Project

## Description

This is a sample project created with Cursor AI code editor.

## Features

- 🚀 Fast and responsive
- 💡 AI-powered coding assistance
- 🎨 Beautiful UI design
- 📱 Mobile responsive

## Getting Started

1. Clone the repository
2. Install dependencies
3. Run the development server

\`\`\`bash
npm install
npm start
\`\`\`

## Technologies Used

- HTML5
- CSS3
- JavaScript
- Monaco Editor

## Contributing

Pull requests are welcome!

## License

MIT License`;
    }
}

// Initialize the application
let cursorAI;
document.addEventListener('DOMContentLoaded', function() {
    cursorAI = new CursorAI();
});

// Auto-save functionality
setInterval(() => {
    if (cursorAI && cursorAI.currentFile && cursorAI.currentFile.isModified) {
        cursorAI.saveFile();
    }
}, 30000); // Auto-save every 30 seconds
