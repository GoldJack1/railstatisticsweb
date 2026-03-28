/**
 * FROZEN: Production new-station notifications (FCM topic + OneSignal).
 * Do not change behavior here unless you are deliberately updating that product flow.
 * Historical reference: `.cursor/index.js` (same logic).
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as https from "https";

type OneSignalResult = {
  statusCode: number;
  body: Record<string, unknown> & {raw?: string; id?: string; recipients?: number; errors?: unknown};
};

function sendOneSignalNotification(payload: Record<string, unknown>): Promise<OneSignalResult> {
  return new Promise((resolve, reject) => {
    const appId = process.env.ONESIGNAL_APP_ID
      || "b1824067-6f5f-407a-a232-d0bcb4abd077";
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!appId || !apiKey) {
      reject(new Error("Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY"));
      return;
    }

    const requestBody = JSON.stringify({
      app_id: appId,
      ...payload,
    });

    const request = https.request(
      "https://onesignal.com/api/v1/notifications",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${apiKey}`,
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            let parsed: Record<string, unknown> | null = null;
            try {
              parsed = JSON.parse(body) as Record<string, unknown>;
            } catch {
              parsed = {raw: body};
            }
            resolve({
              statusCode: response.statusCode,
              body: parsed,
            });
          } else {
            reject(
              new Error(`OneSignal API error ${response.statusCode}: ${body}`)
            );
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });

    request.write(requestBody);
    request.end();
  });
}

function buildStationCollectionUpdatesFilters(): Array<Record<string, unknown>> {
  // Support both current and legacy tag keys (matches iOS TopicTag.stationCollectionUpdatesKeys).
  return [
    {field: "tag", key: "station_collection_updates", relation: "=", value: "true"},
    {operator: "OR"},
    {field: "tag", key: "topic_station_collection_updates", relation: "=", value: "true"},
  ];
}

export const onNewStationAdded = functions.firestore
  .document("stations2603/{stationId}")
  .onCreate(async (snap, context) => {
    const stationData = snap.data()!;
    const stationName = stationData.stationname || "Unknown Station";
    const crsCode = stationData.CrsCode || "";
    const toc = stationData.TOC || "";
    const country = stationData.country || "";

    console.log(`🆕 New station detected: ${stationName}`);

    const message = {
      notification: {
        title: "New Station!",
        body: `${stationName} has just opened! Have you been?`,
      },
      data: {
        type: "new_station",
        stationId: context.params.stationId,
        stationName: stationName,
        crsCode: crsCode,
        toc: toc,
        country: country,
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: "New Station!",
              body: `${stationName} has just opened! Have you been?`,
            },
            badge: 1,
            sound: "default",
          },
        },
      },
      topic: "ia_new_stations",
    };

    try {
      const response = await admin.messaging().send(message);
      console.log("✅ Notification sent successfully:", response);
    } catch (error) {
      console.error("❌ Error sending notification:", error);
    }

    // Also send via OneSignal (production) to users opted into station collection updates.
    // This lets you keep FCM topic notifications while migrating to OneSignal.
    const oneSignalPayload = {
      filters: buildStationCollectionUpdatesFilters(),
      target_channel: "push",
      headings: {en: "New Station!"},
      contents: {en: `${stationName} has just opened! Have you been?`},
      data: {
        type: "new_station",
        station_collection_updates: "true",
        stationId: context.params.stationId,
        stationName: stationName,
        crsCode: crsCode,
        toc: toc,
        country: country,
        sourceCollection: "stations2603",
      },
      small_icon: "onesignal_small_icon_default",
      ios_badgeType: "Increase",
      ios_badgeCount: 1,
    };

    try {
      const osResponse = await sendOneSignalNotification(oneSignalPayload);
      console.log("✅ OneSignal production notification sent:", {
        statusCode: osResponse.statusCode,
        id: osResponse.body && osResponse.body.id ? osResponse.body.id : "unknown",
        recipients: osResponse.body && typeof osResponse.body.recipients !== "undefined"
          ? osResponse.body.recipients
          : "unknown",
        errors: osResponse.body && osResponse.body.errors ? osResponse.body.errors : null,
        raw: osResponse.body && osResponse.body.raw ? osResponse.body.raw : null,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("❌ OneSignal production notification failed:", msg);
    }

    return null;
  });
