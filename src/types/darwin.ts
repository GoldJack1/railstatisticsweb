/*
 * Mirrors the JSON contract emitted by `darwin-local-test/departures-daemon.mjs`.
 * Single source of truth for both the React side and (informally) the daemon.
 *
 * Wire path during local dev:
 *   browser  →  http://localhost:3000/api/darwin/*  (Vite proxy)
 *                                  ↓
 *   daemon   ←  http://localhost:4001/api/*
 */

export type DarwinReasonSource =
  | 'schedule'
  | 'schedule-loc'
  | 'ts'
  | 'ts-loc'
  | 'ts-loc-can'
  | 'deactivated';

export interface DarwinReason {
  /** Numeric reason code from the reference XML, when known. */
  code?: string;
  /** Where in the Push Port stream this reason came from. */
  source: DarwinReasonSource;
  /** Human-readable text — already resolved against the reference table. */
  reason: string;
}

export type LiveTimeKind =
  | 'scheduled'    // no live data yet — public scheduled time
  | 'working'      // working timetable time (±30s precision)
  | 'est'          // forecast departure
  | 'actual'       // actual departure (recorded by signalling)
  | 'est-arr'      // forecast arrival (when no departure forecast available)
  | 'actual-arr';  // actual arrival (terminating / set-down only services)

export interface DepartureRow {
  rid: string;
  trainId: string;
  uid: string;

  toc: string;
  tocName: string | null;

  scheduledTime: string;       // "HH:MM"
  scheduledAt: string;         // ISO8601 anchored to today
  liveTime: string;
  liveKind: LiveTimeKind;

  platform: string | null;     // scheduled
  livePlatform: string | null; // overlaid

  /**
   * The exact TIPLOC this row was sourced from. For most rows this matches
   * the snapshot's top-level `tiploc`. For multi-platform stations queried
   * by CRS (e.g. STP) this can be different — STPX, STPANCI, STPXBOX all
   * share `crs="STP"` but represent different platform groups.
   */
  sourceTiploc?: string;

  origin: string;              // TIPLOC
  originName: string | null;
  originCrs: string | null;

  destination: string;         // TIPLOC
  destinationName: string | null;
  destinationCrs: string | null;

  callingAfter: string[];               // TIPLOCs after this stop
  callingAfterNames: (string | null)[]; // parallel — null for junctions
  callingAfterCrs:   (string | null)[]; // parallel

  isPassenger: boolean;
  cancelled: boolean;
  cancellation: DarwinReason | null;
  delayReason:  DarwinReason | null;

  /** Convenience summary string the UI can show directly. */
  status: string;
}

export interface DeparturesSnapshot {
  tiploc: string;
  /**
   * Full set of TIPLOCs aggregated into this snapshot. Present only when
   * a CRS resolved to >1 TIPLOC and departures from all of them have been
   * merged (e.g. STP -> [STPXBOX, STPX, STPANCI]).
   */
  tiplocs?: string[];
  stationName: string | null;
  stationCrs:  string | null;
  /** How the URL code matched: 'tiploc' | 'crs'. */
  matchedAs?: 'tiploc' | 'crs';
  /** Other TIPLOCs sharing the same CRS (e.g. multi-platform stations). */
  alternates?: string[];

  updatedAt: string;            // ISO8601
  timetableFile: string;
  windowHours: number;

  counts: {
    departures: number;
    cancelled: number;
    withDelay: number;
  };

  kafka: {
    consumed: number;
    updatesApplied: number;
    startedAt: string;
    lastMessageAt: string | null;
  };

  departures: DepartureRow[];
}

/**
 * Returned by GET /api/darwin/station/:code (resolution only — no departures).
 */
export interface StationResolution {
  tiploc: string;
  crs: string | null;
  name: string;
  matchedAs: 'tiploc' | 'crs';
  alternates?: string[];
}

/**
 * One calling-point entry on a service detail. Mirrors the daemon's
 * `buildServiceDetail` output. Junctions/passing points are included so
 * timing-only stops (PP) appear in the chronological list.
 */
export interface ServiceStop {
  tpl: string;
  name: string | null;
  crs: string | null;
  /** OR | IP | PP | DT | OPOR | OPIP | OPPP | OPDT */
  slot: string;
  /** Public scheduled times (HH:MM). Null at origin or pass-through points. */
  pta: string | null;
  ptd: string | null;
  /** Working timetable times (HH:MM[:30] precision). */
  wta: string | null;
  wtd: string | null;
  /** Working passing time. */
  wtp: string | null;
  platform: string | null;
  livePlatform: string | null;
  /** TB / TF / T / T X / OPRM / etc. */
  activity: string | null;
  /** Live time once available (Darwin TS forecast / actual). */
  liveTime: string | null;
  liveKind: LiveTimeKind | null;
  /** True when this specific stop has been cancelled in the live overlay. */
  cancelledAtStop: boolean;
}

/**
 * Returned by GET /api/darwin/service/:rid — full per-service detail.
 */
export interface ServiceDetail {
  rid: string;
  uid: string;
  trainId: string;
  ssd: string;                 // YYYY-MM-DD service start date
  toc: string;
  tocName: string | null;
  trainCat: string | null;
  isPassenger: boolean;
  origin: string;
  originName: string | null;
  destination: string;
  destinationName: string | null;
  cancelled: boolean;
  cancellation: DarwinReason | null;
  delayReason:  DarwinReason | null;
  stops: ServiceStop[];
  updatedAt: string;
}
