# Railway Deployment Guide

This guide will help you deploy the NFL/CFB Dashboard to Railway for instant deployments and production hosting.

## Prerequisites

- Railway account (sign up at https://railway.app)
- GitHub repository connected to Railway
- This codebase pushed to GitHub

## Deployment Steps

### 1. Deploy the Backend

1. **Create a new project** in Railway
2. **Add a service** → Deploy from GitHub repo
3. **Select this repository**
4. Railway will auto-detect FastAPI and deploy
5. **Configure environment variables** (if needed):
   - No environment variables required for basic setup
   - Railway will automatically set `PORT`

6. **Get the backend URL**:
   - After deployment, Railway will give you a URL like: `https://your-backend-name.up.railway.app`
   - Copy this URL for the next step

### 2. Deploy the Frontend

1. **In the same Railway project**, click "New Service"
2. **Deploy from GitHub repo** (same repo)
3. **Set the root directory**:
   - Go to Settings → Root Directory
   - Set to: `football_dash_frontend`

4. **Configure environment variables**:
   - Go to Variables tab
   - Add: `VITE_API_URL` = `https://your-backend-name.up.railway.app` (from step 1.6)

5. **Configure build settings**:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run preview -- --host 0.0.0.0 --port $PORT`

6. **Deploy**:
   - Railway will build and deploy automatically
   - Your frontend will be available at: `https://your-frontend-name.up.railway.app`

### 3. Configure CORS (Important!)

The backend needs to allow requests from your Railway frontend domain.

1. In your backend code, update CORS settings in `app/main.py`
2. Add your Railway frontend URL to allowed origins
3. Push to GitHub - Railway will auto-redeploy

Example CORS configuration:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Local dev
        "https://your-frontend-name.up.railway.app",  # Railway frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Environment Variables Reference

### Backend
- `PORT` - Automatically set by Railway (usually 8000)
- No other environment variables needed

### Frontend
- `VITE_API_URL` - URL of your Railway backend (required)
  - Example: `https://your-backend-name.up.railway.app`

## Deployment Workflow

After initial setup, deployments are automatic:

1. **Push to GitHub** - Railway watches your repo
2. **Automatic build** - Railway detects changes and rebuilds
3. **Zero-downtime deploy** - New version goes live automatically

## Monitoring

Railway provides:
- **Build logs** - See what's happening during build
- **Runtime logs** - Live application logs
- **Metrics** - CPU, memory, network usage
- **Deploys** - History of all deployments

## Troubleshooting

### Frontend can't reach backend
- Check `VITE_API_URL` is set correctly
- Check CORS settings in backend
- Check browser console for errors

### Build fails
- Check build logs in Railway dashboard
- Ensure all dependencies are in package.json/requirements.txt
- Try building locally first: `npm run build`

### App crashes on startup
- Check runtime logs
- Ensure start command is correct
- Check PORT environment variable is being used

## Cost

Railway offers:
- **Free tier**: $5 credit/month, sleeps after inactivity
- **Developer plan**: $5/month per user, no sleep
- **Team plan**: $20/month per user

For production use, Developer plan is recommended to avoid sleep.

## Switching Between Railway and Pi

You can easily switch between Railway (production) and Pi (local):

### To use Railway:
- Set `VITE_API_URL` in frontend to Railway backend URL
- Deploy both services to Railway

### To use Pi:
- Leave `VITE_API_URL` empty or unset
- Deploy frontend to Pi (same-origin setup)
- Backend runs on Pi at localhost:8000

## Support

For Railway-specific issues:
- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app
- Railway status: https://railway.app/status
