# Swap two Firestore documents (0263 ↔ 0264)

This script reads documents **0263** and **0264** from the `stations2603` collection, deletes both, then re-creates them with data swapped (0263 gets 0264’s data, 0264 gets 0263’s data).

## 1. Service account key

- Firebase Console → Project settings → **Service accounts**
- Click **Generate new private key** and save the JSON file somewhere safe (e.g. `./service-account-key.json`).
- **Do not commit this file.** Add it to `.gitignore` if the path is inside the repo.

## 2. Set environment variables

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/your-service-account-key.json
export FIREBASE_PROJECT_ID=your-firebase-project-id
```

Or pass the project on the command line (see below).

## 3. Install dependency (once)

From the repo root:

```bash
npm install
```

(`firebase-admin` is in `devDependencies`.)

## 4. Run the script

From the repo root:

```bash
node scripts/swap-firestore-docs.js
```

With project ID on the command line:

```bash
node scripts/swap-firestore-docs.js --project=your-firebase-project-id
```

Optional overrides:

```bash
node scripts/swap-firestore-docs.js --collection=stations2603 --id1=0263 --id2=0264
```

## Summary

- Uses **Firebase Admin SDK** (not the Firebase CLI) so it can read/write Firestore.
- Requires a **service account key** and your **Firebase project ID**.
- Default collection: `stations2603`; default doc IDs: `0263`, `0264`.
