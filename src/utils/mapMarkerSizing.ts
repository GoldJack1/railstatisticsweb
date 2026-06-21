/** Shared map pin sizing for circle markers and SuperTram logo markers. */
export const MARKER_RADIUS = {
  desktop: { visual: 7, visualSelected: 10, hit: 12, hitSelected: 14 },
  mobile: { visual: 8, visualSelected: 11, hit: 24, hitSelected: 26 },
} as const

/** Circle marker stroke — shared with SuperTram blob outline. */
export const MARKER_STROKE = {
  weight: { normal: 2, selected: 3 },
  color: { normal: '#ffffff', selected: '#2563eb' },
} as const

export function getMarkerVisualRadius(isSelected: boolean, mobile: boolean): number {
  const sizes = mobile ? MARKER_RADIUS.mobile : MARKER_RADIUS.desktop
  return isSelected ? sizes.visualSelected : sizes.visual
}

/** Circle fill diameter — inner fill area inside the stroke. */
export function getMarkerVisualDiameter(isSelected: boolean, mobile: boolean): number {
  return getMarkerVisualRadius(isSelected, mobile) * 2
}

export function getMarkerStrokeWeight(isSelected: boolean): number {
  return isSelected ? MARKER_STROKE.weight.selected : MARKER_STROKE.weight.normal
}

/** Total marker diameter including stroke (Leaflet circle: stroke centered on edge). */
export function getMarkerOuterDiameter(isSelected: boolean, mobile: boolean): number {
  return getMarkerVisualDiameter(isSelected, mobile) + getMarkerStrokeWeight(isSelected)
}

/** SuperTram div icon — stroke sits fully outside the blob (content-box border). */
export function getSuperTramIconOuterDiameter(isSelected: boolean, mobile: boolean): number {
  return getMarkerVisualDiameter(isSelected, mobile) + getMarkerStrokeWeight(isSelected) * 2
}

export function getMarkerHitRadius(isSelected: boolean, mobile: boolean): number {
  const sizes = mobile ? MARKER_RADIUS.mobile : MARKER_RADIUS.desktop
  return isSelected ? sizes.hitSelected : sizes.hit
}
