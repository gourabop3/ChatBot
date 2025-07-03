# 🚨 Deployment Troubleshooting Guide

This guide helps you diagnose and fix common deployment issues with your Cursor AI platform.

## ✅ Fixed Issue: "Cannot find module './routes/github'"

**Problem**: Backend deployment failing with module not found errors.

**Solution**: ✅ **FIXED** - Updated `backend/server.js` to:
- Remove imports for non-existent route files
- Add optional service loading with error handling
- Include placeholder routes for missing endpoints

## 🔍 Common Deployment Issues

### 1. Backend Module Not Found Errors

#### Symptoms:
```
Error: Cannot find module './routes/github'
Error: Cannot find module './routes/agents'
Error: Cannot find module './routes/collaboration'
```

#### Solution:
✅ **Already Fixed** - The backend now handles missing modules gracefully.

#### If you see similar errors:
1. Check if the file exists in `backend/routes/`
2. Update imports in `server.js` to match existing files
3. Add placeholder routes for missing endpoints

### 2. Environment Variables Missing

#### Symptoms:
```
MongoServerError: Authentication failed
Stripe API error: Invalid API key
GitHub OAuth error: Client not found
```

#### Solution:
1. **Check Render Environment Variables**:
   - Go to Render Dashboard → Your Backend Service → Environment
   - Verify all required variables are set:

```bash
# Required Variables
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-jwt-secret
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://cursor-ai-frontend.onrender.com

# Optional but recommended
GEMINI_API_KEY=your-gemini-key
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-secret
```

### 3. Build Command Issues

#### Symptoms:
```
Build failed: npm install failed
Build timeout
Dependencies not found
```

#### Solution:
1. **Verify package.json**:
   ```json
   {
     "scripts": {
       "start": "node server.js",
       "build": "echo 'No build step required'"
     }
   }
   ```

2. **Use correct Render settings**:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`

### 4. Port Issues

#### Symptoms:
```
Error: EADDRINUSE - Port already in use
Service not accessible
```

#### Solution:
1. **Use Render's PORT environment variable**:
   ```javascript
   const PORT = process.env.PORT || 5000;
   server.listen(PORT, () => {
       console.log(`Server running on port ${PORT}`);
   });
   ```

2. **Set PORT in environment variables**: `PORT=10000`

### 5. CORS Issues

#### Symptoms:
```
Access to fetch blocked by CORS policy
Cross-Origin Request Blocked
```

#### Solution:
1. **Update CORS configuration**:
   ```javascript
   app.use(cors({
       origin: process.env.FRONTEND_URL || "http://localhost:3000",
       credentials: true
   }));
   ```

2. **Set correct FRONTEND_URL**:
   ```bash
   FRONTEND_URL=https://cursor-ai-frontend.onrender.com
   ```

### 6. Database Connection Issues

#### Symptoms:
```
MongoServerError: Could not connect to any servers
MongoTimeoutError: Server selection timed out
```

#### Solution:
1. **Use MongoDB Atlas** (recommended):
   - Create free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
   - Get connection string
   - Add to `MONGODB_URI`

2. **Check connection string format**:
   ```bash
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
   ```

3. **Whitelist Render IPs** in MongoDB Atlas:
   - Database Access → Network Access → Add IP Address
   - Add `0.0.0.0/0` (allow from anywhere) for testing

## 🛠️ Debugging Steps

### Step 1: Check Logs

1. **Render Dashboard**:
   - Go to your service → Logs
   - Look for error messages
   - Check startup logs

2. **Common log patterns**:
   ```bash
   # Good startup
   ✅ Connected to MongoDB
   ✅ Services initialized successfully
   🚀 Server running on port 10000

   # Issues
   ❌ MongoDB connection error
   ⚠️ Warning: Some services failed to initialize
   ```

### Step 2: Test Endpoints

1. **Health Check**:
   ```bash
   curl https://your-backend.onrender.com/api/health
   ```

2. **Expected Response**:
   ```json
   {
     "status": "OK",
     "timestamp": "2025-01-01T00:00:00.000Z",
     "uptime": 123.456,
     "memory": {...}
   }
   ```

### Step 3: Verify Configuration

1. **Check Render Settings**:
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Health Check Path**: `/api/health`

2. **Verify Git Repository**:
   - Ensure latest code is pushed
   - Check if `backend/` folder exists
   - Verify `package.json` is correct

## 🔧 Quick Fixes

### Fix 1: Reset Deployment

```bash
# In Render Dashboard
1. Go to Settings → Advanced
2. Click "Manual Deploy" → "Clear build cache & deploy"
3. Wait for fresh deployment
```

### Fix 2: Environment Variables

```bash
# Copy this template to Render Environment tab
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cursor_ai
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://cursor-ai-frontend.onrender.com
```

### Fix 3: Minimal Test Version

If deployment still fails, use this minimal `server.js`:

```javascript
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

## 📞 Getting Help

### 1. Check Status
- **Render Status**: [status.render.com](https://status.render.com)
- **MongoDB Atlas Status**: [status.cloud.mongodb.com](https://status.cloud.mongodb.com)

### 2. Review Logs
```bash
# Look for these patterns in Render logs:
- "Error:" (deployment errors)
- "Warning:" (potential issues)
- "✅" (successful operations)
- "❌" (failed operations)
```

### 3. Test Locally
```bash
# Clone and test locally first
git clone your-repo
cd backend
npm install
cp .env.example .env
# Add your environment variables to .env
npm start
```

## 🎉 Success Indicators

Your deployment is successful when you see:

```bash
✅ Connected to MongoDB
✅ Services initialized successfully
🚀 Server running on port 10000
🌐 Frontend URL: https://cursor-ai-frontend.onrender.com
📊 Environment: production
```

And your health check returns:
```json
{
  "status": "OK",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

## 🔄 Next Steps After Fix

1. **Verify deployment** works
2. **Test API endpoints**
3. **Configure environment variables**
4. **Test frontend connection**
5. **Set up monitoring**

---

**Your backend deployment issue has been fixed!** 🚀

The latest code update resolves the "Cannot find module" errors. Your backend should now deploy successfully on Render.