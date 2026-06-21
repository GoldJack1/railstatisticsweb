import { LIGHT_RAIL_YES_NO_VALUES, normalizeLightRailYesNo } from '../../../utils/lightRailStationFields'

type LightRailYesNoSelectProps = {
  id: string
  value: string
  onChange: (value: string) => void
}

/** Yes/No dropdown for SuperTram boolean-ish string fields — saves `Yes` or `No`. */
export function LightRailYesNoSelect({ id, value, onChange }: LightRailYesNoSelectProps) {
  const selectValue = normalizeLightRailYesNo(value)

  return (
    <label
      className={[
        'rs-button',
        'rs-button--wide',
        'rs-button--rounded',
        'rs-button--active',
        'rs-button--color-secondary',
        'rs-input',
        'rs-input--txtinp',
        'rs-input--prefix-none',
        'rs-input--select',
        selectValue ? 'rs-input--has-value' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <select
        id={id}
        className="rs-input__field"
        value={selectValue}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select…</option>
        {LIGHT_RAIL_YES_NO_VALUES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div className="rs-button__inner-shadow" aria-hidden="true" />
    </label>
  )
}
