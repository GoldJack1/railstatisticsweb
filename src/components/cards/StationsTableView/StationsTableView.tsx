import React, { useEffect, useMemo } from 'react'
import type { Station } from '../../../types'
import { LightRailLineChips } from '../../chips/LightRailLineChips'
import { isLightRailStop } from '../../../utils/stationCardForNetwork'
import {
  formatTableCellValue,
  getTableColumnValue,
  resolveTableColumnsFromSlots,
  toggleTableSort,
  type StationsTableColumnDefinition,
  type StationsTableColumnSlot,
  type StationsTableSort,
} from '../../../utils/stationsTableColumns'
import { getLatestYearlyPassengerDisplay } from '../../../utils/yearlyPassengers'
import './StationsTableView.css'

function getStationTableRowKey(station: Station): string {
  return `${station.sourceCollectionId ?? station.stnarea ?? 'station'}-${station.id}`
}

interface StationsTableViewProps {
  stations: Station[]
  sort: StationsTableSort
  onSortChange: (sort: StationsTableSort) => void
  onRowClick: (station: Station) => void
  columnSlots: StationsTableColumnSlot[]
}

function renderTableCell(station: Station, column: StationsTableColumnDefinition): React.ReactNode {
  if (column.key === 'latestPassengers') {
    const display = getLatestYearlyPassengerDisplay(station.yearlyPassengers)
    return display || '—'
  }

  if (column.renderAsLinesChips) {
    if (!isLightRailStop(station)) {
      return '—'
    }

    return (
      <LightRailLineChips
        linesServed={station.linesServed}
        emptyLabel="—"
        className="stations-table__lines-chips"
      />
    )
  }

  return formatTableCellValue(getTableColumnValue(station, column.key))
}

const StationsTableView: React.FC<StationsTableViewProps> = ({
  stations,
  sort,
  onSortChange,
  onRowClick,
  columnSlots,
}) => {
  const visibleColumns = useMemo(
    () => resolveTableColumnsFromSlots(columnSlots),
    [columnSlots]
  )
  const visibleColumnKeys = useMemo(
    () => visibleColumns.map((column) => column.key),
    [visibleColumns]
  )

  useEffect(() => {
    if (!visibleColumnKeys.includes(sort.column)) {
      onSortChange({ column: 'name', direction: 'asc' })
    }
  }, [onSortChange, sort.column, visibleColumnKeys])

  const handleHeaderClick = (column: StationsTableColumnDefinition) => {
    onSortChange(toggleTableSort(sort, column.key))
  }

  return (
    <div className="stations-table-panel">
      <div className="stations-table-wrap">
        <table className="stations-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const isSorted = sort.column === column.key
                const ariaSort = isSorted
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'

                return (
                  <th key={`header-${column.slotIndex}`} scope="col" aria-sort={ariaSort}>
                    <button
                      type="button"
                      className={[
                        'stations-table__sort-button',
                        isSorted ? 'stations-table__sort-button--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleHeaderClick(column)}
                    >
                      <span>{column.label}</span>
                      {isSorted && (
                        <span className="stations-table__sort-indicator" aria-hidden="true">
                          {sort.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {stations.map((station) => {
              const rowKey = getStationTableRowKey(station)

              return (
              <tr
                key={rowKey}
                className="stations-table__row"
                tabIndex={0}
                onClick={() => onRowClick(station)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onRowClick(station)
                  }
                }}
              >
                {visibleColumns.map((column) => (
                  <td
                    key={`cell-${rowKey}-${column.slotIndex}`}
                    className={[
                      column.cellClassName,
                      column.renderAsLinesChips ? 'stations-table__lines-cell' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {renderTableCell(station, column)}
                  </td>
                ))}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default StationsTableView
