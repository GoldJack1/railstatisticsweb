import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type Firestore
} from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseApp, initializeFirebase } from './firebase'
import type { InAppMessage, InAppMessageDraftInput, MessageStatus } from '../types/messages'
import { normalizeMessageDraftInput, validateMessageDraftInput } from '../types/messages'

const IN_APP_MESSAGES_COLLECTION = 'inAppMessages'
const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_MIME_PREFIX = 'image/'

const toMs = (value: unknown): number | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as { toMillis?: () => number }
  return typeof candidate.toMillis === 'function' ? candidate.toMillis() : undefined
}

const mapMessageDoc = (id: string, data: DocumentData): InAppMessage => {
  const contentBlocks = Array.isArray(data.contentBlocks) ? data.contentBlocks : []
  return {
    id,
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    preview: typeof data.preview === 'string' ? data.preview : undefined,
    topImageUrl: typeof data.topImageUrl === 'string' ? data.topImageUrl : undefined,
    contentBlocks: contentBlocks
      .map((block) => {
        if (!block || typeof block !== 'object') return null
        if (block.type === 'text') {
          return { type: 'text', text: String(block.text ?? '') } as const
        }
        if (block.type === 'image') {
          const urlValue = typeof block.imageUrl === 'string' ? block.imageUrl : block.url
          if (typeof urlValue !== 'string') return null
          return {
            type: 'image',
            imageUrl: urlValue,
            caption: typeof block.caption === 'string' ? block.caption : undefined
          } as const
        }
        return null
      })
      .filter((block): block is NonNullable<typeof block> => block !== null),
    status: data.status === 'published' || data.status === 'archived' ? data.status : 'draft',
    segment: typeof data.segment === 'string' ? data.segment : 'messaging',
    deepLinkTarget: typeof data.deepLinkTarget === 'string' ? data.deepLinkTarget : 'message_center',
    sendPush: data.sendPush !== false,
    deleted: Boolean(data.deleted),
    createdAtMs: toMs(data.createdAt),
    updatedAtMs: toMs(data.updatedAt)
  }
}

const ensureFirestore = async (): Promise<Firestore> => {
  const initialized = await initializeFirebase()
  if (!initialized.db) throw new Error('Firestore is not available.')
  return initialized.db
}

const buildMessagePayload = (input: InAppMessageDraftInput): Record<string, unknown> => {
  const normalized = normalizeMessageDraftInput(input)
  const errors = validateMessageDraftInput(normalized)
  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }

  return {
    title: normalized.title,
    body: normalized.body,
    preview: normalized.preview,
    topImageUrl: normalized.topImageUrl ?? null,
    contentBlocks: normalized.contentBlocks ?? [],
    status: normalized.status ?? 'draft',
    segment: normalized.segment ?? 'messaging',
    deepLinkTarget: normalized.deepLinkTarget ?? 'message_center',
    sendPush: normalized.sendPush ?? false,
    deleted: normalized.deleted ?? false,
    updatedAt: serverTimestamp()
  }
}

export const listInAppMessages = async (options?: {
  status?: MessageStatus | 'all'
  search?: string
}): Promise<InAppMessage[]> => {
  const db = await ensureFirestore()
  const col = collection(db, IN_APP_MESSAGES_COLLECTION)
  const constraints = []
  if (options?.status && options.status !== 'all') {
    constraints.push(where('status', '==', options.status))
  }
  constraints.push(orderBy('createdAt', 'desc'))

  const snapshot = await getDocs(query(col, ...constraints))
  const searchTerm = options?.search?.trim().toLowerCase() ?? ''
  return snapshot.docs
    .map((docSnap) => mapMessageDoc(docSnap.id, docSnap.data()))
    .filter((item) => {
      if (!searchTerm) return true
      return (
        item.title.toLowerCase().includes(searchTerm) ||
        (item.preview ?? '').toLowerCase().includes(searchTerm) ||
        item.body.toLowerCase().includes(searchTerm)
      )
    })
}

export const getInAppMessage = async (messageId: string): Promise<InAppMessage | null> => {
  const db = await ensureFirestore()
  const snapshot = await getDoc(doc(db, IN_APP_MESSAGES_COLLECTION, messageId))
  if (!snapshot.exists()) return null
  return mapMessageDoc(snapshot.id, snapshot.data())
}

export const createInAppMessageDraft = async (input: InAppMessageDraftInput): Promise<string> => {
  const db = await ensureFirestore()
  const payload = buildMessagePayload({ ...input, status: input.status ?? 'draft' })
  const refSnap = await addDoc(collection(db, IN_APP_MESSAGES_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp()
  })
  return refSnap.id
}

export const updateInAppMessage = async (messageId: string, input: InAppMessageDraftInput): Promise<void> => {
  const db = await ensureFirestore()
  const payload = buildMessagePayload(input)
  await updateDoc(doc(db, IN_APP_MESSAGES_COLLECTION, messageId), payload)
}

export const publishInAppMessage = async (messageId: string, input: InAppMessageDraftInput): Promise<void> => {
  await updateInAppMessage(messageId, {
    ...input,
    status: 'published',
    segment: 'messaging',
    deepLinkTarget: 'message_center',
    sendPush: true,
    deleted: false
  })
}

export const archiveInAppMessage = async (messageId: string): Promise<void> => {
  const db = await ensureFirestore()
  await updateDoc(doc(db, IN_APP_MESSAGES_COLLECTION, messageId), {
    status: 'archived',
    deleted: true,
    updatedAt: serverTimestamp()
  })
}

export const deleteInAppMessage = async (messageId: string): Promise<void> => {
  const db = await ensureFirestore()
  await deleteDoc(doc(db, IN_APP_MESSAGES_COLLECTION, messageId))
}

export const uploadMessageCentreImage = async (file: File): Promise<string> => {
  if (!file.type.startsWith(ACCEPTED_IMAGE_MIME_PREFIX)) {
    throw new Error('Only image files are supported.')
  }
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new Error('Image file is too large. Max size is 10MB.')
  }

  await initializeFirebase()
  const app = getFirebaseApp()
  if (!app) throw new Error('Firebase app is not initialized.')
  const storage = getStorage(app)
  const now = new Date()
  const yyyy = String(now.getUTCFullYear())
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectPath = `message-centre/${yyyy}/${mm}/${crypto.randomUUID()}-${safeFilename}`
  const objectRef = ref(storage, objectPath)
  await uploadBytes(objectRef, file)
  return getDownloadURL(objectRef)
}

export const isInAppMessagesCollectionReady = async (): Promise<boolean> => {
  try {
    await ensureFirestore()
    return true
  } catch {
    return false
  }
}

export const getInAppMessagesCollectionName = (): string => IN_APP_MESSAGES_COLLECTION

// Avoid tree-shaking this import for some strict bundlers.
void getFirestore
