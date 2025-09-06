# Netlify Environment Variables Setup

## Required Environment Variables

Copy and paste these environment variables into your Netlify site settings:

### Variable 1: VITE_FIREBASE_API_KEY
```
AIzaSyD0-OjpeptPX5zG1x0411nkP0cdQq5oWXc
```

### Variable 2: VITE_FIREBASE_AUTH_DOMAIN
```
rail-statistics.firebaseapp.com
```

### Variable 3: VITE_FIREBASE_DATABASE_URL
```
https://rail-statistics-default-rtdb.europe-west1.firebasedatabase.app
```

### Variable 4: VITE_FIREBASE_PROJECT_ID
```
rail-statistics
```

### Variable 5: VITE_FIREBASE_STORAGE_BUCKET
```
rail-statistics.firebasestorage.app
```

### Variable 6: VITE_FIREBASE_MESSAGING_SENDER_ID
```
998967146702
```

### Variable 7: VITE_FIREBASE_APP_ID
```
1:998967146702:web:3183d4e5621ddfff2ff89f
```

### Variable 8: VITE_FIREBASE_MEASUREMENT_ID
```
G-GNL8ZVEW1E
```

## How to Add These in Netlify:

1. Go to your Netlify dashboard
2. Click on your site (railstatisticsweb)
3. Go to **Site settings** > **Environment variables**
4. Click **Add variable**
5. For each variable above:
   - **Key**: Use the variable name (e.g., `VITE_FIREBASE_API_KEY`)
   - **Value**: Use the corresponding value
   - Click **Save**

## After Adding All Variables:

1. Go to **Deploys** tab
2. Click **Trigger deploy** > **Deploy site**
3. The build should now succeed!

## Alternative: Use Netlify CLI

If you have Netlify CLI installed, you can also set these via command line:

```bash
netlify env:set VITE_FIREBASE_API_KEY "AIzaSyD0-OjpeptPX5zG1x0411nkP0cdQq5oWXc"
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "rail-statistics.firebaseapp.com"
netlify env:set VITE_FIREBASE_DATABASE_URL "https://rail-statistics-default-rtdb.europe-west1.firebasedatabase.app"
netlify env:set VITE_FIREBASE_PROJECT_ID "rail-statistics"
netlify env:set VITE_FIREBASE_STORAGE_BUCKET "rail-statistics.firebasestorage.app"
netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "998967146702"
netlify env:set VITE_FIREBASE_APP_ID "1:998967146702:web:3183d4e5621ddfff2ff89f"
netlify env:set VITE_FIREBASE_MEASUREMENT_ID "G-GNL8ZVEW1E"
```
