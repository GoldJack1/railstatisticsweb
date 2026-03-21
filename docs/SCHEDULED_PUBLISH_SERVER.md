# Server-side scheduled station publishes

Pending station edits can be **queued in Firestore** and applied by a **scheduled Cloud Function** (`processScheduledStationPublishJobs`), so publishing does **not** require the website tab to stay open.

## What gets deployed

1. **Firestore index** — composite on `scheduledStationPublishJobs`: `status` + `runAt` (see `firestore.indexes.json`).
2. **Cloud Function** — `functions/src/index.ts` exports `processScheduledStationPublishJobs` (runs every minute, UTC).

## One-time setup

1. Install function dependencies (from repo root):

   ```bash
   cd functions && npm install && npm run build
   ```

2. Deploy indexes (required before the function query works):

   ```bash
   firebase deploy --only firestore:indexes
   ```

   Wait until indexes show as **enabled** in the Firebase console.

3. Deploy functions:

   ```bash
   firebase deploy --only functions
   ```

   Ensure the **Cloud Scheduler** API is enabled for your GCP project (Firebase usually prompts during first deploy).

## How it works

- The app writes a document to **`scheduledStationPublishJobs`** with:
  - `runAt` — when to publish (Firestore `Timestamp`)
  - `collectionId` — `stations2603` or `newsandboxstations1`
  - `changes` — snapshot of pending edits (same shape the web app uses for publish)
  - `stationIds` — list of station document IDs in that snapshot
  - `status` — `pending` → `processing` → `completed` or `failed`
- The function queries `status == pending` and `runAt <= now`, claims each job in a transaction, applies writes with the **Admin SDK** (same field mapping as `src/services/firebase.ts`), then updates the job document.

## Security notes

- **`firestore.rules`** restrict who can read/write station collections and who can create/delete **`scheduledStationPublishJobs`** (station editors + validated payloads). Deploy rules with `npm run firebase:deploy`. See **`docs/SECURITY_FIRESTORE.md`**.
- The function runs with **admin** privileges; it does not use end-user rules.

## Local dev

Sign in on the normal login page, or set **`VITE_LOCAL_AUTH_EMAIL`** and **`VITE_LOCAL_AUTH_PASSWORD`** in **`.env.local`** (never commit) so the app auto signs in with Firebase **Email/Password** on load. **Email/Password** must be enabled in Firebase Console → Authentication → Sign-in method.

## Troubleshooting

- **Nothing publishes**: Confirm the function is deployed, indexes are built, and job documents show `status: pending` with `runAt` in the past.
- **Permission errors on write**: User must be signed in, pass the owner UI check, and satisfy **Firestore rules** (default owner email or `rs_station_editor` claim — see `docs/SECURITY_FIRESTORE.md`).
- **Function timeout**: Large batches use sequential writes; increase `timeoutSeconds` in `functions/src/index.ts` if needed.
