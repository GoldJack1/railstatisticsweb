/**
 * Export all South Yorkshire SuperTram stops from Firestore, sort by StopName A–Z,
 * and reassign document IDs (0001, 0002, …) to match that order.
 *
 * Prerequisites (one of):
 *   - GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
 *   - Firebase CLI login with application default credentials
 *
 * Run from repo root:
 *   node scripts/export-and-reorder-supertram-ids.mjs --dry-run
 *   node scripts/export-and-reorder-supertram-ids.mjs
 *   node scripts/export-and-reorder-supertram-ids.mjs --export-only
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COLLECTION = 'lightrail_GBSHEFFSUPERTRAM'
const TEMP_PREFIX = '__reorder_temp__'

function parseArgs() {
  const args = process.argv.slice(2)
  let projectId = process.env.FIREBASE_PROJECT_ID ?? 'rail-statistics'
  let dryRun = false
  let exportOnly = false
  let outDir = path.join(__dirname, '..', '.cursor')
  for (const arg of args) {
    if (arg.startsWith('--project=')) projectId = arg.slice('--project='.length)
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--export-only') exportOnly = true
    else if (arg.startsWith('--out-dir=')) outDir = arg.slice('--out-dir='.length)
  }
  return { projectId, dryRun, exportOnly, outDir }
}

function formatStopId(index) {
  return String(index).padStart(4, '0')
}

function getStopName(data) {
  return String(data.StopName ?? data.stopName ?? '').trim()
}

function serializeValue(value) {
  if (value instanceof admin.firestore.GeoPoint) {
    return { _type: 'geopoint', latitude: value.latitude, longitude: value.longitude }
  }
  if (value instanceof admin.firestore.Timestamp) {
    return { _type: 'timestamp', iso: value.toDate().toISOString() }
  }
  if (Array.isArray(value)) return value.map(serializeValue)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v)
    return out
  }
  return value
}

function initFirebase(projectId) {
  if (admin.apps[0]) return admin.firestore()

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ projectId })
    return admin.firestore()
  }

  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  })
  return admin.firestore()
}

async function fetchAllDocs(db) {
  const snap = await db.collection(COLLECTION).get()
  return snap.docs.map((doc) => ({
    oldId: doc.id,
    data: doc.data(),
  }))
}

function buildReorderPlan(docs) {
  const sorted = [...docs].sort((a, b) =>
    getStopName(a.data).localeCompare(getStopName(b.data), 'en', { sensitivity: 'base' })
  )

  return sorted.map((entry, index) => {
    const newId = formatStopId(index + 1)
    const data = { ...entry.data, id: newId }
    return {
      oldId: entry.oldId,
      newId,
      stopName: getStopName(entry.data),
      data,
    }
  })
}

function writeExportFiles(outDir, plan, rawDocs) {
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const exportPath = path.join(outDir, `supertram-export-${stamp}.json`)
  const mappingPath = path.join(outDir, `supertram-id-mapping-${stamp}.json`)

  const exportPayload = {
    collection: COLLECTION,
    exportedAt: new Date().toISOString(),
    count: rawDocs.length,
    documents: rawDocs.map((d) => ({
      documentId: d.oldId,
      stopName: getStopName(d.data),
      data: serializeValue(d.data),
    })),
  }

  const mappingPayload = {
    collection: COLLECTION,
    exportedAt: new Date().toISOString(),
    sortedBy: 'StopName A-Z',
    mappings: plan.map((p) => ({
      stopName: p.stopName,
      oldDocumentId: p.oldId,
      newDocumentId: p.newId,
      changed: p.oldId !== p.newId,
    })),
  }

  fs.writeFileSync(exportPath, JSON.stringify(exportPayload, null, 2))
  fs.writeFileSync(mappingPath, JSON.stringify(mappingPayload, null, 2))

  return { exportPath, mappingPath }
}

async function commitInBatches(db, ops, label) {
  const BATCH_LIMIT = 400
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    for (const op of ops.slice(i, i + BATCH_LIMIT)) op(batch)
    await batch.commit()
    console.log(`  ${label}: committed ${Math.min(i + BATCH_LIMIT, ops.length)} / ${ops.length}`)
  }
}

async function applyReorder(db, plan, dryRun) {
  const changes = plan.filter((p) => p.oldId !== p.newId)
  const idFieldUpdates = plan.filter((p) => p.oldId === p.newId && p.data.id !== p.newId)

  console.log(`Total stops: ${plan.length}`)
  console.log(`ID moves needed: ${changes.length}`)
  console.log(`In-place id field updates: ${idFieldUpdates.length}`)

  if (dryRun) {
    console.log('\nDry run — planned mapping (oldId -> newId):')
    for (const p of plan) {
      const marker = p.oldId === p.newId ? '=' : '->'
      console.log(`  ${p.oldId} ${marker} ${p.newId}  ${p.stopName}`)
    }
    return
  }

  const tempOps = changes.map((p) => (batch) => {
    const tempId = `${TEMP_PREFIX}${p.newId}`
    batch.set(db.collection(COLLECTION).doc(tempId), p.data)
  })
  if (tempOps.length > 0) {
    console.log('Phase 1: writing temp documents...')
    await commitInBatches(db, tempOps, 'temp writes')
  }

  const deleteOldOps = changes.map((p) => (batch) => {
    batch.delete(db.collection(COLLECTION).doc(p.oldId))
  })
  if (deleteOldOps.length > 0) {
    console.log('Phase 2: deleting old documents that are moving...')
    await commitInBatches(db, deleteOldOps, 'old deletes')
  }

  const finalOps = []
  for (const p of plan) {
    if (p.oldId !== p.newId) {
      finalOps.push((batch) => {
        batch.set(db.collection(COLLECTION).doc(p.newId), p.data)
        batch.delete(db.collection(COLLECTION).doc(`${TEMP_PREFIX}${p.newId}`))
      })
    } else if (p.data.id !== p.newId) {
      finalOps.push((batch) => {
        batch.set(db.collection(COLLECTION).doc(p.newId), p.data, { merge: true })
      })
    }
  }
  if (finalOps.length > 0) {
    console.log('Phase 3: writing final documents and cleaning temp docs...')
    await commitInBatches(db, finalOps, 'final writes')
  }

  const staleIds = new Set(plan.map((p) => p.newId))
  const allSnap = await db.collection(COLLECTION).get()
  const orphans = allSnap.docs.filter((d) => {
    if (d.id.startsWith(TEMP_PREFIX)) return true
    if (!staleIds.has(d.id) && !plan.some((p) => p.oldId === d.id && p.oldId === p.newId)) {
      return !plan.some((p) => p.newId === d.id)
    }
    return false
  })

  const orphanDeletes = orphans
    .filter((d) => d.id.startsWith(TEMP_PREFIX) || !staleIds.has(d.id))
    .map((d) => (batch) => batch.delete(d.ref))

  if (orphanDeletes.length > 0) {
    console.log(`Phase 4: removing ${orphanDeletes.length} stale/temp documents...`)
    await commitInBatches(db, orphanDeletes, 'cleanup')
  }
}

async function main() {
  const { projectId, dryRun, exportOnly, outDir } = parseArgs()

  console.log(`Project: ${projectId}`)
  console.log(`Collection: ${COLLECTION}`)

  const db = initFirebase(projectId)
  const rawDocs = await fetchAllDocs(db)

  if (rawDocs.length === 0) {
    console.error('No documents found in collection.')
    process.exit(1)
  }

  const plan = buildReorderPlan(rawDocs)
  const { exportPath, mappingPath } = writeExportFiles(outDir, plan, rawDocs)

  console.log(`Exported raw data: ${exportPath}`)
  console.log(`Exported ID mapping: ${mappingPath}`)

  if (exportOnly) {
    console.log('Export only — skipping Firestore reorder.')
    return
  }

  await applyReorder(db, plan, dryRun)

  if (!dryRun) {
    console.log('Done. SuperTram document IDs now follow StopName A–Z order.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
