import {
  LIGHT_RAIL_PLATFORM_OPTIONS,
  parseLightRailPlatformsSet,
  serializeLightRailPlatforms,
} from '../../utils/lightRailStationFields'
import './LightRailPlatformsChipPicker.css'

interface LightRailPlatformsChipPickerProps {
  value: string
  onChange: (value: string) => void
  id?: string
  labelledBy?: string
}

export function LightRailPlatformsChipPicker({
  value,
  onChange,
  id,
  labelledBy,
}: LightRailPlatformsChipPickerProps) {
  const selected = parseLightRailPlatformsSet(value)

  const togglePlatform = (platform: (typeof LIGHT_RAIL_PLATFORM_OPTIONS)[number]) => {
    const next = new Set(selected)
    if (next.has(platform)) next.delete(platform)
    else next.add(platform)
    onChange(serializeLightRailPlatforms(next))
  }

  return (
    <div
      id={id}
      className="light-rail-platforms-chip-picker"
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : 'Platforms'}
    >
      {LIGHT_RAIL_PLATFORM_OPTIONS.map((platform) => {
        const isSelected = selected.has(platform)
        return (
          <button
            key={platform}
            type="button"
            className={[
              'light-rail-platforms-chip-picker__chip',
              isSelected ? 'light-rail-platforms-chip-picker__chip--selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={isSelected}
            onClick={() => togglePlatform(platform)}
          >
            {platform}
          </button>
        )
      })}
    </div>
  )
}

export default LightRailPlatformsChipPicker
