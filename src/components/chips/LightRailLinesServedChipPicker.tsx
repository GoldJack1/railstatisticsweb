import {
  getLightRailLineChipColors,
  LIGHT_RAIL_LINE_OPTIONS,
  parseLightRailLinesServedSet,
  serializeLightRailLinesServed,
} from '../../utils/lightRailStationFields'
import './LightRailLinesServedChipPicker.css'

interface LightRailLinesServedChipPickerProps {
  value: string
  onChange: (value: string) => void
  id?: string
  labelledBy?: string
}

export function LightRailLinesServedChipPicker({
  value,
  onChange,
  id,
  labelledBy,
}: LightRailLinesServedChipPickerProps) {
  const selected = parseLightRailLinesServedSet(value)

  const toggleLine = (line: (typeof LIGHT_RAIL_LINE_OPTIONS)[number]) => {
    const next = new Set(selected)
    if (next.has(line)) next.delete(line)
    else next.add(line)
    onChange(serializeLightRailLinesServed(next))
  }

  return (
    <div
      id={id}
      className="light-rail-lines-chip-picker"
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : 'Lines served'}
    >
      {LIGHT_RAIL_LINE_OPTIONS.map((line) => {
        const isSelected = selected.has(line)
        const colors = getLightRailLineChipColors(line)
        return (
          <button
            key={line}
            type="button"
            className={[
              'light-rail-lines-chip-picker__chip',
              isSelected ? 'light-rail-lines-chip-picker__chip--selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={isSelected}
            onClick={() => toggleLine(line)}
            style={
              isSelected
                ? { backgroundColor: colors.bg, color: colors.text, borderColor: colors.bg }
                : { borderColor: colors.bg, color: colors.text }
            }
          >
            {line}
          </button>
        )
      })}
    </div>
  )
}

export default LightRailLinesServedChipPicker
