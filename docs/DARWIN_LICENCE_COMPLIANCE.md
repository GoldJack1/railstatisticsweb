# Darwin Licence Compliance Checklist

This document captures the practical controls we apply for Darwin/PTAC datasets
used by Rail Statistics.

## Scope

- Darwin Real Time Train Information (`P-d3bf124c-1058-4040-8a62-87181a877d59`)
- Darwin Timetable Files (`P-9ca6bc7e-62e1-44d6-b93a-1616f7d2caf8`)
- NWR Passenger Train Allocation and Consist (`P-3a2ccb58-e1f9-416b-a40e-0614d0269ecf`)

## Required Attribution

When Darwin/PTAC data is published in app/site outputs, include:

`Contains public sector information licensed under the Open Government Licence v3.0.`

Implemented in UI via `src/components/darwin/DataLicenceAttribution.tsx`.

## Territorial Restrictions

- Darwin Real Time Train Information: UK territory in Schedule 1.
- Proxy support for UK-only gating is implemented in
  `netlify/functions/darwin-proxy.mjs` behind `DARWIN_UK_ONLY=true`.
- Country detection headers checked: `x-country`, `cf-ipcountry`,
  `x-vercel-ip-country`, `x-nf-geo-country`.

## Timetable Files Handling

- Timetable files are used internally for daemon indexing and service assembly.
- They are not exposed as direct public file downloads from the web app.
- Public APIs return processed board/service payloads, not raw source files.

## Security and Access

- Browser clients do not receive the Darwin API key.
- `netlify/functions/darwin-proxy.mjs` injects `X-API-Key` server-side.
- VM daemon supports internal API-key auth for direct access protection.

## Operational Checks

- Ensure attribution is visible on Darwin-facing pages.
- Keep `DARWIN_UK_ONLY` enabled in production if UK-only enforcement is required.
- Confirm no endpoint serves raw timetable files.
- Re-check licence terms after each contract renewal/update.
