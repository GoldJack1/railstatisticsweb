import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BUTWideButton from '../components/BUTWideButton'
import type { InAppMessageDraftInput, MessageContentBlock } from '../types/messages'
import {
  archiveInAppMessage,
  createInAppMessageDraft,
  getInAppMessage,
  publishInAppMessage,
  updateInAppMessage,
  uploadMessageCentreImage
} from '../services/messageCentre'
import { normalizeMessageDraftInput } from '../types/messages'
import './MessageCentreAdminPage.css'

const EMPTY_DRAFT: InAppMessageDraftInput = {
  title: '',
  body: '',
  preview: '',
  topImageUrl: '',
  contentBlocks: [],
  status: 'draft',
  segment: 'messaging',
  deepLinkTarget: 'message_center',
  sendPush: false,
  deleted: false
}

const MessageCentreAdminPage: React.FC = () => {
  const navigate = useNavigate()
  const { messageId } = useParams<{ messageId?: string }>()
  const [draft, setDraft] = useState<InAppMessageDraftInput>(EMPTY_DRAFT)
  const [activeMessageId, setActiveMessageId] = useState<string>(messageId && messageId !== 'new' ? messageId : '')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadMessageIntoComposer = async (id: string) => {
    const selected = await getInAppMessage(id)
    if (!selected) {
      setError('Message not found.')
      return
    }
    setActiveMessageId(selected.id)
    setDraft({
      title: selected.title,
      body: selected.body,
      preview: selected.preview ?? '',
      topImageUrl: selected.topImageUrl ?? '',
      contentBlocks: selected.contentBlocks,
      status: selected.status,
      segment: selected.segment,
      deepLinkTarget: selected.deepLinkTarget,
      sendPush: selected.sendPush,
      deleted: selected.deleted
    })
  }

  useEffect(() => {
    if (!messageId || messageId === 'new') {
      setActiveMessageId('')
      setDraft(EMPTY_DRAFT)
      return
    }
    void loadMessageIntoComposer(messageId).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load message.')
    })
  }, [messageId])

  const updateDraft = (patch: Partial<InAppMessageDraftInput>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const upsertBlock = (index: number, block: MessageContentBlock) => {
    setDraft((prev) => {
      const nextBlocks = [...(prev.contentBlocks ?? [])]
      nextBlocks[index] = block
      return { ...prev, contentBlocks: nextBlocks }
    })
  }

  const removeBlock = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      contentBlocks: (prev.contentBlocks ?? []).filter((_, i) => i !== index)
    }))
  }

  const addTextBlock = () => {
    setDraft((prev) => ({
      ...prev,
      contentBlocks: [...(prev.contentBlocks ?? []), { type: 'text', text: '' }]
    }))
  }

  const addImageBlock = () => {
    setDraft((prev) => ({
      ...prev,
      contentBlocks: [...(prev.contentBlocks ?? []), { type: 'image', imageUrl: '', caption: '' }]
    }))
  }

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    options: { blockIndex?: number; topImage?: boolean }
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      const url = await uploadMessageCentreImage(file)
      if (options.topImage) {
        updateDraft({ topImageUrl: url })
      } else if (typeof options.blockIndex === 'number') {
        const block = draft.contentBlocks?.[options.blockIndex]
        if (block?.type === 'image') {
          upsertBlock(options.blockIndex, { ...block, imageUrl: url })
        }
      }
      setNotice('Image uploaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.')
    } finally {
      setIsBusy(false)
      event.target.value = ''
    }
  }

  const saveDraft = async () => {
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      const normalized = normalizeMessageDraftInput({ ...draft, status: 'draft' })
      if (activeMessageId) {
        await updateInAppMessage(activeMessageId, normalized)
      } else {
        const createdId = await createInAppMessageDraft(normalized)
        setActiveMessageId(String(createdId))
        navigate(`/admin/messages/${createdId}`)
      }
      setNotice('Draft saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draft save failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const publish = async () => {
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (!activeMessageId) {
        const createdId = await createInAppMessageDraft(normalizeMessageDraftInput({ ...draft, status: 'draft' }))
        setActiveMessageId(String(createdId))
        navigate(`/admin/messages/${createdId}`)
        await publishInAppMessage(createdId, draft)
      } else {
        await publishInAppMessage(activeMessageId, draft)
      }
      setNotice('Message published.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const archive = async () => {
    if (!activeMessageId) return
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      await archiveInAppMessage(activeMessageId)
      setNotice('Message archived.')
      updateDraft({ status: 'archived', deleted: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const resetComposer = () => {
    setActiveMessageId('')
    setDraft(EMPTY_DRAFT)
    setError(null)
    setNotice(null)
    navigate('/admin/messages/new')
  }

  const previewBlocks = useMemo(() => draft.contentBlocks ?? [], [draft.contentBlocks])

  return (
    <div className="message-centre-admin-page">
      <header className="message-centre-admin-header">
        <h1>Message Editor</h1>
        <p>Edit content and live preview on this dedicated page.</p>
      </header>

      <div className="message-centre-admin-layout">
        <section className="message-centre-composer-panel message-centre-composer-panel--wide">
          <div className="message-centre-status">
            {error && <p className="message-centre-status__error">{error}</p>}
            {notice && <p className="message-centre-status__notice">{notice}</p>}
          </div>
          <div className="message-centre-inline-actions">
            <BUTWideButton width="hug" instantAction onClick={() => navigate('/admin/messages')}>
              Back to dashboard
            </BUTWideButton>
            <BUTWideButton width="hug" instantAction onClick={resetComposer}>
              New message
            </BUTWideButton>
          </div>

          <div className="message-centre-form-grid">
            <label>
              Title
              <input
                type="text"
                value={draft.title ?? ''}
                onChange={(event) => updateDraft({ title: event.target.value })}
              />
            </label>
            <label>
              Preview
              <input
                type="text"
                value={draft.preview ?? ''}
                onChange={(event) => updateDraft({ preview: event.target.value })}
              />
            </label>
            <label className="message-centre-form-grid__full">
              Body
              <textarea
                rows={6}
                value={draft.body ?? ''}
                onChange={(event) => updateDraft({ body: event.target.value })}
              />
            </label>
            <label className="message-centre-form-grid__full">
              Top image URL
              <input
                type="url"
                value={draft.topImageUrl ?? ''}
                onChange={(event) => updateDraft({ topImageUrl: event.target.value })}
              />
            </label>
            <label className="message-centre-upload-label">
              Upload top image
              <input type="file" accept="image/*" onChange={(event) => void handleUpload(event, { topImage: true })} />
            </label>
          </div>

          <div className="message-centre-blocks">
            <div className="message-centre-blocks-header">
              <h2>Content blocks</h2>
              <div className="message-centre-inline-actions">
                <BUTWideButton width="hug" instantAction onClick={addTextBlock}>Add text block</BUTWideButton>
                <BUTWideButton width="hug" instantAction onClick={addImageBlock}>Add image block</BUTWideButton>
              </div>
            </div>
            {(draft.contentBlocks ?? []).map((block, index) => (
              <div className="message-centre-block-card" key={`${block.type}-${index}`}>
                <div className="message-centre-block-card__head">
                  <strong>{block.type === 'text' ? 'Text block' : 'Image block'}</strong>
                  <BUTWideButton width="hug" colorVariant="red-action" instantAction onClick={() => removeBlock(index)}>
                    Remove
                  </BUTWideButton>
                </div>
                {block.type === 'text' ? (
                  <textarea
                    rows={4}
                    value={block.text}
                    onChange={(event) => upsertBlock(index, { type: 'text', text: event.target.value })}
                  />
                ) : (
                  <>
                    <input
                      type="url"
                      value={block.imageUrl}
                      placeholder="Image URL"
                      onChange={(event) =>
                        upsertBlock(index, { type: 'image', imageUrl: event.target.value, caption: block.caption })
                      }
                    />
                    <input
                      type="text"
                      value={block.caption ?? ''}
                      placeholder="Caption (optional)"
                      onChange={(event) =>
                        upsertBlock(index, { type: 'image', imageUrl: block.imageUrl, caption: event.target.value })
                      }
                    />
                    <label className="message-centre-upload-label">
                      Upload image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => void handleUpload(event, { blockIndex: index })}
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="message-centre-actions">
            <BUTWideButton width="hug" instantAction disabled={isBusy} onClick={() => void saveDraft()}>
              Save draft
            </BUTWideButton>
            <BUTWideButton
              width="hug"
              colorVariant="green-action"
              instantAction
              disabled={isBusy}
              onClick={() => void publish()}
            >
              Publish now
            </BUTWideButton>
            <BUTWideButton
              width="hug"
              colorVariant="red-action"
              instantAction
              disabled={isBusy || activeMessageId.length === 0}
              onClick={() => void archive()}
            >
              Archive
            </BUTWideButton>
          </div>
        </section>

        <section className="message-centre-preview-panel">
          <h2>Preview</h2>
          <article className="message-preview-card">
            <h3>{draft.title || 'Untitled message'}</h3>
            {draft.topImageUrl && <img src={draft.topImageUrl} alt="" />}
            <p>{draft.body || 'Message body will appear here.'}</p>
            {previewBlocks.map((block, index) => {
              if (block.type === 'text') {
                return <p key={`preview-text-${index}`}>{block.text}</p>
              }
              return (
                <figure key={`preview-image-${index}`}>
                  {block.imageUrl && <img src={block.imageUrl} alt={block.caption ?? ''} />}
                  {block.caption && <figcaption>{block.caption}</figcaption>}
                </figure>
              )
            })}
          </article>
        </section>
      </div>
    </div>
  )
}

export default MessageCentreAdminPage
