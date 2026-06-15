export const NETWORK_COLLECTION_IDS = [
  "stations_gbnr",
  "stations_nitranslink",
  "stations_roiirerail",
] as const;

export type NetworkCollectionId = (typeof NETWORK_COLLECTION_IDS)[number];

export const SANDBOX_COLLECTION_ID = "newsandboxstations1" as const;

export type StationCollectionId = NetworkCollectionId | typeof SANDBOX_COLLECTION_ID;

const ALL_COLLECTION_IDS: readonly StationCollectionId[] = [
  ...NETWORK_COLLECTION_IDS,
  SANDBOX_COLLECTION_ID,
];

export function assertCollectionId(id: string): asserts id is StationCollectionId {
  if (!(ALL_COLLECTION_IDS as readonly string[]).includes(id)) {
    throw new Error(`Invalid collectionId: ${id}`);
  }
}
