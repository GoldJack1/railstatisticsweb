#!/usr/bin/env node
/**
 * Set or clear Firebase Auth custom claim `rs_station_editor` for a user.
 * Required for Firestore writes if the user's email is not the default owner email in firestore.rules.
 *
 * After changing claims, the user must get a new ID token (sign out and sign in again).
 *
 * Prerequisites: service account with "Firebase Authentication Admin" (or Editor).
 *
 * Usage:
 *   node scripts/set-rs-station-editor-claim.mjs --email=you@example.com /path/to/serviceAccount.json
 *   node scripts/set-rs-station-editor-claim.mjs --uid=ABC123 /path/to/serviceAccount.json
 *   node scripts/set-rs-station-editor-claim.mjs --email=you@example.com --revoke /path/to/serviceAccount.json
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node scripts/set-rs-station-editor-claim.mjs --email=you@example.com
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'))

const revoke = flags.includes('--revoke')
let emailArg = flags.find((f) => f.startsWith('--email='))?.slice('--email='.length)?.trim()
let uidArg = flags.find((f) => f.startsWith('--uid='))?.slice('--uid='.length)?.trim()

function getCredential() {
  const keyPath = args[0] || process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (keyPath) {
    const absolute = resolve(keyPath)
    const json = JSON.parse(readFileSync(absolute, 'utf8'))
    return cert(json)
  }
  return applicationDefault()
}

initializeApp({ credential: getCredential() })
const auth = getAuth()

if (!emailArg && !uidArg) {
  console.error('Provide --email=user@example.com or --uid=FIREBASE_UID (and optional service account path).')
  process.exit(1)
}

if (emailArg && uidArg) {
  console.error('Use only one of --email or --uid.')
  process.exit(1)
}

let uid = uidArg
if (emailArg) {
  const user = await auth.getUserByEmail(emailArg)
  uid = user.uid
}

const userRecord = await auth.getUser(uid)
const existing = userRecord.customClaims ?? {}

let nextClaims = { ...existing }
if (revoke) {
  delete nextClaims.rs_station_editor
} else {
  nextClaims.rs_station_editor = true
}

await auth.setCustomUserClaims(uid, nextClaims)

console.log(
  revoke
    ? `Removed rs_station_editor for uid=${uid} (${userRecord.email ?? 'no email'}).`
    : `Set rs_station_editor=true for uid=${uid} (${userRecord.email ?? 'no email'}).`
)
console.log('User must sign out and sign in again (or wait for token refresh) before Firestore sees the new claim.')
