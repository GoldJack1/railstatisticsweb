/**
 * Swap two Firestore documents: read 0263 and 0264, delete both, re-add with data swapped.
 * - New doc 0263 gets the data that was in 0264
 * - New doc 0264 gets the data that was in 0263
 *
 * Prerequisites:
 *   1. Firebase service account key (JSON). Download from Firebase Console
 *      → Project settings → Service accounts → Generate new private key.
 *   2. Set env before running:
 *      - GOOGLE_APPLICATION_CREDENTIALS=path/to/your-service-account-key.json
 *      - FIREBASE_PROJECT_ID=your-project-id   (or pass --project=your-project-id)
 *
 * Run from repo root:
 *   node scripts/swap-firestore-docs.js
 *   node scripts/swap-firestore-docs.js --project=my-project-id
 *
 * Optional: override collection or document IDs
 *   node scripts/swap-firestore-docs.js --collection=stations2603 --id1=0263 --id2=0264
 */

import admin from 'firebase-admin';

const COLLECTION = 'stations2603';
const ID1 = '0263';
const ID2 = '0264';

function parseArgs() {
  const args = process.argv.slice(2);
  let projectId = process.env.FIREBASE_PROJECT_ID;
  let collection = COLLECTION;
  let id1 = ID1;
  let id2 = ID2;
  for (const arg of args) {
    if (arg.startsWith('--project=')) projectId = arg.slice('--project='.length);
    else if (arg.startsWith('--collection=')) collection = arg.slice('--collection='.length);
    else if (arg.startsWith('--id1=')) id1 = arg.slice('--id1='.length);
    else if (arg.startsWith('--id2=')) id2 = arg.slice('--id2='.length);
  }
  return { projectId, collection, id1, id2 };
}

async function main() {
  const { projectId, collection, id1, id2 } = parseArgs();

  if (!projectId) {
    console.error('Set FIREBASE_PROJECT_ID or pass --project=your-project-id');
    process.exit(1);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account JSON key.');
    process.exit(1);
  }

  const app = admin.apps[0] ?? admin.initializeApp({ projectId });
  const db = admin.firestore();

  const ref1 = db.collection(collection).doc(id1);
  const ref2 = db.collection(collection).doc(id2);

  console.log(`Collection: ${collection}`);
  console.log(`Reading docs ${id1} and ${id2}...`);

  const [snap1, snap2] = await Promise.all([ref1.get(), ref2.get()]);

  if (!snap1.exists) {
    console.error(`Document ${id1} does not exist.`);
    process.exit(1);
  }
  if (!snap2.exists) {
    console.error(`Document ${id2} does not exist.`);
    process.exit(1);
  }

  const data1 = snap1.data();
  const data2 = snap2.data();

  console.log(`Deleting ${id1} and ${id2}...`);
  const batch = db.batch();
  batch.delete(ref1);
  batch.delete(ref2);
  await batch.commit();

  console.log(`Writing ${id1} with former ${id2} data, and ${id2} with former ${id1} data...`);
  const writeBatch = db.batch();
  writeBatch.set(ref1, data2);
  writeBatch.set(ref2, data1);
  await writeBatch.commit();

  console.log('Done. Documents swapped.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
