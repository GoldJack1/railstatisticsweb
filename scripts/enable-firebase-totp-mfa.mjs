#!/usr/bin/env node
/**
 * Enable TOTP (authenticator app) as an MFA provider for the Firebase / Identity Platform project.
 *
 * Prerequisites:
 * - Firebase Authentication with Identity Platform (upgraded project).
 * - A service account JSON with permission to update Identity Toolkit config (e.g. "Firebase Admin" / Editor).
 *
 * Usage:
 *   node scripts/enable-firebase-totp-mfa.mjs /path/to/serviceAccount.json
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json node scripts/enable-firebase-totp-mfa.mjs
 *   node scripts/enable-firebase-totp-mfa.mjs --dry-run /path/to/serviceAccount.json
 *
 * Optional env:
 *   TOTP_ADJACENT_INTERVALS=5   (0–10, default 5 — clock drift windows)
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
const dryRun = process.argv.includes('--dry-run')

function getCredential() {
  const keyPath = args[0] || process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (keyPath) {
    const absolute = resolve(keyPath)
    const json = JSON.parse(readFileSync(absolute, 'utf8'))
    return cert(json)
  }
  // e.g. after `gcloud auth application-default login` with quota project set
  return applicationDefault()
}

const adjacentIntervals = Math.min(
  10,
  Math.max(0, Number.parseInt(process.env.TOTP_ADJACENT_INTERVALS || '5', 10) || 5)
)

const totpProviderEntry = {
  state: 'ENABLED',
  totpProviderConfig: { adjacentIntervals }
}

function mergeProviderConfigs(existing) {
  if (!Array.isArray(existing) || existing.length === 0) {
    return [totpProviderEntry]
  }
  const others = existing.filter((p) => p.totpProviderConfig == null)
  return [...others, totpProviderEntry]
}

initializeApp({ credential: getCredential() })

const manager = getAuth().projectConfigManager()

try {
  const current = await manager.getProjectConfig()
  const mfa = current.multiFactorConfig

  if (dryRun) {
    console.log('[dry-run] Current multiFactorConfig (from getProjectConfig):')
    console.log(JSON.stringify(mfa ?? null, null, 2))
    console.log('\n[dry-run] Would merge / set TOTP provider with adjacentIntervals:', adjacentIntervals)
    process.exit(0)
  }

  const providerConfigs = mergeProviderConfigs(mfa?.providerConfigs)

  const updated = await manager.updateProjectConfig({
    multiFactorConfig: {
      state: 'ENABLED',
      providerConfigs
    }
  })

  console.log('TOTP MFA provider enabled.')
  console.log('Updated multiFactorConfig:', JSON.stringify(updated.multiFactorConfig ?? null, null, 2))
} catch (err) {
  console.error('Failed:', err.message || err)
  if (err.code) console.error('code:', err.code)
  process.exit(1)
}
