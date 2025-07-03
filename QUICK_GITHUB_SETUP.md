# ⚡ Quick GitHub OAuth Setup

## 🎯 Goal: Get GitHub Client ID & Client Secret

### 📱 5-Minute Setup:

1. **Go to GitHub.com** → Sign in
2. **Profile Picture** → **Settings**
3. **Scroll down** → **Developer settings**
4. **OAuth Apps** → **New OAuth App**

### 📝 Fill in these details:

```
Application name: Cursor AI
Homepage URL: https://cursor-ai-frontend.onrender.com
Callback URL: https://cursor-ai-backend.onrender.com/api/auth/github/callback
```

### 🔑 Get Your Credentials:

1. **Client ID**: Copy it (visible immediately)
2. **Client Secret**: Click "Generate new" → Copy immediately!

### 🚀 Add to Your Deployment:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

### ✅ That's it! 

Your GitHub OAuth is ready for Cursor AI integration.

---

📖 **Need detailed guide?** See `GITHUB_OAUTH_SETUP.md`