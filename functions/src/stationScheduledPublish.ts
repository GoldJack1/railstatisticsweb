/**
 * Apply pending station changes to Firestore (Admin SDK).
 * Mirrors client src/services/firebase.ts stationToFirestoreUpdate + create/update/merge.
 * Imported only by `processScheduledStationPublishJobs` — not a separate Cloud Function export.
 */
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = () => admin.firestore();

export type StationCollectionId = "stations2603" | "newsandboxstations1";

export interface JobChangeEntry {
  isNew?: boolean;
  updated?: Record<string, unknown>;
  sandboxUpdated?: Record<string, unknown> | null;
}

function stationToFirestoreUpdate(data: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (data.stationName !== undefined) update.stationname = data.stationName;
  if (data.crsCode !== undefined) update.CrsCode = data.crsCode;
  if (data.tiploc !== undefined) update.tiploc = data.tiploc;
  if (data.country !== undefined) update.country = data.country;
  if (data.county !== undefined) update.county = data.county;
  if (data.toc !== undefined) update.TOC = data.toc;
  if (data.stnarea !== undefined) update.stnarea = data.stnarea;
  if (data.londonBorough !== undefined) update.londonBorough = data.londonBorough;
  if (data.fareZone !== undefined) update.fareZone = data.fareZone;
  if (data.yearlyPassengers !== undefined) update.yearlyPassengers = data.yearlyPassengers;
  if (typeof data.latitude === "number" && typeof data.longitude === "number") {
    update.location = new admin.firestore.GeoPoint(data.latitude, data.longitude);
  }
  return update;
}

function assertCollectionId(id: string): asserts id is StationCollectionId {
  if (id !== "stations2603" && id !== "newsandboxstations1") {
    throw new Error(`Invalid collectionId: ${id}`);
  }
}

/**
 * Apply all changes from a scheduled job document payload.
 * Sequential writes (same semantics as the web client).
 */
export async function applyScheduledStationJobPayload(payload: {
  collectionId: string;
  changes: Record<string, JobChangeEntry>;
}): Promise<void> {
  const {collectionId, changes} = payload;
  assertCollectionId(collectionId);
  if (!changes || typeof changes !== "object") {
    throw new Error("Job has no changes object");
  }

  for (const [stationId, entry] of Object.entries(changes)) {
    const ref = db().collection(collectionId).doc(stationId);
    const updated = (entry.updated ?? {}) as Record<string, unknown>;
    const sandboxUpdated = entry.sandboxUpdated;
    const isNew = entry.isNew === true;

    const corePayload = stationToFirestoreUpdate(updated);
    const coreWithId = {...corePayload, id: stationId};

    if (isNew) {
      if (Object.keys(corePayload).length === 0) {
        throw new Error(`No core fields for new station ${stationId}`);
      }
      await ref.set(coreWithId);
    } else if (Object.keys(corePayload).length > 0) {
      await ref.update(coreWithId);
    }

    if (sandboxUpdated && typeof sandboxUpdated === "object" && Object.keys(sandboxUpdated).length > 0) {
      await ref.set(sandboxUpdated, {merge: true});
    }
  }
}

/**
 * Claim a single job doc (pending → processing) if still eligible.
 */
export async function tryClaimScheduledJob(
  ref: admin.firestore.DocumentReference
): Promise<Record<string, unknown> | null> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data || data.status !== "pending") {
      return null;
    }
    const runAt = data.runAt as admin.firestore.Timestamp | undefined;
    if (!runAt || runAt.toMillis() > Date.now()) {
      return null;
    }
    tx.update(ref, {
      status: "processing",
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {...data, _id: ref.id};
  });
}

export async function processDueScheduledStationJobs(limit = 10): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const querySnap = await db()
    .collection("scheduledStationPublishJobs")
    .where("status", "==", "pending")
    .where("runAt", "<=", now)
    .limit(limit)
    .get();

  if (querySnap.empty) {
    return;
  }

  for (const docSnap of querySnap.docs) {
    const ref = docSnap.ref;
    try {
      const claimed = await tryClaimScheduledJob(ref);
      if (!claimed) {
        continue;
      }

      const collectionId = claimed.collectionId as string;
      const changes = claimed.changes as Record<string, JobChangeEntry>;

      await applyScheduledStationJobPayload({collectionId, changes});

      await ref.update({
        status: "completed",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info("Scheduled station publish job completed", {jobId: ref.id});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Scheduled station publish job failed", {jobId: ref.id, message});
      try {
        await ref.update({
          status: "failed",
          errorMessage: message,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateErr) {
        logger.error("Failed to mark job failed", {jobId: ref.id, updateErr});
      }
    }
  }
}
