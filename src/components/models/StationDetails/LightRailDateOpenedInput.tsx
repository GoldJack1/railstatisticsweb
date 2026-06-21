import TXTINPWideButton from '../../textInputs/plain/TXTINPWideButton'
import { isoDateToDdMmYyyy, storedDateToIsoDate } from '../../../utils/dateDdMmYyyy'

type LightRailDateOpenedInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
}

/** Date opened picker — stored as dd/mm/yyyy, styled like other station form fields. */
export function LightRailDateOpenedInput({ id, value, onChange }: LightRailDateOpenedInputProps) {
  return (
    <TXTINPWideButton
      id={id}
      type="date"
      value={storedDateToIsoDate(value)}
      onChange={(iso) => onChange(isoDateToDdMmYyyy(iso))}
      inputClassName="edit-input"
      colorVariant="secondary"
    />
  )
}
