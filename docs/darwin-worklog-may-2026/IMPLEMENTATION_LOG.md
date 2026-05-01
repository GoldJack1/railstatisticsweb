# Implementation Log - Units + Service Flows

## Scope

This file captures app-side changes implemented in this chat.

## Files touched

- `src/pages/UnitsInServicePage/UnitsInServicePage.tsx`
- `src/pages/UnitLookupPage/UnitLookupPage.tsx`
- `src/pages/UnitLookupPage/UnitLookupPage.css`
- `src/pages/ServiceDetailPage/ServiceDetailPage.tsx` (temporary additions later removed)
- `src/pages/ServiceDetailPage/ServiceDetailPage.css` (temporary additions later removed)
- `src/hooks/useUnitDetail.ts`

## Implemented changes

## 1) Day selection persistence

- `/units` day filter uses `unitDay` in URL query.
- `/units/:unitId` also uses `unitDay` query.
- Navigation preserves day selection where appropriate.

## 2) Unit detail Services card enrichment

- Service cards now show:
  - origin time + origin location
  - destination location + destination time
- In all-days mode, date is shown in card description.

## 3) Unit detail day selector availability

- Day selector is shown whenever unit data is loaded, not only in Overview.

## 4) Service detail page correction

- Removed unintended unit-day selector from `ServiceDetailPage`.

## 5) Per-day unit mileage section

- Added dedicated "Per-day unit mileage" section to unit detail Overview.
- Sources:
  - Primary: `endOfDayMileageByDate`
  - Fallback: snapshot `endOfDayMiles` from service allocations
- Snapshot-only rows are labeled `(snapshot)`.

## 6) Auto-loading snapshot mileage across days

- Added background prefetch for missing day mileage snapshots.
- Merges snapshot-only day rows into the all-days list.
- Added attempted-day tracking to avoid repeated fetch loops.

## 7) Per-day mileage difference

- Added day-to-day delta column:
  - `+X mi`, `-X mi`, `0 mi`, or `—` (no comparator)

## 8) Default day behavior

- Unit detail defaults to current UK day on first load.
- `All days in collection` is explicit via query (`unitDay=all`).

## 9) Unit detail loading splash

- Added spinner splash state while `status === loading && !data`.

## 10) First-load performance improvements

- `useUnitDetail` now has short-lived in-memory cache.
- Latest service fetch is lazy (Service/Logs tabs).
- Catalog fetch is deferred and runs after main detail load.
- Background snapshot enrichment no longer thrashes.
