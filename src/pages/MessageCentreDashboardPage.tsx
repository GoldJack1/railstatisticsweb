import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BUTWideButton } from '../components/buttons'
import TXTINPIconWideButtonSearch from '../components/textInputs/special/TXTINPIconWideButtonSearch'
import type { InAppMessage, MessageStatus } from '../types/messages'
import {
  archiveInAppMessage,
  deleteInAppMessage,
  listInAppMessages,
  publishInAppMessage
} from '../services/messageCentre'
import './MessageCentreAdminPage/MessageCentreAdminPage.css'

type FilterStatus = MessageStatus | 'all'

const MessageCentreDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState<InAppMessage[]>([])
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    const loadedRows = await listInAppMessages({ status: selectedStatus, search })
    setRows(loadedRows)
  }, [search, selectedStatus])

  useEffect(() => {
    void loadRows().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load messages.')
    })
  }, [loadRows])

  const stats = useMemo(() => {
    const out = { total: rows.length, draft: 0, published: 0, archived: 0 }
    for (const row of rows) {
      if (row.status === 'draft') out.draft += 1
      if (row.status === 'published') out.published += 1
      if (row.status === 'archived') out.archived += 1
    }
    return out
  }, [rows])

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
    <div className="message-centre-admin-page">
      <header className="message-centre-admin-header">
        <h1>Message Dashboard</h1>
        <p>View all messages and quickly publish, archive, delete, or open for editing.</p>
      </header>

      <section className="message-centre-dashboard-stats" aria-label="Message dashboard stats">
        <div className="message-centre-stat-card"><span>Total</span><strong>{stats.total}</strong></div>
        <div className="message-centre-stat-card"><span>Draft</span><strong>{stats.draft}</strong></div>
        <div className="message-centre-stat-card"><span>Published</span><strong>{stats.published}</strong></div>
        <div className="message-centre-stat-card"><span>Archived</span><strong>{stats.archived}</strong></div>
      </section>

      <section className="message-centre-list-panel">
        <div className="message-centre-status">
          {error && <p className="message-centre-status__error">{error}</p>}
          {notice && <p className="message-centre-status__notice">{notice}</p>}
        </div>
        <div className="message-centre-list-controls">
          <TXTINPIconWideButtonSearch
            id="message-centre-search"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="7" cy="7" r="4" />
                <line x1="11" y1="11" x2="13" y2="13" />
              </svg>
            }
            value={search}
            onInputChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, preview, body..."
            className="message-centre-search-input-shell"
            colorVariant="secondary"
            autoComplete="off"
            spellCheck={false}
          />
          <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as FilterStatus)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <BUTWideButton width="fill" instantAction onClick={() => navigate('/admin/messages/new')}>
            New message
          </BUTWideButton>
        </div>
        <div className="message-centre-list-items">
          {rows.map((row) => (
            <div className="message-row" key={row.id}>
              <strong>{row.title || 'Untitled message'}</strong>
              <span>{row.preview || row.body.slice(0, 80)}</span>
              <em>{row.status}</em>
              <div className="message-row-actions">
                <BUTWideButton width="hug" instantAction disabled={isBusy} onClick={() => navigate(`/admin/messages/${row.id}`)}>
                  Edit
                </BUTWideButton>
                <BUTWideButton
                  width="hug"
                  colorVariant="green-action"
                  instantAction
                  disabled={isBusy || row.status === 'published'}
                  onClick={() => void publishRowQuick(row)}
                >
                  Publish
                </BUTWideButton>
                <BUTWideButton
                  width="hug"
                  colorVariant="red-action"
                  instantAction
                  disabled={isBusy || row.status === 'archived'}
                  onClick={() => void archiveRowQuick(row)}
                >
                  Archive
                </BUTWideButton>
                <BUTWideButton
                  width="hug"
                  colorVariant="red-action"
                  instantAction
                  disabled={isBusy}
                  onClick={() => void deleteRowQuick(row)}
                >
                  Delete
                </BUTWideButton>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default MessageCentreDashboardPage
