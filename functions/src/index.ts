/**
 * Firebase Cloud Functions — scheduled station database publishes.
 */
import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {processDueScheduledStationJobs} from "./stationScheduledPublish";

setGlobalOptions({maxInstances: 10});

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Runs every minute; picks up Firestore jobs in `scheduledStationPublishJobs`
 * where status === pending and runAt <= now.
 */
export const processScheduledStationPublishJobs = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Etc/UTC",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    try {
      await processDueScheduledStationJobs(15);
    } catch (err) {
      logger.error("processScheduledStationPublishJobs top-level error", err);
    }
  }
);
