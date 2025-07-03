# 🚀 Deploy Cursor AI on Render

This guide will walk you through deploying your complete Cursor AI platform on Render with backend API, frontend, and database.

## 📋 Prerequisites

Before deploying, make sure you have:

1. **GitHub Repository** - Your code pushed to GitHub
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **API Keys** - Get the following:
   - Google Gemini AI API key
   - Stripe keys (secret, publishable, webhook secret)
   - GitHub OAuth App (client ID and secret)

## 🔧 Pre-Deployment Setup

### 1. Create GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: `Cursor AI`
   - **Homepage URL**: `https://your-app-name.onrender.com`
   - **Authorization callback URL**: `https://cursor-ai-backend.onrender.com/api/auth/github/callback`
4. Save the Client ID and Client Secret

### 2. Setup Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your **Publishable Key** and **Secret Key**
3. Create webhook endpoint: `https://cursor-ai-backend.onrender.com/api/payments/webhook`
4. Save the **Webhook Secret**

### 3. Get Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Save it securely

## 🏗️ Deployment Steps

### Step 1: Fork/Clone the Repository

1. Fork this repository or clone it to your GitHub account
2. Make sure all files are committed and pushed

### Step 2: Deploy on Render

#### Option A: Using Render Blueprint (Recommended)

1. **Connect GitHub to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your GitHub account
   - Select your repository

2. **Configure Blueprint**
   - Render will detect the `render.yaml` file
   - Review the services it will create:
     - `cursor-ai-backend` (Node.js Web Service)
     - `cursor-ai-frontend` (Static Site)
     - `cursor-ai-db` (PostgreSQL Database)

3. **Deploy**
   - Click "Apply"
   - Render will start creating all services

#### Option B: Manual Deployment

If blueprint doesn't work, deploy manually:

1. **Create Database**
   - New → PostgreSQL
   - Name: `cursor-ai-db`
   - Plan: Free
   - Save connection details

2. **Deploy Backend**
   - New → Web Service
   - Connect your GitHub repo
   - Name: `cursor-ai-backend`
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`

3. **Deploy Frontend**
   - New → Static Site
   - Connect your GitHub repo
   - Name: `cursor-ai-frontend`
   - Build Command: `echo "No build needed"`
   - Publish Directory: `frontend`

### Step 3: Configure Environment Variables

In your backend service (`cursor-ai-backend`), add these environment variables:

```bash
# Database
MONGODB_URI=<your-mongodb-connection-string>

# Authentication
JWT_SECRET=<generate-a-secure-random-string>

# AI
GEMINI_API_KEY=<your-gemini-api-key>

# Payments
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>

# GitHub OAuth
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>

# URLs
FRONTEND_URL=https://cursor-ai-frontend.onrender.com
NODE_ENV=production
PORT=10000
```

### Step 4: Update URLs

1. **Update Backend URLs in Frontend**
   - The deployment script automatically updates API URLs
   - Verify in your deployed frontend that it points to your backend

2. **Update GitHub OAuth Callback**
   - Go to your GitHub OAuth App settings
   - Update callback URL to: `https://cursor-ai-backend.onrender.com/api/auth/github/callback`

3. **Update Stripe Webhook**
   - Go to Stripe webhook settings
   - Update endpoint URL to: `https://cursor-ai-backend.onrender.com/api/payments/webhook`

## 📊 MongoDB Setup

### Option 1: MongoDB Atlas (Recommended)

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster
3. Create a database user
4. Get connection string
5. Add to `MONGODB_URI` environment variable

### Option 2: Use Render's Built-in Database

The `render.yaml` creates a PostgreSQL database. To use MongoDB instead:

1. Go to Render Dashboard
2. Create new MongoDB service (if available) or use external MongoDB

## 🔧 Post-Deployment Configuration

### 1. Test the Application

1. Visit your frontend URL: `https://cursor-ai-frontend.onrender.com`
2. Try registering a new account
3. Test GitHub OAuth login
4. Create a test project

### 2. Setup Monitoring

1. Check logs in Render Dashboard
2. Monitor performance and errors
3. Set up alerts for downtime

### 3. Custom Domain (Optional)

1. In Render Dashboard, go to your frontend service
2. Add custom domain in Settings
3. Update DNS records as instructed

## 🛠️ Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `FRONTEND_URL` environment variable is correct
   - Check that backend allows your frontend domain

2. **Database Connection Issues**
   - Verify `MONGODB_URI` is correct
   - Check database user permissions
   - Ensure IP whitelist includes Render's IPs

3. **Build Failures**
   - Check build logs in Render Dashboard
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

4. **GitHub OAuth Issues**
   - Double-check callback URL
   - Verify client ID and secret
   - Check OAuth app permissions

### Health Checks

Your backend includes a health check endpoint at `/api/health`. Render will use this to monitor your service.

## 📈 Scaling and Optimization

### Performance Optimization

1. **Enable Compression**: Already included in backend
2. **Use CDN**: Render provides CDN for static sites
3. **Database Indexing**: Add indexes for frequently queried fields
4. **Caching**: Implement Redis caching for better performance

### Scaling Options

1. **Upgrade Plans**: Move from free to paid plans for better performance
2. **Horizontal Scaling**: Add more instances
3. **Database Scaling**: Upgrade database plan

## 💰 Cost Estimation

### Free Tier Limits
- **Web Services**: 750 hours/month
- **Static Sites**: Unlimited
- **Database**: 90 days free, then $7/month

### Recommended Production Setup
- **Backend**: Starter plan ($7/month)
- **Frontend**: Free
- **Database**: Standard plan ($7/month)
- **Total**: ~$14/month

## 🔐 Security Considerations

1. **Environment Variables**: Never commit secrets to Git
2. **HTTPS**: Render provides free SSL certificates
3. **Rate Limiting**: Already implemented in backend
4. **Authentication**: JWT tokens with secure secrets
5. **Input Validation**: Implemented with express-validator

## 📝 Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Secret for JWT tokens | Yes | `your-super-secret-jwt-key` |
| `GEMINI_API_KEY` | Google Gemini AI API key | Yes | `AIza...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | Yes | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Yes | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Yes | `whsec_...` |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | Yes | `abc123...` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | Yes | `def456...` |
| `FRONTEND_URL` | Frontend URL | Yes | `https://cursor-ai-frontend.onrender.com` |
| `NODE_ENV` | Environment | Yes | `production` |
| `PORT` | Server port | Yes | `10000` |

## 🎉 Deployment Complete!

Your Cursor AI platform should now be live at:
- **Frontend**: `https://cursor-ai-frontend.onrender.com`
- **Backend API**: `https://cursor-ai-backend.onrender.com`

## 📞 Support

If you encounter issues:
1. Check Render logs
2. Review this guide
3. Check GitHub repository issues
4. Contact Render support

---

**Happy Coding with Cursor AI! 🚀**