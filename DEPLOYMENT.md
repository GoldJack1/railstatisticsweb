# Deployment Guide for Rail Statistics Migration Tool

This guide will help you deploy the Rail Statistics Migration Tool to Netlify.

## Prerequisites

- A GitHub account
- A Netlify account (free tier available)
- A Firebase project with station data

## Step 1: Prepare Your Repository

1. **Fork or clone the repository:**
   ```bash
   git clone https://github.com/GoldJack1/railstatisticsweb.git
   cd railstatisticsweb
   ```

2. **Set up Firebase configuration:**
   - Copy `firebase-config.template.js` to `firebase-config.js`
   - Replace the placeholder values with your actual Firebase config
   - The `firebase-config.js` file is already in `.gitignore` for security

## Step 2: Deploy to Netlify

### Option A: Deploy via Netlify UI (Recommended)

1. **Go to Netlify:**
   - Visit [netlify.com](https://netlify.com)
   - Sign in with your GitHub account

2. **Create a new site:**
   - Click "New site from Git"
   - Choose "GitHub" as your Git provider
   - Select your repository (`railstatisticsweb`)

3. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `.` (root directory)
   - Click "Deploy site"

4. **Set up environment variables (for Firebase):**
   - Go to Site settings > Environment variables
   - Add the following variables with your actual Firebase values:
     ```
     VITE_FIREBASE_API_KEY=your_actual_api_key_here
     VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
     VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.region.firebasedatabase.app
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
     ```
   - **Important**: Replace the placeholder values with your actual Firebase configuration values

5. **Redeploy:**
   - Go to Deploys tab
   - Click "Trigger deploy" > "Deploy site"

### Option B: Deploy via Netlify CLI

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify:**
   ```bash
   netlify login
   ```

3. **Initialize and deploy:**
   ```bash
   netlify init
   netlify deploy --prod
   ```

## Step 3: Configure Custom Domain (Optional)

1. **Add custom domain:**
   - Go to Site settings > Domain management
   - Click "Add custom domain"
   - Enter your domain name
   - Follow the DNS configuration instructions

2. **Enable HTTPS:**
   - Netlify automatically provides SSL certificates
   - HTTPS is enabled by default

## Step 4: Set Up Firebase Security Rules

Make sure your Firestore security rules allow read access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /stations/{document} {
      allow read: if true; // Allow public read access for migration tool
    }
  }
}
```

## Step 5: Test Your Deployment

1. **Visit your deployed site:**
   - Your site will be available at `https://your-site-name.netlify.app`
   - Or your custom domain if configured

2. **Test the migration tool:**
   - Upload a test CSV file
   - Verify Firebase connection works
   - Test the matching and export functionality

## Troubleshooting

### Common Issues

**Firebase connection fails:**
- Check that environment variables are set correctly
- Verify Firebase security rules allow read access
- Check browser console for error messages

**Build fails:**
- Ensure build command is set to `echo 'No build step required'`
- Check that publish directory is set to `.`

**Site not loading:**
- Verify all files are in the root directory
- Check that `index.html` exists and is accessible
- Review Netlify deploy logs for errors

### Getting Help

- Check the [Netlify documentation](https://docs.netlify.com/)
- Review the [Firebase documentation](https://firebase.google.com/docs)
- Open an issue on the [GitHub repository](https://github.com/GoldJack1/railstatisticsweb/issues)

## Environment Variables Reference

For Netlify deployment, you can use these environment variables instead of the `firebase-config.js` file:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase API key | `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | Firebase database URL | `https://your-project-default-rtdb.region.firebasedatabase.app` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `your-project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `123456789012` |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | `1:123456789012:web:abcdef1234567890` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID | `G-XXXXXXXXXX` |

## Security Notes

- Never commit `firebase-config.js` to version control
- Use environment variables for production deployments
- Regularly rotate Firebase API keys
- Monitor Firebase usage and set up billing alerts
- Consider implementing rate limiting for production use
