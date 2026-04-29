import React, { useMemo, useState } from 'react'
import type {
  CoachLoadingValue,
  ConsistData,
  FormationCoach,
  FormationData,
  PtacVehicle,
  ServiceStop,
} from '../../../types/darwin'
import './CarriageMap.css'

/**
 * Live carriage map: renders one cell per coach, optionally enriched by
 * three complementary data sources:
 *
 *   1. **Darwin `formation`** (passenger-facing coach class, toilets/catering)
 *   2. **PTAC `consist`** (physical reality: actual unit + vehicle IDs,
 *      seat counts, max speed, brake type, open defects)
 *   3. **Per-stop `coachLoading`** (1-10 enum) and `loadingPercentage` (0-100)
 *      on each `ServiceStop`
 *
 * The component prefers PTAC consist as its primary axis when available
 * (it groups vehicles by unit, which gives a more accurate physical layout
 * for split-portion services). Falls back to Darwin formation, then to a
 * one-line "no formation data" note.
 *
 * The stop picker only renders when at least one stop has loading data
 * published. Loading values are keyed by Darwin coach number; we attempt
 * a best-effort match by position when reconciling against PTAC's vehicle
 * positions.
 */
export const CarriageMap: React.FC<{
  formation: FormationData | null
  consist?: ConsistData | null
  stops: ServiceStop[]
  reverse: boolean
  initialTpl?: string | null
}> = ({ formation, consist, stops, reverse, initialTpl }) => {
  const loadingStops = useMemo(
    () => stops.filter((s) => (s.coachLoading && s.coachLoading.length > 0) || s.loadingPercentage != null),
    [stops]
  )
  const defaultTpl = (initialTpl && loadingStops.find((s) => s.tpl === initialTpl)?.tpl)
    || loadingStops[0]?.tpl
    || null
  const [selectedTpl, setSelectedTpl] = useState<string | null>(defaultTpl)
  const selectedStop = useMemo(
    () => loadingStops.find((s) => s.tpl === selectedTpl) || null,
    [loadingStops, selectedTpl]
  )

  // Decide which data source drives the layout. PTAC wins when present
  // because it groups vehicles into "stages" (legs of the journey), which
  // is more physically accurate than Darwin's single-formation snapshot.
  const stages    = useMemo(() => collectPtacStages(consist), [consist])
  const havePtac    = stages.length > 0
  const haveDarwin  = !!formation && formation.coaches.length > 0

  // Map TIPLOCs to friendly names for the stage headers.
  const tiplocName = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of stops) if (s.tpl && s.name) m.set(s.tpl, s.name)
    return m
  }, [stops])

  if (!havePtac && !haveDarwin) {
    return (
      <div className="cmap-note">
        <strong>No coach formation data for this service.</strong>
        <p>
          Neither Darwin's coach-formation feed nor Network Rail's PTAC feed
          has published a formation for this train yet. Coverage is best
          for SE / XR (Darwin) and SE / NT / TP / SW / GTR / c2c
          (PTAC). Data may arrive as the daemon runs longer.
        </p>
      </div>
    )
  }

  // Build the loading lookup once. Keyed by coach-number string ("1", "A2", etc.)
  const loadingByCoachNumber = new Map<string, CoachLoadingValue>()
  for (const c of selectedStop?.coachLoading || []) loadingByCoachNumber.set(c.number, c)

  // Top-level summary: classes + units present across the whole journey.
  // (Stages may add/remove units en route, but the summary line lists every
  // unit involved at any point — handy for spotting unit swaps at a glance.)
  const summaryBits: Array<{ label: string; value: string }> = []
  if (havePtac) {
    const allUnits  = new Set<string>()
    const allFleets = new Set<string>()
    for (const st of stages) for (const u of st.units) {
      if (u.unitId)  allUnits.add(u.unitId)
      if (u.fleetId) allFleets.add(u.fleetId)
    }
    if (allFleets.size) summaryBits.push({ label: 'Class', value: [...allFleets].join(' + ') })
    if (allUnits.size)  summaryBits.push({ label: 'Unit',  value: [...allUnits].join(' + ') })
    if (stages.length > 1) summaryBits.push({ label: 'Stages', value: String(stages.length) })
    if (consist?.companyDarwin) summaryBits.push({ label: 'TOC', value: consist.companyDarwin })
  }

  return (
    <div className="cmap" aria-label="Carriage formation and loading">
      <div className="cmap-header">
        <div className="cmap-title-group">
          <h3 className="cmap-title">Coach formation</h3>
          {reverse && <span className="cmap-tag">↻ Reversed</span>}
          {havePtac && <span className="cmap-tag cmap-tag--source">PTAC</span>}
        </div>
        {loadingStops.length > 0 && (
          <label className="cmap-stop-picker">
            <span className="cmap-stop-picker-label">Loading at</span>
            <select
              className="cmap-stop-picker-select"
              value={selectedTpl || ''}
              onChange={(e) => setSelectedTpl(e.target.value || null)}
            >
              {loadingStops.map((s) => (
                <option key={s.tpl} value={s.tpl}>
                  {s.name || s.tpl}
                  {s.loadingPercentage != null ? ` — ${s.loadingPercentage}%` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {summaryBits.length > 0 && (
        <ul className="cmap-summary">
          {summaryBits.map((b) => (
            <li key={b.label} className="cmap-summary-item">
              <span className="cmap-summary-label">{b.label}</span>
              <span className="cmap-summary-value">{b.value}</span>
            </li>
          ))}
        </ul>
      )}

      {havePtac
        ? renderPtacStages(stages, formation, loadingByCoachNumber, tiplocName)
        : renderDarwinOnly(formation!, loadingByCoachNumber)}

      {/* Class legend — only show the abbreviations that actually appear
       * in the currently-rendered formation, so we're not teaching the
       * user about K/A on a service that doesn't have either. */}
      <CoachClassLegend stages={stages} formation={formation} />

      {selectedStop?.loadingPercentage != null && (
        <p className="cmap-overall">
          Overall load at <strong>{selectedStop.name || selectedStop.tpl}</strong>:{' '}
          <strong>{selectedStop.loadingPercentage}%</strong>
        </p>
      )}
      {!selectedStop && (
        <p className="cmap-note cmap-note--inline">Live loading not yet published for this service.</p>
      )}
    </div>
  )
}

/* ===========================================================================
 *  Layout helpers — stage-based grouping
 *
 *  PTAC's `Allocation` element describes ONE LEG of the journey (one
 *  contiguous sub-section between split/join/swap points). A train can
 *  have many allocations, in two different shapes:
 *
 *    1. *Coupled working*  — multiple units running together over the
 *       same time range, distinguished by ResourceGroupPosition
 *       (1 = leading, 2 = trailing). All allocations share the same
 *       (allocationOriginDateTime, allocationDestinationDateTime).
 *
 *    2. *Sequential working* / unit swaps — different units operate
 *       different sub-sections, e.g. TPE 1M65: 397008 Edinburgh→Preston
 *       then 397005 Preston→Manchester. Allocations have non-overlapping
 *       time ranges.
 *
 *  We bucket allocations into "stages" by time-overlap. Each stage gets
 *  rendered as one block in the UI, with a "swap at X" separator between
 *  stages so the user can see when the train changes formation en route.
 * ========================================================================= */

interface PtacUnitView {
  unitId: string | null
  fleetId: string | null
  position: number | null
  reversed: boolean
  vehicles: PtacVehicle[]
}

interface PtacStage {
  /** Earliest origin-time across all units in this stage. */
  startDt: string | null
  /** Latest destination-time across all units in this stage. */
  endDt:   string | null
  /** Geographic boundary of this stage (TIPLOCs). */
  startTpl: string | null
  endTpl:   string | null
  /** All units running together over this stage, sorted by leading→trailing. */
  units: PtacUnitView[]
}

/**
 * Bucket the consist's allocations into stages. Two allocations are in the
 * same stage if their time ranges overlap (touch or intersect). Within a
 * stage, units are coupled and sorted by ResourceGroupPosition.
 */
function collectPtacStages(consist: ConsistData | null | undefined): PtacStage[] {
  if (!consist || !consist.allocations?.length) return []

  // Step 1 — flatten to one entry per (allocation × resourceGroup) so we
  // can reason about each unit-leg independently.
  type Leg = {
    unit: PtacUnitView
    startDt: string | null
    endDt:   string | null
    startTpl: string | null
    endTpl:   string | null
  }
  const legs: Leg[] = []
  for (const a of consist.allocations) {
    for (const rg of a.resourceGroups || []) {
      legs.push({
        unit: {
          unitId:   rg.unitId,
          fleetId:  rg.fleetId,
          position: a.resourceGroupPosition,
          reversed: a.reversed,
          vehicles: [...rg.vehicles].sort((x, y) => (x.position ?? 99) - (y.position ?? 99)),
        },
        startDt:  a.allocationOriginDateTime,
        endDt:    a.allocationDestinationDateTime,
        startTpl: a.allocationOrigin?.tiploc      ?? null,
        endTpl:   a.allocationDestination?.tiploc ?? null,
      })
    }
  }

  // Step 2 — collapse same-unit *consecutive* legs (e.g. an allocation
  // broken into Edinburgh→Carlisle, Carlisle→Lancaster, Lancaster→Preston
  // is logically one leg "Edinburgh→Preston" for layout purposes).
  //
  // Important: we must group by (unitId, position, reversed) FIRST and
  // merge within each group. A naive "look at previous entry" approach
  // misses merges when another unit's leg interleaves in start-time
  // order — e.g. Avanti 1A38: 805002@12:32, 805013@12:32, 805002@12:55,
  // where 805002's two legs would never merge because 805013 sits
  // between them in the sorted order.
  const byUnit = new Map<string, Leg[]>()
  for (const leg of legs) {
    const k = `${leg.unit.unitId}|${leg.unit.position}|${leg.unit.reversed ? 'R' : 'F'}`
    let arr = byUnit.get(k)
    if (!arr) { arr = []; byUnit.set(k, arr) }
    arr.push(leg)
  }
  const merged: Leg[] = []
  for (const arr of byUnit.values()) {
    arr.sort((a, b) => (a.startDt || '').localeCompare(b.startDt || ''))
    let acc: Leg | null = null
    for (const leg of arr) {
      if (
        acc &&
        acc.endDt &&
        leg.startDt &&
        // contiguous: previous leg's end is within 5 minutes of this leg's start
        Math.abs(new Date(leg.startDt).getTime() - new Date(acc.endDt).getTime()) <= 5 * 60_000
      ) {
        acc.endDt  = leg.endDt
        acc.endTpl = leg.endTpl
      } else {
        if (acc) merged.push(acc)
        acc = { ...leg }
      }
    }
    if (acc) merged.push(acc)
  }
  merged.sort((a, b) => (a.startDt || '').localeCompare(b.startDt || ''))

  // Step 3 — group merged legs into stages by time-overlap. Two legs share
  // a stage if their (start, end) ranges intersect.
  const stages: PtacStage[] = []
  for (const leg of merged) {
    const ls = new Date(leg.startDt || 0).getTime()
    const le = new Date(leg.endDt   || 0).getTime()
    let target = stages.find((st) => {
      const ss = new Date(st.startDt || 0).getTime()
      const se = new Date(st.endDt   || 0).getTime()
      return Math.max(ss, ls) <= Math.min(se, le)  // overlap
    })
    if (!target) {
      target = {
        startDt:  leg.startDt,
        endDt:    leg.endDt,
        startTpl: leg.startTpl,
        endTpl:   leg.endTpl,
        units: [],
      }
      stages.push(target)
    } else {
      // Stretch the stage to cover this leg too (in case start/end differ slightly)
      if ((leg.startDt || '') < (target.startDt || '\uffff')) { target.startDt = leg.startDt; target.startTpl = leg.startTpl }
      if ((leg.endDt   || '') > (target.endDt   || '')) { target.endDt = leg.endDt; target.endTpl = leg.endTpl }
    }
    target.units.push(leg.unit)
  }

  // Step 4 — merge stages whose time ranges now overlap after expansion.
  // Necessary because Step 3 only checks against pre-expansion ranges, so
  // two stages can end up overlapping if a later leg expands an earlier
  // stage's window. Repeated until no more overlaps remain.
  let merging = true
  while (merging) {
    merging = false
    outer: for (let i = 0; i < stages.length; i++) {
      for (let j = i + 1; j < stages.length; j++) {
        const a = stages[i], b = stages[j]
        const as = new Date(a.startDt || 0).getTime()
        const ae = new Date(a.endDt   || 0).getTime()
        const bs = new Date(b.startDt || 0).getTime()
        const be = new Date(b.endDt   || 0).getTime()
        if (Math.max(as, bs) <= Math.min(ae, be)) {
          if ((b.startDt || '') < (a.startDt || '\uffff')) { a.startDt = b.startDt; a.startTpl = b.startTpl }
          if ((b.endDt   || '') > (a.endDt   || '')) { a.endDt = b.endDt; a.endTpl = b.endTpl }
          a.units.push(...b.units)
          stages.splice(j, 1)
          merging = true
          break outer
        }
      }
    }
  }

  // Step 5 — within each stage, dedupe units that appear more than once
  // (e.g. the same physical unit was published with two different reversed
  // flags or positions because of an internal Allocation split). Prefer
  // the entry whose vehicles list is the longest (most informative).
  for (const s of stages) {
    const seen = new Map<string, PtacUnitView>()
    for (const u of s.units) {
      if (!u.unitId) continue
      const existing = seen.get(u.unitId)
      if (!existing || (u.vehicles.length > existing.vehicles.length)) seen.set(u.unitId, u)
    }
    s.units = [...seen.values()]
  }

  // Sort stages chronologically; within each stage, sort units by position
  // (1 = leading on the left).
  stages.sort((a, b) => (a.startDt || '').localeCompare(b.startDt || ''))
  for (const s of stages) s.units.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  return stages
}

/**
 * Decide whether the boundary between stage `prev` and stage `next` is a
 * full unit swap (different physical units) or just a *reversal* (same
 * units, but their leading positions / reversed flags swapped). The label
 * shown to the user differs between the two cases — reversals stay on the
 * same train, swaps don't.
 */
function classifyStageBoundary(prev: PtacStage, next: PtacStage): 'reversal' | 'swap' {
  const a = new Set(prev.units.map((u) => u.unitId).filter(Boolean) as string[])
  const b = new Set(next.units.map((u) => u.unitId).filter(Boolean) as string[])
  if (a.size === 0 || b.size === 0) return 'swap'
  // If any unit changed → swap. If all units the same → it's a reversal
  // (positions / reversed flags flipped but the formation is unchanged).
  for (const id of a) if (!b.has(id)) return 'swap'
  for (const id of b) if (!a.has(id)) return 'swap'
  return 'reversal'
}

/**
 * Render PTAC stages chronologically. A stage is one leg of the journey
 * (e.g. Edinburgh → Preston) and contains all units coupled together for
 * that section. Multiple stages indicate unit swaps en route — between
 * stages we render a "Unit swap at X" separator so the user understands
 * the formation changes mid-journey.
 *
 * Darwin's formation (if present) is overlaid by 1-based running position
 * across the *first* stage only — that's the most useful slice because
 * Darwin's coach numbering is published once per service, not per stage.
 */
function renderPtacStages(
  stages: PtacStage[],
  darwinFormation: FormationData | null,
  loadingByCoachNumber: Map<string, CoachLoadingValue>,
  tiplocName: Map<string, string>,
): React.ReactNode {
  const darwinByPosition = new Map<number, FormationCoach>()
  if (darwinFormation) {
    darwinFormation.coaches.forEach((c, i) => darwinByPosition.set(i + 1, c))
  }
  return (
    <div className="cmap-stages">
      {stages.map((stage, sIdx) => {
        const startName = stage.startTpl ? (tiplocName.get(stage.startTpl) || stage.startTpl) : null
        const endName   = stage.endTpl   ? (tiplocName.get(stage.endTpl)   || stage.endTpl)   : null
        const startTime = stage.startDt?.slice(11, 16) || null
        const endTime   = stage.endDt?.slice(11, 16)   || null
        const showStageHeader = stages.length > 1
        // Restart Darwin overlay position counter per stage; Darwin formation
        // is only overlaid on the first stage (it's a service-wide snapshot,
        // not per-stage). For later stages we let class fall back to the
        // PTAC vehicle's own RegisteredCategory.
        let running = 0
        return (
          <React.Fragment key={`stage-${sIdx}`}>
            {sIdx > 0 && (() => {
              const kind = classifyStageBoundary(stages[sIdx - 1], stage)
              return (
                <div className={`cmap-stage-swap cmap-stage-swap--${kind}`}>
                  <span className="cmap-stage-swap-icon" aria-hidden="true">
                    {kind === 'reversal' ? '↻' : '↔'}
                  </span>
                  <span className="cmap-stage-swap-text">
                    {kind === 'reversal'
                      ? <>Train reverses at <strong>{startName || stage.startTpl}</strong></>
                      : <>Unit swap at <strong>{startName || stage.startTpl}</strong></>}
                    {startTime ? ` · ${startTime}` : ''}
                  </span>
                </div>
              )
            })()}
            <section className="cmap-stage" aria-label={`Stage ${sIdx + 1}`}>
              {showStageHeader && (
                <header className="cmap-stage-header">
                  <span className="cmap-stage-route">
                    {startName || stage.startTpl || '?'}
                    <span className="cmap-stage-arrow"> → </span>
                    {endName || stage.endTpl || '?'}
                  </span>
                  {(startTime || endTime) && (
                    <span className="cmap-stage-times">{startTime} – {endTime}</span>
                  )}
                </header>
              )}
              <div className="cmap-units">
                {stage.units.map((g, idx) => (
                  <div
                    className={`cmap-unit${g.reversed ? ' cmap-unit--reversed' : ''}`}
                    key={`${g.unitId}-${g.position}-${idx}`}
                  >
                    <div className="cmap-unit-header">
                      <span className="cmap-unit-name">{g.unitId || '—'}</span>
                      {g.fleetId && <span className="cmap-unit-fleet">{g.fleetId}</span>}
                      {g.position != null && <span className="cmap-unit-pos">pos {g.position}</span>}
                      {g.reversed && <span className="cmap-unit-reversed">↻ rev</span>}
                    </div>
                    <ol className="cmap-row cmap-row--unit" role="list">
                      {g.vehicles.map((v) => {
                        running += 1
                        const darwinCoach = sIdx === 0 ? darwinByPosition.get(running) : undefined
                        return renderVehicleCell(v, darwinCoach, loadingByCoachNumber, running)
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          </React.Fragment>
        )
      })}
    </div>
  )
}

/** Fallback Darwin-only rendering for the rare case where Darwin published
 *  formation but PTAC hasn't joined a consist for this RID yet. */
function renderDarwinOnly(
  formation: FormationData,
  loadingByCoachNumber: Map<string, CoachLoadingValue>,
): React.ReactNode {
  return (
    <ol className="cmap-row" role="list">
      {formation.coaches.map((coach) => {
        const v = loadingByCoachNumber.get(coach.number)
        const enumVal = v && Number.isFinite(v.value) ? v.value : null
        return (
          <li
            key={coach.number}
            className={`cmap-coach${enumVal == null ? ' cmap-coach--unknown' : ''}`}
            style={{ backgroundColor: loadFill(enumVal) }}
            title={describeCoach(coach.number, coach.class, enumVal)}
          >
            <span className="cmap-coach-num">{coach.number}</span>
            {coach.class && <span className="cmap-coach-class" title={coach.class}>{classAbbrev(coach.class)}</span>}
            <span className="cmap-coach-load">{enumVal == null ? '—' : `${enumVal}/10`}</span>
            {(coach.toilet || coach.catering) && (
              <span className="cmap-coach-amenities">
                {coach.toilet && coach.toilet !== 'None' && <span title={`Toilet: ${coach.toilet}`}>🚻</span>}
                {coach.catering && <span title={`Catering: ${coach.catering}`}>☕</span>}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * One vehicle cell. Pulls loading by Darwin coach number when we have a
 * matching one, else by stringified PTAC running position.
 */
function renderVehicleCell(
  v: PtacVehicle,
  darwinCoach: FormationCoach | undefined,
  loadingByCoachNumber: Map<string, CoachLoadingValue>,
  runningPosition: number,
): React.ReactNode {
  const coachLabel = darwinCoach?.number ?? String(runningPosition)
  const cls        = darwinCoach?.class ?? null
  const loadingVal = loadingByCoachNumber.get(coachLabel) ?? loadingByCoachNumber.get(String(runningPosition))
  const enumVal = loadingVal && Number.isFinite(loadingVal.value) ? loadingVal.value : null
  const seats   = v.numberOfSeats
  const defects = v.defects?.length || 0
  // Multi-source class detection: Darwin formation (most reliable, but rare),
  // then PTAC SpecificType heuristic. Returns one of:
  //   'first'       — First-only coach
  //   'composite'   — Mixed First + Standard  (sometimes called "Composite")
  //   'kitchen'     — Catering/buffet (often has a First section)
  //   'standard'    — Standard-only (default)
  //   'accessible'  — Reduced-capacity Standard with wheelchair / disabled seating
  const coachClass = inferCoachClass(v, cls)
  const classMeta  = COACH_CLASS_META[coachClass]
  return (
    <li
      key={(v.vehicleId || '') + '-' + runningPosition}
      className={[
        'cmap-coach',
        'cmap-coach--ptac',
        `cmap-coach--class-${coachClass}`,
        enumVal == null ? 'cmap-coach--unknown' : '',
        defects > 0 ? 'cmap-coach--defect' : '',
      ].filter(Boolean).join(' ')}
      style={{ backgroundColor: loadFill(enumVal) }}
      title={[
        `Coach ${coachLabel}`,
        v.vehicleId ? `Vehicle ${v.vehicleId}` : null,
        v.specificType ? `(${v.specificType})` : null,
        `class: ${classMeta.label}`,
        seats != null ? `${seats} seats` : null,
        v.maximumSpeedMph != null ? `${v.maximumSpeedMph} mph` : null,
        v.trainBrakeTypeLabel ? `brake: ${v.trainBrakeTypeLabel}` : null,
        enumVal != null ? `loading: ${enumVal}/10` : null,
        defects > 0 ? `${defects} open defect${defects === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' · ')}
    >
      <span className="cmap-coach-num">{coachLabel}</span>
      <span className="cmap-coach-vid">{v.vehicleId}</span>
      <span className={`cmap-coach-class cmap-coach-class--${coachClass}`} title={classMeta.label}>
        {classMeta.abbrev}
      </span>
      <span className="cmap-coach-load">
        {enumVal == null ? (seats != null ? `${seats}s` : '—') : `${enumVal}/10`}
      </span>
      {(seats != null && enumVal != null) && (
        <span className="cmap-coach-seats">{seats}s</span>
      )}
      {defects > 0 && (
        <span className="cmap-coach-defects" title={v.defects.map((d) => `${d.code}: ${d.description}`).join('\n')}>
          ⚠ {defects}
        </span>
      )}
    </li>
  )
}

/* ===========================================================================
 *  Small visual helpers
 * ========================================================================= */

function classAbbrev(cls: string): string {
  const c = cls.toLowerCase()
  if (c.startsWith('first'))    return 'F'
  if (c.startsWith('standard')) return 'S'
  if (c.includes('composite') || c.includes('mixed')) return 'M'
  return cls.slice(0, 1).toUpperCase()
}

/* ===========================================================================
 *  Coach class detection from PTAC SpecificType + Darwin overlay
 *
 *  PTAC's `SpecificType` field is a TOC-issued code like `DC1030A` or
 *  `EM2300A`. Reverse-engineering across the 21 TOCs we see, the encoding
 *  is consistent enough to mine class info reliably:
 *
 *    Position 1-2 (letters)  — coach role:
 *      DC = Driving Composite (cab + mixed First/Standard)
 *      DM = Driving Motor          DT = Driving Trailer
 *      DD = Driving (intermediate)
 *      DV / DP = Driving Power (DMU)
 *      EC = Electric Composite     EM = Electric Motor
 *      EL = Electric Leading       EA = Electric Articulated
 *      EH = Electric (Trailer Std) ER = Electric (Trailer)
 *      EQ = Electric Driving Std   ES = Electric Standard
 *      EK = Electric Kitchen / catering
 *
 *    Position 3 (digit)      — class capacity hint:
 *      1 = First-class only
 *      2 = Standard
 *      3 = Standard with reduced capacity (accessible / wheelchair)
 *
 *  Composite coaches (mixed First+Standard) are detected when 1-2 = `XC`
 *  AND seat count is in the "mostly Standard with First section" range
 *  (≈40-70 seats). When 1-2 = `XK` it's a kitchen / buffet, often with a
 *  small First class section.
 *
 *  Darwin's formation `class` field, when present (XR / SE only), takes
 *  precedence — it's the authoritative passenger-facing class.
 * ========================================================================= */

type CoachClass = 'first' | 'composite' | 'kitchen' | 'standard' | 'accessible' | 'unknown'

const COACH_CLASS_META: Record<CoachClass, { label: string; abbrev: string }> = {
  first:      { label: 'First class',                      abbrev: 'F' },
  composite:  { label: 'Composite (First + Standard)',     abbrev: 'M' },
  kitchen:    { label: 'Catering / buffet',                abbrev: 'K' },
  standard:   { label: 'Standard class',                   abbrev: 'S' },
  accessible: { label: 'Standard (accessible / wheelchair)', abbrev: 'A' },
  unknown:    { label: 'Class unknown',                    abbrev: '?' },
}

function inferCoachClass(v: PtacVehicle, darwinClass: string | null): CoachClass {
  // 1) Trust Darwin first when it has spoken.
  if (darwinClass) {
    const c = darwinClass.toLowerCase()
    if (c.startsWith('first'))                        return 'first'
    if (c.startsWith('standard'))                     return 'standard'
    if (c.includes('composite') || c.includes('mixed')) return 'composite'
    if (c.includes('catering') || c.includes('buffet')) return 'kitchen'
  }
  // 2) Fall back to PTAC SpecificType pattern matching.
  const sp = (v.specificType || '').toUpperCase()
  const m  = sp.match(/^([A-Z])([A-Z])(\d)/)
  if (!m) return 'unknown'
  const [, p1, p2, digit] = m
  // 3rd char "1" is unambiguous First class across all observed TOCs.
  if (digit === '1') return 'first'
  // 3rd char "3" + 2nd char DC/DD/EM/EL etc → reduced-capacity Standard,
  // which is almost always the accessible/wheelchair coach.
  if (digit === '3') return 'accessible'
  // 2nd char K = Kitchen / buffet across IETs, GTR Class 387, XR Class 345.
  // Often has a small First section but not always; flag distinctly so
  // the UI can show "K".
  if (p2 === 'K') return 'kitchen'
  // 2nd char C with 3rd char 2 = Composite Standard side. The fully-First
  // composite ends are caught by digit === '1' above. So a `XC2…` with
  // ≤ 60 seats is a Composite (mostly Standard with a small First section);
  // ≥ 60 is "Driving Composite Standard" = standard for our purposes.
  if (p2 === 'C' && digit === '2') {
    const seats = v.numberOfSeats ?? 999
    return seats <= 60 ? 'composite' : 'standard'
  }
  // Driving cabs (often the front of an IET / Voyager) sometimes report
  // very low seat counts; without other signal default to standard.
  // Use `p1` to silence the unused-variable warning while keeping it as
  // a documented pivot in case we need TOC-specific overrides later.
  if (p1) return 'standard'
  return 'standard'
}

/**
 * Compact legend showing what each class abbreviation means. Renders only
 * the classes that actually appear in the current formation so we don't
 * pad the UI with irrelevant entries (e.g. no need to explain K on an
 * all-Standard 158 service). Drawn at the bottom of the map, between the
 * coach grid and the loading-summary line.
 */
const CoachClassLegend: React.FC<{
  stages: PtacStage[]
  formation: FormationData | null
}> = ({ stages, formation }) => {
  // Walk every rendered cell to determine which classes are in play.
  const present = new Set<CoachClass>()
  for (const stage of stages) {
    let darwinIdx = 0
    for (const u of stage.units) {
      for (const v of u.vehicles) {
        const darwinCoach = stages[0] === stage ? formation?.coaches[darwinIdx++] : undefined
        present.add(inferCoachClass(v, darwinCoach?.class ?? null))
      }
    }
  }
  // Darwin-only path (no PTAC consist): map the formation's class strings.
  if (stages.length === 0 && formation?.coaches.length) {
    for (const c of formation.coaches) {
      const lc = (c.class || '').toLowerCase()
      if (lc.startsWith('first'))                          present.add('first')
      else if (lc.includes('composite') || lc.includes('mixed')) present.add('composite')
      else if (lc.includes('catering') || lc.includes('buffet')) present.add('kitchen')
      else                                                  present.add('standard')
    }
  }
  // Always include Standard as the baseline so the legend isn't empty for
  // single-class fleets, and stable order: F → M → K → A → S → ?
  const ORDER: CoachClass[] = ['first', 'composite', 'kitchen', 'accessible', 'standard', 'unknown']
  const items = ORDER.filter((k) => present.has(k))
  if (items.length <= 1) return null   // single class — legend adds no value
  return (
    <ul className="cmap-legend" aria-label="Coach class key">
      {items.map((k) => (
        <li key={k} className="cmap-legend-item">
          <span className={`cmap-coach-class cmap-coach-class--${k}`}>{COACH_CLASS_META[k].abbrev}</span>
          <span className="cmap-legend-label">{COACH_CLASS_META[k].label}</span>
        </li>
      ))}
    </ul>
  )
}

function loadFill(enumVal: number | null): string {
  if (enumVal == null) return 'var(--bg-secondary)'
  const t   = Math.max(0, Math.min(1, (enumVal - 1) / 9))
  const hue = Math.round(120 - 120 * t)
  const intensity = 20 + Math.round(t * 50)
  return `color-mix(in srgb, hsl(${hue} 70% 50%) ${intensity}%, var(--bg-secondary))`
}

function describeCoach(number: string, cls: string | null, enumVal: number | null): string {
  if (enumVal == null) return `Coach ${number} (${cls || 'unknown class'}) — no loading data`
  return `Coach ${number} (${cls || 'unknown class'}) — loading ${enumVal}/10`
}

export default CarriageMap
