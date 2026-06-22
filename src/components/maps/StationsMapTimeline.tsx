import { useCallback, useEffect, useMemo, type CSSProperties } from 'react'
import { BUTWideButton } from '../buttons'
import {
  buildSuperTramTimelineSteps,
  countStationsVisibleAtTimelineCutoff,
  formatTimelineDate,
  type SuperTramTimelineStep,
} from '../../utils/superTramTimeline'
import type { Station } from '../../types'
import './StationsMapTimeline.css'

const AUTO_PLAY_INTERVAL_MS = 900

interface StationsMapTimelineProps {
  stations: Station[]
  stepIndex: number
  onStepIndexChange: (index: number) => void
  isPlaying: boolean
  onPlayingChange: (playing: boolean) => void
}

function getCutoffForStep(steps: SuperTramTimelineStep[], index: number): number | null {
  if (steps.length === 0) return null
  const clamped = Math.max(0, Math.min(index, steps.length - 1))
  return steps[clamped].cutoffMs
}

export function StationsMapTimeline({
  stations,
  stepIndex,
  onStepIndexChange,
  isPlaying,
  onPlayingChange,
}: StationsMapTimelineProps) {
  const steps = useMemo(() => buildSuperTramTimelineSteps(stations), [stations])
  const maxIndex = Math.max(0, steps.length - 1)
  const clampedIndex = steps.length === 0 ? 0 : Math.max(0, Math.min(stepIndex, maxIndex))
  const cutoffMs = getCutoffForStep(steps, clampedIndex)
  const showUndatedAtMax = clampedIndex >= maxIndex

  const visibleCount = useMemo(
    () => countStationsVisibleAtTimelineCutoff(stations, cutoffMs, showUndatedAtMax),
    [stations, cutoffMs, showUndatedAtMax]
  )

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return

    if (clampedIndex >= maxIndex) {
      onPlayingChange(false)
      return
    }

    const timer = window.setTimeout(() => {
      const next = clampedIndex + 1
      onStepIndexChange(next)
      if (next >= maxIndex) {
        onPlayingChange(false)
      }
    }, AUTO_PLAY_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [isPlaying, clampedIndex, maxIndex, steps.length, onStepIndexChange, onPlayingChange])

  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onPlayingChange(false)
      onStepIndexChange(Number(event.target.value))
    },
    [onStepIndexChange, onPlayingChange]
  )

  const handlePlayToggle = useCallback(() => {
    if (isPlaying) {
      onPlayingChange(false)
      return
    }
    if (clampedIndex >= maxIndex) {
      onStepIndexChange(0)
    }
    onPlayingChange(true)
  }, [isPlaying, clampedIndex, maxIndex, onStepIndexChange, onPlayingChange])

  const handleRestart = useCallback(() => {
    onPlayingChange(false)
    onStepIndexChange(0)
  }, [onStepIndexChange, onPlayingChange])

  if (steps.length === 0) {
    return (
      <section className="stations-map-timeline" aria-label="Network opening timeline">
        <h2 className="stations-map-timeline__title">Opening timeline</h2>
        <p className="stations-map-timeline__empty">No opening dates are available for this network.</p>
      </section>
    )
  }

  const currentLabel = cutoffMs != null ? formatTimelineDate(cutoffMs) : '—'
  const sliderPercent = maxIndex === 0 ? 100 : (clampedIndex / maxIndex) * 100

  return (
    <section className="stations-map-timeline" aria-label="Network opening timeline">
      <div className="stations-map-timeline__header">
        <h2 className="stations-map-timeline__title">Opening timeline</h2>
        <p className="stations-map-timeline__meta">
          {visibleCount} of {stations.length} stops visible
        </p>
      </div>

      <div className="stations-map-timeline__date-row">
        <time
          className="stations-map-timeline__date"
          dateTime={cutoffMs != null ? new Date(cutoffMs).toISOString() : undefined}
        >
          {currentLabel}
        </time>
        <span className="stations-map-timeline__step">
          {clampedIndex + 1} / {steps.length}
        </span>
      </div>

      <div className="stations-map-timeline__slider-wrap">
        <input
          type="range"
          className="stations-map-timeline__slider"
          min={0}
          max={maxIndex}
          step={1}
          value={clampedIndex}
          onChange={handleSliderChange}
          aria-valuemin={0}
          aria-valuemax={maxIndex}
          aria-valuenow={clampedIndex}
          aria-valuetext={currentLabel}
          style={{ '--timeline-progress': `${sliderPercent}%` } as CSSProperties}
        />
        <div className="stations-map-timeline__range-labels">
          <span>{steps[0].label}</span>
          <span>{steps[steps.length - 1].label}</span>
        </div>
      </div>

      <div className="stations-map-timeline__actions">
        <BUTWideButton type="button" width="fill" onClick={handlePlayToggle} aria-pressed={isPlaying}>
          {isPlaying ? 'Pause' : clampedIndex >= maxIndex ? 'Replay' : 'Play'}
        </BUTWideButton>
        <BUTWideButton type="button" width="fill" colorVariant="primary" onClick={handleRestart}>
          From start
        </BUTWideButton>
      </div>
    </section>
  )
}

export default StationsMapTimeline
