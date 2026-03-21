# Enable TOTP MFA (Firebase Admin script)

This repo includes **`enable-firebase-totp-mfa.mjs`**, which turns on **TOTP** (authenticator app codes) at the **project** level so the web app can enroll users.

## Before you run

1. Project uses **Firebase Authentication with Identity Platform** (not only legacy Auth-only).
2. Download a **service account** JSON:  
   **Firebase Console → Project settings (gear) → Service accounts → Generate new private key**
3. **Do not commit** the JSON file. Add it to `.gitignore` if you keep it in the repo folder (e.g. `serviceAccount.json`).

## Commands

From the project root:

```bash
# Inspect current MFA project config (no changes)
node scripts/enable-firebase-totp-mfa.mjs --dry-run /path/to/your-service-account.json

# Enable TOTP (merges with existing providerConfigs if any)
node scripts/enable-firebase-totp-mfa.mjs /path/to/your-service-account.json
```

Or with Application Default Credentials:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/your-service-account.json
node scripts/enable-firebase-totp-mfa.mjs
```

Optional:

```bash
export TOTP_ADJACENT_INTERVALS=5   # 0–10, default 5
```

## npm script

```bash
npm run firebase:enable-totp -- /path/to/your-service-account.json
npm run firebase:enable-totp -- --dry-run /path/to/your-service-account.json
```

(`--` passes arguments through to the script.)

## After this

Users can complete **Set up authenticator** on `/log-in` in the web app (QR + verification code).

If something fails with **permission denied**, ensure the service account’s project has **Identity Toolkit Admin** / appropriate Editor access on the GCP project linked to Firebase.
