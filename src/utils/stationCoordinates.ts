/** True when latitude/longitude are usable for map markers. */
export function isValidStationCoordinate(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false
  if (latitude === 0 && longitude === 0) return false
  return true
}
