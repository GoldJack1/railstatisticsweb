/**
 * Import GB Heritage stations from CSV into Firestore `stations_gbheritage`.
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
 *   - FIREBASE_PROJECT_ID=your-project-id (or --project=)
 *
 * Run from repo root:
 *   node scripts/import-gb-heritage-stations.mjs
 *   node scripts/import-gb-heritage-stations.mjs --dry-run
 *   node scripts/import-gb-heritage-stations.mjs --csv=".cursor/Gb Heritage.csv"
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_CSV = path.join(__dirname, '..', '.cursor', 'Gb Heritage.csv')
const COLLECTION = 'stations_gbheritage'

function parseArgs() {
  const args = process.argv.slice(2)
  let projectId = process.env.FIREBASE_PROJECT_ID
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

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function rowToFirestoreDoc(row) {
  const lat = parseFloat(row.latitude)
  const lng = parseFloat(row.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Invalid coordinates for station id ${row.id}: ${row.latitude}, ${row.longitude}`)
  }

  const doc = {
    id: row.id,
    stnarea: row.stnarea || 'GBHERITAGE',
    stationname: row.stationname,
    CrsCode: row.crs || '',
    tiploc: row.tiploc || '',
    country: row.country || '',
    county: row.county || '',
    borough: row.borough || '',
    url: slugify(row.stationname || row.id),
    TOC: row.toc || '',
    location: new admin.firestore.GeoPoint(lat, lng),
    staffingLevel: row.staffingLevel || '',
    nlc: row.nlc || '',
    guage: row.guage || row.gauge || '',
    is: {
      isrequeststop: row.isrequeststop || 'No',
      Islimitedservice: row.islimitedservice || 'No',
    },
  }

  if (row.status || row.operationalperiod) {
    doc.stationstatus = {
      status: row.status || '',
      operationalperiod: row.operationalperiod || '',
    }
  }

  if (row.stepFree) {
    doc.stepFree = { stepFreeCode: row.stepFree }
  }
  if (row.fareZone) {
    doc.fareZone = row.fareZone
  }

  return doc
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
      console.log(JSON.stringify(rowToFirestoreDoc(row), null, 2))
    }
    return
  }

  if (!projectId) {
    console.error('Set FIREBASE_PROJECT_ID or pass --project=your-project-id')
    process.exit(1)
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.')
    process.exit(1)
  }

  admin.apps[0] ?? admin.initializeApp({ projectId })
  const db = admin.firestore()
  const batch = db.batch()

  for (const row of rows) {
    const doc = rowToFirestoreDoc(row)
    const ref = db.collection(COLLECTION).doc(doc.id)
    batch.set(
      ref,
      { ...doc, londonBorough: admin.firestore.FieldValue.delete(), urlSlug: admin.firestore.FieldValue.delete() },
      { merge: true }
    )
    console.log(`  + ${doc.id} ${doc.stationname}`)
  }

  await batch.commit()
  console.log(`Done. Wrote ${rows.length} documents to ${COLLECTION}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
