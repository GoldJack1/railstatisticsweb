/**
 * Import South Yorkshire SuperTram stops from CSV into Firestore `lightrail_GBSHEFFSUPERTRAM`.
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
 *   - FIREBASE_PROJECT_ID=rail-statistics (or --project=)
 *
 * Run from repo root:
 *   node scripts/import-sheff-supertram-stops.mjs
 *   node scripts/import-sheff-supertram-stops.mjs --dry-run
 *   node scripts/import-sheff-supertram-stops.mjs --csv=".cursor/SHEFFSUPERTRAMSTOPS.csv"
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_CSV = path.join(__dirname, '..', '.cursor', 'SHEFFSUPERTRAMSTOPS.csv')
const COLLECTION = 'lightrail_GBSHEFFSUPERTRAM'

function parseArgs() {
  const args = process.argv.slice(2)
  let projectId = process.env.FIREBASE_PROJECT_ID ?? 'rail-statistics'
  let csvPath = DEFAULT_CSV
  let dryRun = false
  for (const arg of args) {
    if (arg.startsWith('--project=')) projectId = arg.slice('--project='.length)
    else if (arg.startsWith('--csv=')) csvPath = arg.slice('--csv='.length)
    else if (arg === '--dry-run') dryRun = true
  }
  return { projectId, csvPath, dryRun }
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    /** @type {Record<string, string>} */
    const row = {}
    headers.forEach((header, i) => {
      row[header] = values[i] ?? ''
    })
    return row
  })
}

/** CSV headers stored under website field names instead of the CSV column name. */
const WEBSITE_FIELD_HEADERS = new Set(['Id', 'STNAREA', 'Country', 'County', 'Borough'])

function formatStopId(rawId) {
  const trimmed = String(rawId ?? '').trim()
  if (!trimmed) throw new Error('Missing Id in CSV row')
  const numeric = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid Id in CSV row: ${rawId}`)
  }
  return String(numeric).padStart(4, '0')
}

function rowToFirestoreDoc(row) {
  const lat = parseFloat(row.Latitude)
  const lng = parseFloat(row.Longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Invalid coordinates for stop id ${row.Id}: ${row.Latitude}, ${row.Longitude}`)
  }

  const id = formatStopId(row.Id)

  /** @type {Record<string, unknown>} */
  const doc = {
    id,
    stnarea: row.STNAREA || 'GBSHEFFSUPERTRAM',
    country: row.Country || '',
    county: row.County || '',
    borough: row.Borough || '',
  }

  for (const [header, value] of Object.entries(row)) {
    if (
      header === 'Latitude' ||
      header === 'Longitude' ||
      WEBSITE_FIELD_HEADERS.has(header)
    ) {
      continue
    }
    if (String(value ?? '').trim() !== '') doc[header] = value
  }

  doc.location = new admin.firestore.GeoPoint(lat, lng)
  return { id, doc }
}

async function main() {
  const { projectId, csvPath, dryRun } = parseArgs()

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  if (rows.length === 0) {
    console.error('No data rows found in CSV.')
    process.exit(1)
  }

  console.log(`Collection: ${COLLECTION}`)
  console.log(`CSV: ${csvPath}`)
  console.log(`Rows: ${rows.length}`)
  if (dryRun) {
    console.log('Dry run — documents that would be written:')
    for (const row of rows) {
      const { id, doc } = rowToFirestoreDoc(row)
      console.log(
        JSON.stringify(
          {
            id,
            ...doc,
            location: { latitude: doc.location.latitude, longitude: doc.location.longitude },
          },
          null,
          2
        )
      )
    }
    return
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.')
    process.exit(1)
  }

  admin.apps[0] ?? admin.initializeApp({ projectId })
  const db = admin.firestore()
  const batch = db.batch()

  for (const row of rows) {
    const { id, doc } = rowToFirestoreDoc(row)
    const ref = db.collection(COLLECTION).doc(id)
    batch.set(ref, doc, { merge: true })
    const rawId = String(row.Id ?? '').trim()
    if (rawId && rawId !== id) {
      batch.delete(db.collection(COLLECTION).doc(rawId))
      console.log(`  - ${rawId} (replaced by ${id})`)
    }
    console.log(`  + ${id} ${doc.StopName ?? doc.stopName ?? ''}`)
  }

  await batch.commit()
  console.log(`Done. Wrote ${rows.length} documents to ${COLLECTION}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
