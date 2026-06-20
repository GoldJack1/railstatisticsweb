/** Shared map pin sizing for circle markers and SuperTram logo markers. */
export const MARKER_RADIUS = {
  desktop: { visual: 7, visualSelected: 10, hit: 12, hitSelected: 14 },
  mobile: { visual: 8, visualSelected: 11, hit: 24, hitSelected: 26 },
} as const

export function getMarkerVisualRadius(isSelected: boolean, mobile: boolean): number {
  const sizes = mobile ? MARKER_RADIUS.mobile : MARKER_RADIUS.desktop
  return isSelected ? sizes.visualSelected : sizes.visual
}

/** Circle fill diameter — SuperTram logo squares use the same inner size. */
export function getMarkerVisualDiameter(isSelected: boolean, mobile: boolean): number {
  return getMarkerVisualRadius(isSelected, mobile) * 2
}

export function getMarkerHitRadius(isSelected: boolean, mobile: boolean): number {
  const sizes = mobile ? MARKER_RADIUS.mobile : MARKER_RADIUS.desktop
  return isSelected ? sizes.hitSelected : sizes.hit
}
