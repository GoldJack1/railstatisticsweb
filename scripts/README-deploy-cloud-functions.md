# Deploy Cloud Functions only

Uploads the built `functions/` bundle to Firebase. This does **not** deploy Firestore rules, indexes, or hosting.

## Prerequisites

1. [Firebase CLI](https://firebase.google.com/docs/cli) installed and logged in:
   ```bash
   firebase login
   ```
2. Active project selected (from repo root):
   ```bash
   firebase use <your-project-id>
   ```

## Deploy

From the repo root:

```bash
npm run firebase:deploy-functions
```

Or run the script directly:

```bash
bash scripts/deploy-cloud-functions.sh
```

## What gets updated

- `processScheduledStationPublishJobs` (scheduled station publish)
- `onNewStationAdded` (new-station push notifications for `stations_gbnr`)

## What does NOT get updated

Deploy Firestore rules separately when collection rules change:

```bash
npm run firebase:deploy
```

Deploy indexes when needed:

```bash
firebase deploy --only firestore:indexes
```

The web app is deployed via Netlify (git push), not this script.
