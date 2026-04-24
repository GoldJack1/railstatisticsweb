export type MessageStatus = 'draft' | 'published' | 'archived'

export type MessageContentBlock = MessageTextBlock | MessageImageBlock

export interface MessageTextBlock {
  type: 'text'
  text: string
}

export interface MessageImageBlock {
  type: 'image'
  imageUrl: string
  caption?: string
}

export interface InAppMessage {
  id: string
  title: string
  body: string
  preview?: string
  topImageUrl?: string
  contentBlocks: MessageContentBlock[]
  status: MessageStatus
  segment: string
  deepLinkTarget: string
  sendPush: boolean
  deleted: boolean
  createdAtMs?: number
  updatedAtMs?: number
}

export interface InAppMessageDraftInput {
  title: string
  body: string
  preview?: string
  topImageUrl?: string
  contentBlocks?: MessageContentBlock[]
  status?: MessageStatus
  segment?: string
  deepLinkTarget?: string
  sendPush?: boolean
  deleted?: boolean
}

const IMAGE_URL_RE = /^https?:\/\//i

const FALLBACK_PREVIEW_LENGTH = 140

const toSingleLine = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const buildMessagePreviewFromBody = (body: string): string =>
  toSingleLine(body).slice(0, FALLBACK_PREVIEW_LENGTH)

export const normalizeMessageDraftInput = (input: InAppMessageDraftInput): InAppMessageDraftInput => {
  const normalizedBody = input.body.trim()
  const normalizedTitle = input.title.trim()
  const normalizedPreview = input.preview?.trim() || buildMessagePreviewFromBody(normalizedBody)
  const normalizedTopImageUrl = input.topImageUrl?.trim() || undefined
  const normalizedContentBlocks = (input.contentBlocks ?? []).map((block) => {
    if (block.type === 'text') {
      return {
        type: 'text',
        text: block.text.trim()
      } satisfies MessageTextBlock
    }
    return {
      type: 'image',
      imageUrl: block.imageUrl.trim(),
      caption: block.caption?.trim() || undefined
    } satisfies MessageImageBlock
  })

  return {
    ...input,
    title: normalizedTitle,
    body: normalizedBody,
    preview: normalizedPreview,
    topImageUrl: normalizedTopImageUrl,
    contentBlocks: normalizedContentBlocks,
    status: input.status ?? 'draft',
    segment: input.segment ?? 'messaging',
    deepLinkTarget: input.deepLinkTarget ?? 'message_center',
    sendPush: input.sendPush ?? false,
    deleted: input.deleted ?? false
  }
}

export const validateMessageDraftInput = (input: InAppMessageDraftInput): string[] => {
  const errors: string[] = []
  const normalized = normalizeMessageDraftInput(input)

  if (!normalized.title) errors.push('Title is required.')
  if (!normalized.body) errors.push('Body is required.')
  if (normalized.status && !['draft', 'published', 'archived'].includes(normalized.status)) {
    errors.push('Status is invalid.')
  }
  if (normalized.topImageUrl && !IMAGE_URL_RE.test(normalized.topImageUrl)) {
    errors.push('Top image URL must start with http:// or https://.')
  }

  for (const [index, block] of (normalized.contentBlocks ?? []).entries()) {
    if (block.type === 'text' && !block.text) {
      errors.push(`Text block ${index + 1} must not be empty.`)
    }
    if (block.type === 'image' && !IMAGE_URL_RE.test(block.imageUrl)) {
      errors.push(`Image block ${index + 1} must have a valid image URL.`)
    }
  }

  return errors
}
