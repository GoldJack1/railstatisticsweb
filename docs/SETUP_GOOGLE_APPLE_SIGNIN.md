# Setting up Google and Apple sign-in

This guide walks you through enabling **Sign in with Google** and **Sign in with Apple** for the Rail Statistics app. Both are configured in Firebase Console and (for Apple) in the Apple Developer portal.

---

## Part 1: Sign in with Google

### 1.1 Create or get a Google OAuth client (Web)

1. Open **[Google Cloud Console](https://console.cloud.google.com)** and select the same project that your Firebase project uses (or the project linked to your Firebase app).
2. Go to **APIs & Services** → **Credentials**.
3. Under **OAuth 2.0 Client IDs**:
   - If you already see a “Web client” for this project, note its **Client ID** and **Client secret** (click the name to see the secret). Skip to step 1.2.
   - If not, click **+ Create Credentials** → **OAuth client ID**.
4. Create the OAuth client:
   - **Application type**: Web application.
   - **Name**: e.g. `Rail Statistics Web`.
   - **Authorized JavaScript origins** (add all you need for production and local):
     - `http://localhost:3000` (this project’s Vite dev server – **required for local login**)
     - `https://railstatistics.co.uk`
     - `https://www.railstatistics.co.uk`
     - Your Netlify preview URL if you use it (e.g. `https://something.netlify.app`).
   - **Authorized redirect URIs**: You can leave this empty for the Firebase popup flow; Firebase uses its own domain. If you ever need redirect-based flow, add:
     - `https://YOUR_FIREBASE_PROJECT_ID.firebaseapp.com/__/auth/handler`
5. Click **Create**. Copy the **Client ID** and **Client secret** (you’ll paste them into Firebase in the next section).

### 1.2 Enable Google in Firebase

1. Open **[Firebase Console](https://console.firebase.google.com)** and select your project.
2. Go to **Build** → **Authentication** → **Sign-in method**.
3. Click **Google** in the list of providers.
4. Turn **Enable** on.
5. Set **Project support email** to your email.
6. Under **Web SDK configuration**:
   - **Web client ID**: paste the **Client ID** from step 1.1.
   - **Web client secret**: paste the **Client secret** from step 1.1.
7. Click **Save**.

You’re done for Google. Users can now use “Continue with Google” on the `/log-in` page.

---

## Part 2: Sign in with Apple

Sign in with Apple requires an **Apple Developer Program** membership and setup in both the Apple Developer portal and Firebase.

### 2.1 Create an App ID and Services ID (Apple Developer)

1. Go to **[Apple Developer](https://developer.apple.com/account)** → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. **App ID** (if you don’t already have one for the web app):
   - Click **+** → **App IDs** → **App**.
   - Description: e.g. `Rail Statistics`.
   - Bundle ID: explicit, e.g. `uk.co.railstatistics.web`.
   - Enable **Sign in with Apple** (capability).
   - Register.

3. **Services ID** (this is the “client ID” Firebase calls “Service ID”):
   - In **Identifiers**, click **+** → **Services IDs** → Continue.
   - **Description**: e.g. `Rail Statistics Web`.
   - **Identifier**: e.g. `uk.co.railstatistics.web.signin` (must be unique).
   - Check **Sign in with Apple** and click **Configure** next to it.
   - **Primary App ID**: select the App ID you created above.
   - **Domains and Subdomains**: add:
     - `railstatistics.co.uk`
     - `www.railstatistics.co.uk`
     - For local testing you can add `localhost` (Apple may allow it for development).
   - **Return URLs**: add exactly:
     - `https://YOUR_FIREBASE_PROJECT_ID.firebaseapp.com/__/auth/handler`
     - Replace `YOUR_FIREBASE_PROJECT_ID` with your actual Firebase project ID (e.g. from Firebase Console → Project settings).
   - Save, then **Continue** → **Register**.
   - Write down the **Services ID** (e.g. `uk.co.railstatistics.web.signin`) — you’ll need it in Firebase.

### 2.2 Create a Sign in with Apple key (private key)

1. In Apple Developer, go to **Certificates, Identifiers & Profiles** → **Keys**.
2. Click **+** to create a new key.
3. **Key Name**: e.g. `Rail Statistics Sign in with Apple`.
4. Enable **Sign in with Apple** and click **Configure** → select your **Primary App ID** (the one that has Sign in with Apple) → Save.
5. **Continue** → **Register**.
6. **Download the key** (`.p8` file) once — you can’t download it again. Keep it secure.
7. Note the **Key ID** shown on the page (e.g. `ABC123XYZ`).
8. Note your **Team ID** (top right of the Apple Developer page or in Membership details) and your **Services ID** from step 2.1.

### 2.3 Enable Apple in Firebase

1. In **[Firebase Console](https://console.firebase.google.com)** → **Authentication** → **Sign-in method**.
2. Click **Apple** → turn **Enable** on.
3. Fill in:
   - **Services ID**: the Services ID from step 2.1 (e.g. `uk.co.railstatistics.web.signin`).
   - **Apple Team ID**: your 10-character Team ID.
   - **Key ID**: the Key ID from step 2.2.
   - **Private Key**: open the `.p8` file in a text editor and paste the entire contents (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`).
4. Click **Save**.

You’re done for Apple. Users can now use “Continue with Apple” on the `/log-in` page.

### 2.4 Show “Rail Statistics” (or your domain) instead of rail-statistics.firebaseapp.com

By default, sign-in shows **“Continue to: rail-statistics.firebaseapp.com”**. To show your own domain (e.g. **railstatistics.co.uk** or **auth.railstatistics.co.uk**) and a friendlier name:

**A. Use a custom auth domain (recommended)**

1. **Firebase Hosting – add custom domain**
   - [Firebase Console](https://console.firebase.google.com) → your project → **Build** → **Hosting**.
   - Click **Add custom domain**. Use a subdomain like **auth.railstatistics.co.uk** (or your main domain if you’re not using it for the main site).
   - Follow the steps to verify ownership (DNS: add the A/CNAME and optional TXT records Firebase shows). Wait until the domain is verified and the SSL certificate is active.

2. **Auth – allow the custom domain**
   - **Authentication** → **Settings** (or the Auth tab) → **Authorized domains**.
   - Click **Add domain** and add your custom domain, e.g. `auth.railstatistics.co.uk` → Save.

3. **App – use the custom auth domain**
   - In Netlify (and `.env.local` for local), set:
     - **Key:** `VITE_FIREBASE_AUTH_DOMAIN`
     - **Value:** your custom domain only, e.g. `auth.railstatistics.co.uk` (no `https://`).
   - Redeploy. The app already reads `authDomain` from this env var, so sign-in will redirect via your domain and users will see e.g. “Continue to: auth.railstatistics.co.uk”.

4. **Google – add redirect URI**
   - [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials** → your OAuth Web client.
   - Under **Authorized redirect URIs**, add:  
     `https://auth.railstatistics.co.uk/__/auth/handler`  
     (use your actual custom domain). Save.

5. **Apple – update Return URL**
   - [Apple Developer](https://developer.apple.com/account) → **Identifiers** → your **Services ID** → **Configure** (Sign in with Apple).
   - In **Return URLs**, add:  
     `https://auth.railstatistics.co.uk/__/auth/handler`  
     (you can keep the firebaseapp.com one for backwards compatibility or replace it). Save.
   - If Apple asks for domain verification, serve the file they give you at  
     `https://auth.railstatistics.co.uk/.well-known/apple-developer-domain-association.txt`  
     (Firebase Hosting or your host).

After this, sign-in will show your domain instead of `rail-statistics.firebaseapp.com`.

**B. App name on the Google sign-in screen**

- In [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **OAuth consent screen**, set **App name** to **Rail Statistics** (and upload a logo if you want). That name appears on the Google account picker; the “Continue to: [domain]” line is controlled by the custom domain above.

---

## Local development (login on localhost)

For **Sign in with Google** and **Sign in with Apple** to work when testing at `http://localhost:3000`, do the following.

### 1. Firebase: allow localhost

1. **[Firebase Console](https://console.firebase.google.com)** → your project → **Build** → **Authentication**.
2. Open the **Settings** tab (or **Authorized domains** in the main Auth screen).
3. Under **Authorized domains**, ensure **localhost** is listed. If it’s missing, click **Add domain** and add `localhost`, then save.

Without this, Firebase will reject the redirect back to your app after sign-in on localhost.

### 2. Google: allow localhost origin

1. **[Google Cloud Console](https://console.cloud.google.com)** → **APIs & Services** → **Credentials**.
2. Open your **OAuth 2.0 Web client** used for this app.
3. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
4. Save.

Use the same port as your dev server (this project uses **3000** in `vite.config.js`).

### 3. Apple: optional localhost

1. In **Apple Developer** → **Identifiers** → your **Services ID** → **Configure** (Sign in with Apple).
2. Under **Domains and Subdomains**, you can try adding **localhost**. Some accounts allow it for development; if it’s rejected, test Google on localhost and Apple on your deployed site.

After these steps, run `npm run dev`, open `http://localhost:3000/log-in`, and use “Continue with Google” (and Apple if you added localhost).

---

## Quick checklist

**Google**

- [ ] OAuth 2.0 Web client created in Google Cloud Console (Client ID + Client secret).
- [ ] Authorized JavaScript origins include your site and `http://localhost:3000` for local login.
- [ ] Google provider enabled in Firebase with that Web client ID and secret.

**Apple**

- [ ] App ID with Sign in with Apple capability.
- [ ] Services ID with Return URL `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`.
- [ ] Sign in with Apple key (.p8) created and downloaded.
- [ ] Apple provider enabled in Firebase with Services ID, Team ID, Key ID, and private key.

---

## Troubleshooting

- **Google: “redirect_uri_mismatch” or popup fails**  
  Ensure your site’s origin (e.g. `https://railstatistics.co.uk`) is in **Authorized JavaScript origins** for the OAuth client in Google Cloud Console.

- **Apple: “invalid_request” or “redirect_uri mismatch”**  
  The Return URL in the Services ID must be exactly `https://YOUR_FIREBASE_PROJECT_ID.firebaseapp.com/__/auth/handler` (no trailing slash, correct project ID). Also confirm the domain of your website is listed under the Services ID configuration.

- **Apple: “Invalid client”**  
  Double-check Services ID, Team ID, Key ID, and that the pasted private key is complete and has no extra line breaks or spaces.

- **Login doesn’t work on localhost**  
  See [Local development (login on localhost)](#local-development-login-on-localhost) above: add **localhost** to Firebase Authorized domains and `http://localhost:3000` to Google Authorized JavaScript origins.

- **Popup blocked**  
  The app uses redirect (not popup) for Google/Apple, so this should be rare. If you see it, allow redirects for your site.

If you hit a specific error message, you can search for it in [Firebase Auth docs](https://firebase.google.com/docs/auth) or [Apple Sign in with Apple docs](https://developer.apple.com/sign-in-with-apple/).
