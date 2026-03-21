# Authenticator (TOTP) two-factor authentication

This app uses **email/password** plus **time-based one-time codes** from an authenticator app (Google Authenticator, Authy, 1Password, etc.) via [Firebase TOTP MFA](https://firebase.google.com/docs/auth/web/totp-mfa) (requires **Firebase Authentication with Identity Platform**).

SMS / phone codes are **not** used in the client.

## Enable TOTP in your Firebase / Google Cloud project

TOTP must be turned on at the **project** level (not only in the Firebase Console UI).

### Option A — Script in this repo (recommended)

1. Create a **service account** key: Firebase Console → **Project settings** → **Service accounts** → **Generate new private key** (do **not** commit the file).
2. From the repo root:

   ```bash
   node scripts/enable-firebase-totp-mfa.mjs --dry-run /path/to/serviceAccount.json
   node scripts/enable-firebase-totp-mfa.mjs /path/to/serviceAccount.json
   ```

   Or: `npm run firebase:enable-totp -- /path/to/serviceAccount.json`

Full notes: **`scripts/README-enable-firebase-totp-mfa.md`**.

### Option B — Firebase Admin in your own code (SDK ≥ 11.6)

```js
import { getAuth } from 'firebase-admin/auth'

await getAuth().projectConfigManager().updateProjectConfig({
  multiFactorConfig: {
    providerConfigs: [
      {
        state: 'ENABLED',
        totpProviderConfig: {
          adjacentIntervals: 5 // 0–10; default 5 for clock drift
        }
      }
    ]
  }
})
```

### Option C — Identity Toolkit REST API

See [Firebase docs — Enable TOTP MFA](https://firebase.google.com/docs/auth/web/totp-mfa#enable-totp-mfa) for the `PATCH .../config?updateMask=mfa` example.

Until TOTP is enabled, enrollment may fail with an error about the operation not being allowed.

## User flow

1. **Accounts** — New users are **not** created in the app. An admin creates users in **Firebase Console** (Authentication) or via the Admin SDK; the login page is **sign-in only** (email + password).
2. **Sign in** — Email + password → **6-digit authenticator code** → access app. First-time users verify email (if required) and **set up authenticator** (QR + manual key) after an admin has created their account.
3. **Password managers (Safari / Apple Passwords, Chrome, Edge, etc.)** — TOTP fields use `autocomplete` with a **section-prefixed** `username` + `one-time-code` pair in the same `<form method="post" action="#">`, plus `name="totp"` on the code input. That pattern matches what Chromium-oriented managers expect as well as Safari. You still need to **save the authenticator secret** for this site in your manager (e.g. Google Password Manager’s verification code for the login); the app only exposes standard HTML hints.
4. **Protected routes** — Require verified email **and** an enrolled TOTP factor. Users without TOTP are redirected to `/log-in` to enroll.
5. **Publish / schedule / cancel schedule** — **Always** (every time) requires **password** then **authenticator (TOTP) code** in `PasswordReauthModal` before writing to Firestore, creating a server schedule, or removing a scheduled job.
6. **Owner-only publish** — Only one email (default `wingatejack2021@gmail.com`, override with `VITE_MASTER_PUBLISH_EMAIL`) can **Publish now**, **Save schedule**, or **Cancel schedule** on the Stations pending-review panel. Others can still build pending edits locally. This is enforced in the app UI and callbacks; for stronger guarantees, tighten **Firestore / Cloud Functions** rules separately.

## Environment variables

| Variable | Effect |
|----------|--------|
| `VITE_MASTER_PUBLISH_EMAIL` | Email allowed to publish/schedule (default `wingatejack2021@gmail.com`). |
| `VITE_LOCAL_AUTH_EMAIL` / `VITE_LOCAL_AUTH_PASSWORD` | **Dev only** — optional auto sign-in from `.env.local` (never commit). |
| `VITE_REQUIRE_REAUTH_FOR_SENSITIVE_ACTIONS` | Reserved for other flows; **does not** disable publish/schedule step-up (always on). |
| `VITE_REQUIRE_SMS_FOR_SENSITIVE_ACTIONS` | Legacy alias of the above. |

## Firestore access control

Server-side enforcement lives in **`firestore.rules`** (not the React app). See **`docs/SECURITY_FIRESTORE.md`** for deploying rules and the `rs_station_editor` custom claim.

## Code layout

- `src/services/firebaseTotpMfa.ts` — TOTP helpers and error mapping.
- `src/pages/LoginPage.tsx` — Sign-in, email verification, TOTP enrollment & sign-in MFA step.
- `src/components/ProtectedRoute.tsx` — Requires verified email + TOTP enrolled.
- `src/components/PasswordReauthModal.tsx` — Password then TOTP for sensitive actions.
- `src/utils/sensitiveActionPolicy.ts` — Legacy env helper (publish/schedule always step-up in `StationsPage`).

## App Check (optional)

If **App Check** enforces **Authentication**, configure `VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY` correctly or use Monitoring mode — see `.env.example`.

## Privacy

Authenticator apps run on the user’s device; no SMS charges. Update your privacy policy as needed.
