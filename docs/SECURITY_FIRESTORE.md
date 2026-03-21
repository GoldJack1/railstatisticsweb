# Firestore security (rules + editor access)

Firestore **reads are public** (no sign-in): anyone with your Firebase project config can read all documents your rules expose. **Writes** stay restricted: only **station editors** can change station data or create/delete scheduled publish jobs (see below).

> **Privacy note:** `scheduledStationPublishJobs` documents include pending station payloads. Public read means anyone who obtains a job document ID could read that payload. If that’s unacceptable, change `allow read` for that collection in `firestore.rules`.

## What gets deployed to Firebase (from this repo)

Nothing is pushed automatically when you commit to Git. You run **`firebase deploy`** (or subsets) from your machine or CI.

| What you run | What is uploaded / updated |
|--------------|----------------------------|
| **`npm run firebase:deploy`** | **Firestore security rules only** — the contents of `firestore.rules`. |
| `firebase deploy --only firestore:indexes` | Composite indexes from `firestore.indexes.json`. |
| `firebase deploy --only functions` | Cloud Functions after `functions/` build (e.g. scheduled station publish processor). |
| `firebase deploy --only hosting` | Static site from `dist` per `firebase.json` (this project often uses **Netlify** for the web app instead). |
| `firebase deploy` (no `--only`) | **Everything** in `firebase.json`: Firestore rules, indexes, functions, and hosting. |

Scripts in `package.json` only wrap **rules** today (`firebase:deploy` → `firestore:rules`). Indexes and functions need explicit `firebase deploy --only …` commands (or extend `package.json` if you want shortcuts).

## What the rules do

| Collection | Read | Write |
|------------|------|--------|
| `stations2603`, `newsandboxstations1` | **Anyone** (including signed-out clients) | **Station editors only** |
| `scheduledStationPublishJobs` | **Anyone** | Create (validated) + delete own jobs (editors only); **no client updates** (Cloud Function uses Admin SDK) |
| **Any other path** (`/{document=**}`) | **Anyone** | **Denied** (add an explicit `match` if a collection needs client writes) |

Anonymous users **can read**; they **cannot** write station data or queue jobs without being a station editor.

## Who counts as a “station editor”?

Either:

1. **Custom claim** `rs_station_editor == true` on the Firebase Auth user (recommended for non-default accounts), or  
2. **Email** on the ID token equals the default owner in `firestore.rules` (`defaultOwnerEmail()` — keep in sync with `DEFAULT_MASTER_PUBLISH_EMAIL` in `src/utils/masterPublishPolicy.ts` if you change the default).

`VITE_MASTER_PUBLISH_EMAIL` only affects the **web UI**. It does **not** change Firestore rules. If you point the UI at a different owner email, set the claim for that user **or** deploy updated rules with the new default email.

## One-time setup after pulling these rules

1. **Deploy rules** (from repo root):

   ```bash
   npm run firebase:deploy
   # or: firebase deploy --only firestore:rules
   ```

2. **Optional — custom claim** (for accounts that are not the hardcoded default email, or extra admins):

   ```bash
   npm run firebase:set-station-editor-claim -- --email=you@example.com /path/to/serviceAccount.json
   ```

   Revoke:

   ```bash
   npm run firebase:set-station-editor-claim -- --email=you@example.com --revoke /path/to/serviceAccount.json
   ```

3. After setting or changing claims, the user must **sign out and sign in** (or wait for token refresh) so the new JWT includes the claim.

## App Check (optional)

If you **enforce** App Check on Firestore in the Firebase Console, clients may need a valid App Check token even for reads. With **public** rules, combine with Monitoring/enforcement policy you’re comfortable with. Set `VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY` on Netlify for production web builds.

## Related files

- `firestore.rules` — source of truth for server-side access control  
- `firebase.json` — what Firebase CLI deploys (rules path, indexes, functions, hosting)  
- `scripts/set-rs-station-editor-claim.mjs` — sets `rs_station_editor`  
- `src/utils/masterPublishPolicy.ts` — client-side publish UI gating (not a security boundary for reads)

## App routes vs Firestore

The React app **requires login** for `/stations` and related editor routes (`ProtectedRoute`). **`/` and `/migration` are public** (CSV migration tool). That gating is **UI only**. Firestore itself allows **anonymous reads** with the current rules.
