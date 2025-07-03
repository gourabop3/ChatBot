# 🔑 GitHub OAuth Setup Guide

This guide will walk you through creating GitHub OAuth credentials for your Cursor AI application.

## 📋 What You'll Get

After following this guide, you'll have:
- **GitHub Client ID** - Public identifier for your app
- **GitHub Client Secret** - Secret key for authentication
- **OAuth App Configuration** - Proper callback URLs and permissions

## 🚀 Step-by-Step Setup

### Step 1: Access GitHub Developer Settings

1. **Go to GitHub** → [github.com](https://github.com)
2. **Sign in** to your GitHub account
3. **Click your profile picture** (top right corner)
4. **Select "Settings"** from the dropdown menu

### Step 2: Navigate to Developer Settings

1. **Scroll down** in the left sidebar
2. **Click "Developer settings"** (at the bottom)
3. **Click "OAuth Apps"** in the left sidebar

### Step 3: Create New OAuth App

1. **Click "New OAuth App"** button
2. **Fill in the application details**:

```
Application name: Cursor AI Code Editor
Homepage URL: https://your-app-name.onrender.com
Application description: AI-powered code editor with GitHub integration (optional)
Authorization callback URL: https://cursor-ai-backend.onrender.com/api/auth/github/callback
```

### Step 4: Configure URLs Based on Your Deployment

#### For Render Deployment (Recommended):
```
Homepage URL: https://cursor-ai-frontend.onrender.com
Callback URL: https://cursor-ai-backend.onrender.com/api/auth/github/callback
```

#### For Custom Domain:
```
Homepage URL: https://yourdomain.com
Callback URL: https://api.yourdomain.com/api/auth/github/callback
```

#### For Local Development:
```
Homepage URL: http://localhost:3000
Callback URL: http://localhost:5000/api/auth/github/callback
```

### Step 5: Register the Application

1. **Click "Register application"**
2. **You'll be redirected** to your new OAuth app page

### Step 6: Get Your Credentials

On the OAuth app page, you'll see:

1. **Client ID**: 
   - This is visible immediately
   - Copy this value (e.g., `Iv1.a629723478c2dcf5`)

2. **Client Secret**:
   - Click "Generate a new client secret"
   - **IMPORTANT**: Copy this immediately - you won't see it again!
   - It looks like: `2f8d8e5a7b9c6d3e4f5a8b7c9d6e3f4a5b8c7d9e`

## 🔐 Security Best Practices

### ⚠️ Important Security Notes:

1. **Never commit secrets to Git**
2. **Store secrets as environment variables**
3. **Use different OAuth apps for development and production**
4. **Regenerate secrets if compromised**

### Environment Variables Setup:

```bash
# Add these to your backend environment
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

## 🛠️ Integration with Cursor AI

### Backend Configuration

Your backend is already configured to use these credentials. Just set the environment variables:

```javascript
// backend/routes/auth.js (already implemented)
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
```

### Frontend Integration

The frontend automatically handles GitHub OAuth:

```javascript
// frontend/script.js (already implemented)
async loginWithGitHub() {
    const response = await fetch(`${this.API_BASE_URL}/api/auth/github/url`);
    const data = await response.json();
    window.location.href = data.authUrl;
}
```

## 🚀 Deployment-Specific Setup

### For Render Deployment

1. **Create OAuth App** with Render URLs
2. **Set Environment Variables** in Render Dashboard:
   - Go to your backend service
   - Environment tab
   - Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

### For Netlify + Render

1. **Frontend on Netlify**: `https://your-app.netlify.app`
2. **Backend on Render**: `https://your-backend.onrender.com`
3. **OAuth Callback**: `https://your-backend.onrender.com/api/auth/github/callback`

### For Vercel + Railway

1. **Frontend on Vercel**: `https://your-app.vercel.app`
2. **Backend on Railway**: `https://your-backend.railway.app`
3. **OAuth Callback**: `https://your-backend.railway.app/api/auth/github/callback`

## 🔄 OAuth Flow Explained

Here's how the GitHub OAuth process works in your app:

```
1. User clicks "Login with GitHub"
   ↓
2. Frontend requests GitHub auth URL from backend
   ↓
3. User redirected to GitHub authorization page
   ↓
4. User grants permission
   ↓
5. GitHub redirects to callback URL with authorization code
   ↓
6. Backend exchanges code for access token
   ↓
7. Backend gets user info from GitHub API
   ↓
8. Backend creates/updates user account
   ↓
9. Backend returns JWT token to frontend
   ↓
10. User is logged in to Cursor AI
```

## 🛠️ Testing Your Setup

### 1. Test Locally

```bash
# Set environment variables
export GITHUB_CLIENT_ID=your_client_id
export GITHUB_CLIENT_SECRET=your_client_secret

# Start backend
cd backend && npm start

# Open frontend
# Click "Login with GitHub"
```

### 2. Test in Production

1. **Deploy** your application
2. **Set environment variables** in your hosting platform
3. **Try GitHub login** on your live site

## 🚨 Troubleshooting

### Common Issues:

#### 1. "OAuth App not found" Error
- **Problem**: Wrong Client ID
- **Solution**: Double-check the Client ID from GitHub

#### 2. "Bad verification code" Error
- **Problem**: Wrong Client Secret or callback URL
- **Solution**: Verify Client Secret and callback URL match exactly

#### 3. "Redirect URI mismatch" Error
- **Problem**: Callback URL doesn't match OAuth app settings
- **Solution**: Update OAuth app callback URL to match your deployment

#### 4. CORS Issues
- **Problem**: Frontend and backend on different domains
- **Solution**: Configure CORS in backend to allow your frontend domain

### Debug Steps:

1. **Check Environment Variables**:
   ```bash
   echo $GITHUB_CLIENT_ID
   echo $GITHUB_CLIENT_SECRET
   ```

2. **Verify OAuth App Settings**:
   - Go to GitHub → Settings → Developer settings → OAuth Apps
   - Check URLs match your deployment

3. **Check Backend Logs**:
   - Look for OAuth-related errors
   - Verify API calls to GitHub

## 📝 Environment Variables Reference

### Required for Backend:

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.a629723478c2dcf5
GITHUB_CLIENT_SECRET=2f8d8e5a7b9c6d3e4f5a8b7c9d6e3f4a5b8c7d9e

# Other required variables
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=AIza...
# ... (other variables)
```

## 🔄 Updating OAuth App

### When to Update:

- **Domain Change**: New deployment URL
- **Security Breach**: Regenerate client secret
- **Scope Changes**: Need additional GitHub permissions

### How to Update:

1. **Go to GitHub OAuth App settings**
2. **Update URLs** if domain changed
3. **Generate new client secret** if needed
4. **Update environment variables** in your deployment

## 🎉 You're All Set!

Once you have your GitHub OAuth credentials:

1. ✅ **Client ID**: Set as `GITHUB_CLIENT_ID`
2. ✅ **Client Secret**: Set as `GITHUB_CLIENT_SECRET`
3. ✅ **Callback URL**: Configured in GitHub OAuth app
4. ✅ **Environment Variables**: Set in your deployment platform

Your Cursor AI application will now support GitHub OAuth login! 🚀

---

**Need help?** Check the troubleshooting section or create an issue in the repository.