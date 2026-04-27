import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BUTWideButton } from '../components/buttons'
import { PageTopHeader } from '../components/misc'
import BUTDDMList from '../components/buttons/ddm/BUTDDMList'
import TXTINPBUTIconWideButtonSearch from '../components/textInputButtons/special/TXTINPBUTIconWideButtonSearch'
import { SelectionDot, TextCard, type TextCardState } from '../components/cards'
import type { InAppMessage, MessageStatus } from '../types/messages'
import {
  archiveInAppMessage,
  deleteInAppMessage,
  listInAppMessages,
  publishInAppMessage
} from '../services/messageCentre'
import './MessageCentreAdminPage/MessageCentreAdminPage.css'

type FilterStatus = MessageStatus | 'all'
const STATUS_OPTIONS: Array<{ label: string; value: FilterStatus }> = [
  { label: 'All statuses', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

const MessageCentreDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState<InAppMessage[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [pressedSelectorId, setPressedSelectorId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const selectorPressTimeoutRef = useRef<number | null>(null)

  const loadRows = useCallback(async () => {
    const loadedRows = await listInAppMessages({ status: selectedStatus, search })
    setRows(loadedRows)
  }, [search, selectedStatus])

  useEffect(() => {
    void loadRows().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load messages.')
    })
  }, [loadRows])

  useEffect(() => {
    return () => {
      if (selectorPressTimeoutRef.current !== null) {
        window.clearTimeout(selectorPressTimeoutRef.current)
      }
    }
  }, [])

  const stats = useMemo(() => {
    const out = { total: rows.length, draft: 0, published: 0, archived: 0 }
    for (const row of rows) {
      if (row.status === 'draft') out.draft += 1
      if (row.status === 'published') out.published += 1
      if (row.status === 'archived') out.archived += 1
    }
    return out
  }, [rows])
  const selectedStatusIndex = Math.max(0, STATUS_OPTIONS.findIndex((option) => option.value === selectedStatus))
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedMessageId) ?? null,
    [rows, selectedMessageId]
  )

  const getCardState = (rowId: string): TextCardState => {
    return selectedMessageId === rowId ? 'accent' : 'default'
  }

  const toggleRowSelection = (rowId: string) => {
    setSelectedMessageId((prev) => (prev === rowId ? null : rowId))
  }

  const handleSelectorDotClick = (rowId: string) => {
    setPressedSelectorId(rowId)
    toggleRowSelection(rowId)
    if (selectorPressTimeoutRef.current !== null) {
      window.clearTimeout(selectorPressTimeoutRef.current)
    }
    selectorPressTimeoutRef.current = window.setTimeout(() => {
      setPressedSelectorId((prev) => (prev === rowId ? null : prev))
      selectorPressTimeoutRef.current = null
    }, 250)
  }

  const publishRowQuick = async (row: InAppMessage) => {
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      await publishInAppMessage(row.id, {
        title: row.title,
        body: row.body,
        preview: row.preview ?? '',
        topImageUrl: row.topImageUrl ?? '',
        contentBlocks: row.contentBlocks,
        status: row.status,
        segment: row.segment,
        deepLinkTarget: row.deepLinkTarget,
        sendPush: row.sendPush,
        deleted: row.deleted
      })
      await loadRows()
      setNotice(`Published "${row.title || 'message'}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick publish failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const archiveRowQuick = async (row: InAppMessage) => {
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      await archiveInAppMessage(row.id)
      await loadRows()
      setNotice(`Archived "${row.title || 'message'}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick archive failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const deleteRowQuick = async (row: InAppMessage) => {
    const confirmed = window.confirm(`Delete "${row.title || 'this message'}" permanently?`)
    if (!confirmed) return
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      await deleteInAppMessage(row.id)
      await loadRows()
      setNotice(`Deleted "${row.title || 'message'}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="message-centre-admin-page-shell">
      <PageTopHeader
        title="Message Dashboard"
        subtitle="View all messages and quickly publish, archive, delete, or open for editing."
        actionContent={
          <>
            <BUTWideButton
              width="hug"
              colorVariant="green-action"
              instantAction
              disabled={isBusy || !selectedRow || selectedRow.status === 'published'}
              onClick={() => selectedRow ? void publishRowQuick(selectedRow) : undefined}
            >
              Publish
            </BUTWideButton>
            <BUTWideButton
              width="hug"
              colorVariant="red-action"
              instantAction
              disabled={isBusy || !selectedRow || selectedRow.status === 'archived'}
              onClick={() => selectedRow ? void archiveRowQuick(selectedRow) : undefined}
            >
              Archive
            </BUTWideButton>
            <BUTWideButton
              width="hug"
              colorVariant="red-action"
              instantAction
              disabled={isBusy || !selectedRow}
              onClick={() => selectedRow ? void deleteRowQuick(selectedRow) : undefined}
            >
              Delete
            </BUTWideButton>
          </>
        }
      />
      <div className="message-centre-admin-page message-centre-admin-page--dashboard">
        <div className="message-centre-dashboard-content">
          <aside className="message-centre-dashboard-sidebar">
            <section className="message-centre-list-panel">
              <div className="message-centre-list-controls message-centre-list-controls--actions">
                <BUTWideButton width="fill" instantAction onClick={() => navigate('/admin/messages/new')}>
                  New message
                </BUTWideButton>
              </div>

              <div className="message-centre-panel-spacer" aria-hidden="true" />

              <h2 className="message-centre-section-title message-centre-section-title--subsection">Overview</h2>
              <section className="message-centre-dashboard-stats" aria-label="Message dashboard stats">
                <div className="message-centre-stat-card"><span>Total</span><strong>{stats.total}</strong></div>
                <div className="message-centre-stat-card"><span>Draft</span><strong>{stats.draft}</strong></div>
                <div className="message-centre-stat-card"><span>Published</span><strong>{stats.published}</strong></div>
                <div className="message-centre-stat-card"><span>Archived</span><strong>{stats.archived}</strong></div>
              </section>

              <div className="message-centre-panel-spacer" aria-hidden="true" />

              <h2 className="message-centre-section-title message-centre-section-title--subsection">Search</h2>
              <div className="message-centre-list-controls">
                <TXTINPBUTIconWideButtonSearch
                  id="message-centre-search"
                  icon={
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="7" cy="7" r="4" />
                      <line x1="11" y1="11" x2="13" y2="13" />
                    </svg>
                  }
                  value={search}
                  onChange={setSearch}
                  placeholder="Search title, preview, body..."
                  className="message-centre-search-input-shell"
                  colorVariant="primary"
                />
              </div>

              <div className="message-centre-panel-spacer" aria-hidden="true" />

              <h2 className="message-centre-section-title message-centre-section-title--subsection">Filters</h2>
              <div className="message-centre-list-controls">
                <BUTDDMList
                  items={STATUS_OPTIONS.map((option) => option.label)}
                  filterName="Statuses"
                  selectionMode="single"
                  selectedPositions={[selectedStatusIndex]}
                  onSelectionChanged={(selectedPositions) => {
                    const selectedIndex = selectedPositions[0]
                    if (typeof selectedIndex !== 'number') return
                    const selectedOption = STATUS_OPTIONS[selectedIndex]
                    if (!selectedOption) return
                    setSelectedStatus(selectedOption.value)
                  }}
                  colorVariant="primary"
                />
              </div>
            </section>
          </aside>

          <main className="message-centre-dashboard-main">
            <section className="message-centre-list-panel">
              <div className={`message-centre-status ${error || notice ? 'message-centre-status--active' : ''}`}>
                {error && <p className="message-centre-status__error">{error}</p>}
                {notice && <p className="message-centre-status__notice">{notice}</p>}
              </div>
              <div className="message-centre-list-items message-centre-list-items--cards">
                {rows.map((row) => (
                  <div className="message-row message-row--card" key={row.id}>
                    <div className="message-row-card-stack">
                      <div className="message-row-card-stack__select">
                        <button
                          type="button"
                          className={`message-row-select-dot ${pressedSelectorId === row.id ? 'message-row-select-dot--pressed' : ''}`}
                          aria-label={selectedMessageId === row.id ? 'Message selected' : 'Select message'}
                          onClick={() => handleSelectorDotClick(row.id)}
                        >
                          <SelectionDot selected={selectedMessageId === row.id} />
                        </button>
                      </div>
                      <div className="message-row-card-stack__main">
                        <TextCard
                          state={getCardState(row.id)}
                          title={row.title || 'Untitled message'}
                          description={row.preview || row.body.slice(0, 120)}
                          onClick={() => navigate(`/admin/messages/${row.id}`)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default MessageCentreDashboardPage
