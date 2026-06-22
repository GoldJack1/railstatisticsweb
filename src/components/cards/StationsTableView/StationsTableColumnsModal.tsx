import React, { useEffect, useMemo, useState } from 'react'
import { BUTBaseButton as Button, BUTWideButton } from '../../buttons'
import BUTDDMList from '../../buttons/ddm/BUTDDMList'
import {
  addTableColumnSlot,
  DEFAULT_TABLE_COLUMN_SLOT_COUNT,
  getAvailableTableColumnKeys,
  getDefaultTableColumnSlots,
  getTableFieldKeyFromLabel,
  getTableFieldLabel,
  getTableFieldOptionLabelsForNetwork,
  MAX_TABLE_COLUMN_SLOT_COUNT,
  removeTableColumnSlot,
  type StationsTableColumnSlot,
} from '../../../utils/stationsTableColumnCatalog'
import type { NetworkViewFilter } from '../../../constants/stationCollections'
import type { StationCollectionFieldSchema } from '../../../utils/stationCollectionFieldSchema'
import '../../models/StationModal/StationModal.css'
import './StationsTableColumnsModal.css'

interface StationsTableColumnsModalProps {
  open: boolean
  slots: StationsTableColumnSlot[]
  networkView: NetworkViewFilter
  fieldSchema: StationCollectionFieldSchema
  onApply: (slots: StationsTableColumnSlot[]) => void
  onClose: () => void
}

const StationsTableColumnsModal: React.FC<StationsTableColumnsModalProps> = ({
  open,
  slots,
  networkView,
  fieldSchema,
  onApply,
  onClose,
}) => {
  const [draftSlots, setDraftSlots] = useState<StationsTableColumnSlot[]>(slots)
  const fieldOptions = useMemo(
    () => getTableFieldOptionLabelsForNetwork(networkView, fieldSchema),
    [networkView, fieldSchema]
  )
  const allowedFields = useMemo(
    () => getAvailableTableColumnKeys(networkView, fieldSchema),
    [networkView, fieldSchema]
  )

  const getFieldOptionsForSlot = (slot: StationsTableColumnSlot): string[] => {
    const selectedLabel = getTableFieldLabel(slot.field)
    if (fieldOptions.includes(selectedLabel)) return fieldOptions
    return [selectedLabel, ...fieldOptions]
  }

  useEffect(() => {
    if (open) {
      setDraftSlots(slots)
    }
  }, [open, slots])

  if (!open) return null

  const updateSlotField = (index: number, label: string) => {
    const field = getTableFieldKeyFromLabel(label)
    if (!field) return
    setDraftSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? { field } : slot))
    )
  }

  const handleResetDefaults = () => {
    setDraftSlots(getDefaultTableColumnSlots(networkView))
  }

  const handleAddColumn = () => {
    setDraftSlots((current) => addTableColumnSlot(current, allowedFields))
  }

  const handleRemoveColumn = () => {
    setDraftSlots((current) => removeTableColumnSlot(current))
  }

  const canAddColumn = draftSlots.length < MAX_TABLE_COLUMN_SLOT_COUNT
  const canRemoveColumn = draftSlots.length > DEFAULT_TABLE_COLUMN_SLOT_COUNT

  const handleApply = () => {
    onApply(draftSlots)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content stations-table-columns-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stations-table-columns-modal-title"
      >
        <div className="modal-header">
          <h2 id="stations-table-columns-modal-title" className="modal-title">
            Assign table headers
          </h2>
          <Button
            type="button"
            variant="circle"
            className="modal-close"
            ariaLabel="Close"
            onClick={onClose}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            }
          />
        </div>

        <div className="modal-body stations-table-columns-modal__body">
          <p className="stations-table-columns-modal__intro">
            Choose what each table column shows. Header 1 is the leftmost column, Header 2 is next, and so on.
          </p>

          <ul className="stations-table-columns-modal__list">
            {draftSlots.map((slot, index) => {
              const slotFieldOptions = getFieldOptionsForSlot(slot)
              const selectedLabel = getTableFieldLabel(slot.field)
              const selectedPosition = Math.max(0, slotFieldOptions.indexOf(selectedLabel))

              return (
                <li key={`header-slot-${index}`} className="stations-table-columns-modal__row">
                  <span className="stations-table-columns-modal__row-label">Header {index + 1}</span>
                  <BUTDDMList
                    items={slotFieldOptions}
                    filterName={`Header ${index + 1}`}
                    selectionMode="single"
                    selectedPositions={[selectedPosition]}
                    onSelectionChanged={(selectedPositions) => {
                      const nextPosition = selectedPositions[0]
                      if (typeof nextPosition !== 'number') return
                      const nextLabel = slotFieldOptions[nextPosition]
                      if (!nextLabel) return
                      updateSlotField(index, nextLabel)
                    }}
                    colorVariant="primary"
                  />
                </li>
              )
            })}
          </ul>

          <div className="stations-table-columns-modal__column-actions">
            <BUTWideButton
              type="button"
              width="hug"
              onClick={handleAddColumn}
              disabled={!canAddColumn}
            >
              Add column
            </BUTWideButton>
            <BUTWideButton
              type="button"
              width="hug"
              onClick={handleRemoveColumn}
              disabled={!canRemoveColumn}
            >
              Remove column
            </BUTWideButton>
          </div>

          <p className="stations-table-columns-modal__note">
            Showing {draftSlots.length} of {MAX_TABLE_COLUMN_SLOT_COUNT} columns ({DEFAULT_TABLE_COLUMN_SLOT_COUNT} by default). Changes reset when you reload the page.
          </p>
        </div>

        <div className="stations-table-columns-modal__footer">
          <BUTWideButton type="button" width="hug" onClick={handleResetDefaults}>
            Reset defaults
          </BUTWideButton>
          <div className="stations-table-columns-modal__footer-actions">
            <BUTWideButton type="button" width="hug" onClick={onClose}>
              Cancel
            </BUTWideButton>
            <BUTWideButton type="button" width="hug" colorVariant="accent" onClick={handleApply}>
              Apply headers
            </BUTWideButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StationsTableColumnsModal
