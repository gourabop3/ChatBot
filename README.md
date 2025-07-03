# Cursor AI - Code Editor

A modern, AI-powered code editor built with Monaco Editor and Google's Gemini API. This editor provides a VS Code-like experience with integrated AI assistance for coding tasks.

## ✨ Features

### Core Editor Features
- **Monaco Editor Integration**: Professional code editing with VS Code's editor engine
- **Syntax Highlighting**: Support for 15+ programming languages including JavaScript, TypeScript, Python, HTML, CSS, and more
- **Auto-completion**: Intelligent code completion with AI-powered suggestions
- **Multiple Tabs**: Open and manage multiple files simultaneously
- **File Explorer**: Built-in file tree with create, rename, delete operations
- **Status Bar**: Shows cursor position, file language, and encoding
- **Keyboard Shortcuts**: Standard editor shortcuts (Ctrl+S save, Ctrl+N new, etc.)

### AI-Powered Features
- **AI Chat Assistant**: Context-aware coding assistance using Gemini AI
- **Code Analysis**: Get AI suggestions for code improvements and optimizations
- **Smart Completions**: AI-powered code completion suggestions
- **Context-Aware Help**: AI understands your current file and provides relevant assistance

### User Interface
- **Dark Theme**: Modern VS Code-inspired dark theme
- **Responsive Design**: Works on desktop and mobile devices
- **Split View**: Sidebar with explorer, search, and AI chat panels
- **Context Menus**: Right-click operations for file management
- **Drag & Drop**: File upload support

### File Management
- **Create Files**: New files with automatic language detection
- **Open Multiple Files**: Tab-based file management
- **Auto-save**: Automatic saving every 30 seconds
- **Download Files**: Export files to your local machine
- **File Icons**: Language-specific file icons

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for AI features

### Installation
1. Clone or download this repository
2. Open `index.html` in your web browser
3. Start coding!

### Setting Up AI Features
1. Get a Google Gemini API key from [Google AI Studio](https://makersuite.google.com/)
2. Replace the API key in `script.js`:
   ```javascript
   this.API_KEY = 'your-api-key-here';
   ```

## 📋 Usage

### Basic Operations
- **Create New File**: Click the "+" button in the explorer or use `Ctrl+N`
- **Open File**: Click any file in the explorer
- **Save File**: Use `Ctrl+S` or files auto-save every 30 seconds
- **Close File**: Click the "×" on any tab or use `Ctrl+W`
- **Switch Tabs**: Click on any tab to switch between open files

### AI Assistant
- **Open AI Chat**: Click the robot icon in the sidebar or use `Ctrl+/`
- **Ask Questions**: Type any coding question or request help with your code
- **Get Code Analysis**: Click the magic wand icon in the status bar for AI code suggestions
- **Context Awareness**: The AI knows about your current file and can provide relevant help

### File Management
- **Upload Files**: Use the hidden file input (can be triggered programmatically)
- **Download Files**: Right-click any file and select "Download"
- **Rename Files**: Right-click any file and select "Rename"
- **Delete Files**: Right-click any file and select "Delete"

### Keyboard Shortcuts
- `Ctrl+S` - Save current file
- `Ctrl+N` - Create new file
- `Ctrl+W` - Close current file
- `Ctrl+/` - Open AI chat and focus input
- Standard Monaco Editor shortcuts (Ctrl+Z undo, Ctrl+Y redo, etc.)

## 🎨 Supported Languages

The editor automatically detects file types and provides appropriate syntax highlighting for:

- **Web**: HTML, CSS, JavaScript, TypeScript
- **Backend**: Python, Java, PHP, Ruby, Go, Rust, C, C++
- **Data**: JSON, XML, YAML
- **Documentation**: Markdown
- **And more**: Plain text and other formats

## 🤖 AI Features

### Context-Aware Assistance
The AI assistant understands:
- Your current file content
- The programming language you're using
- Your specific questions and requests

### Code Analysis
Get AI-powered insights on:
- Code optimization opportunities
- Potential bugs and issues
- Best practices and improvements
- Performance suggestions

### Smart Completions
AI-powered code completion provides:
- Function and variable suggestions
- Code pattern completions
- Language-specific recommendations

## 🛠️ Technical Details

### Architecture
- **Frontend**: Pure HTML, CSS, JavaScript
- **Editor**: Monaco Editor (VS Code's editor engine)
- **AI**: Google Gemini API integration
- **Styling**: Custom CSS with VS Code-inspired theme

### File Structure
```
cursor-ai/
├── index.html          # Main HTML structure
├── styles.css          # Complete styling and themes
├── script.js           # Core application logic
├── README.md           # This documentation
├── bot.jpg            # AI assistant avatar
└── user.jpg           # User avatar
```

### Browser Compatibility
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 🔧 Customization

### Themes
The editor uses a dark theme by default. You can customize colors in `styles.css` by modifying the CSS custom properties.

### AI Model
Currently uses Google Gemini 1.5 Flash. You can modify the API endpoint in `script.js` to use different models:
```javascript
this.API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
```

### Adding Languages
To add support for new languages:
1. Update the `getLanguageFromExtension()` method in `script.js`
2. Add file icons in the `getFileIcon()` method
3. Monaco Editor will automatically provide syntax highlighting

## 🚨 Limitations

- Files are stored in memory only (no persistence)
- AI features require internet connection
- Limited to client-side functionality
- No real-time collaboration features
- No plugin system

## 🔮 Future Enhancements

- [ ] File persistence with localStorage/IndexedDB
- [ ] Real-time collaboration
- [ ] Plugin system
- [ ] More AI models support
- [ ] Code execution capabilities
- [ ] Git integration
- [ ] Extended language support
- [ ] Custom themes
- [ ] Mobile app version

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Additional language support
- UI/UX enhancements
- Performance optimizations
- New AI features
- Bug fixes and testing

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- **Monaco Editor** - Microsoft's powerful web-based code editor
- **Google Gemini** - AI capabilities
- **Font Awesome** - Icons
- **VS Code** - Design inspiration

---

**Note**: This is a demonstration project. For production use, consider implementing proper security measures, error handling, and performance optimizations.