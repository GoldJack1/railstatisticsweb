import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BUTBaseButton, { type ButtonColorVariant } from '../base/BUTBaseButton/BUTBaseButton'
import './BUTDDMList.css'

type DDMSelectionMode = 'single' | 'multi'
type DDMBottomType = 'spacer20' | 'clearAll40' | 'clearAllSelectAll40'

interface BUTDDMListBaseProps {
  items: string[]
  filterName?: string
  selectionMode?: DDMSelectionMode
  selectedPositions?: number[]
  disabledPositions?: number[]
  colorVariant?: ButtonColorVariant
  bottomType: DDMBottomType
  clearAllLabel?: string
  selectAllLabel?: string
  className?: string
  onSelectionChanged?: (selectedPositions: number[], selectedItems: string[]) => void
}

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6,3 11,8 6,13" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 8,11 13,6" />
  </svg>
)

const BUTDDMListBase: React.FC<BUTDDMListBaseProps> = ({
  items,
  filterName,
  selectionMode = 'single',
  selectedPositions = [],
  disabledPositions = [],
  colorVariant = 'primary',
  bottomType,
  clearAllLabel = 'Clear All',
  selectAllLabel = 'Select All',
  className = '',
  onSelectionChanged,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [uncontrolledSelectedSet, setUncontrolledSelectedSet] = useState<Set<number>>(
    new Set(selectedPositions)
  )
  const [scrollbarThumbTop, setScrollbarThumbTop] = useState(0)
  const [scrollbarThumbHeight, setScrollbarThumbHeight] = useState(0)
  const [showCustomScrollbar, setShowCustomScrollbar] = useState(false)
  const listViewportRef = useRef<HTMLDivElement | null>(null)
  const scrollbarRailRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ active: boolean; pointerId: number | null; grabOffset: number }>({
    active: false,
    pointerId: null,
    grabOffset: 0,
  })
  const isControlled = typeof onSelectionChanged === 'function'
  const selectedSet = useMemo(
    () => (isControlled ? new Set(selectedPositions) : uncontrolledSelectedSet),
    [isControlled, selectedPositions, uncontrolledSelectedSet]
  )

  const disabledSet = useMemo(() => new Set(disabledPositions), [disabledPositions])
  const orderedSelectedPositions = useMemo(
    () => Array.from(selectedSet).sort((a, b) => a - b),
    [selectedSet]
  )

  useEffect(() => {
    if (isControlled) return
    setUncontrolledSelectedSet((prev) => {
      const trimmed = new Set<number>()
      for (const index of prev) {
        if (index >= 0 && index < items.length) trimmed.add(index)
      }
      return trimmed
    })
  }, [isControlled, items])

  useEffect(() => {
    if (selectionMode !== 'single') return
    if (isControlled) return
    setUncontrolledSelectedSet((prev) => {
      if (prev.size <= 1) return prev
      const [first] = Array.from(prev).sort((a, b) => a - b)
      return new Set(typeof first === 'number' ? [first] : [])
    })
  }, [isControlled, selectionMode])

  const selectedCount = orderedSelectedPositions.length
  const allEnabledPositions = items
    .map((_, index) => index)
    .filter((index) => !disabledSet.has(index))
  const allEnabledSelected =
    allEnabledPositions.length > 0 && allEnabledPositions.every((index) => selectedSet.has(index))

  const headerText = useMemo(() => {
    if (selectionMode === 'single') {
      if (selectedCount === 0) return filterName || 'Select option'
      const selectedIndex = orderedSelectedPositions[0]
      return items[selectedIndex] || filterName || 'Select option'
    }

    if (selectedCount === 0) return '0 selected'
    if (allEnabledSelected && filterName) return `All ${filterName} Selected`
    return `${selectedCount} selected`
  }, [allEnabledSelected, filterName, items, orderedSelectedPositions, selectedCount, selectionMode])

  const applySelection = (next: Set<number>) => {
    const nextPositions = Array.from(next).sort((a, b) => a - b)
    const nextItems = nextPositions.map((position) => items[position]).filter(Boolean)

    if (isControlled) {
      onSelectionChanged?.(nextPositions, nextItems)
      return
    }
    setUncontrolledSelectedSet(next)
  }

  const toggleSelection = (index: number) => {
    if (disabledSet.has(index)) return

    const next = new Set(selectedSet)

    if (selectionMode === 'single') {
      next.clear()
      next.add(index)
    } else if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    applySelection(next)

    if (selectionMode === 'single') {
      setIsOpen(false)
    }
  }

  const clearSelection = () => {
    applySelection(new Set())
  }

  const selectAll = () => {
    applySelection(new Set(allEnabledPositions))
  }

  const rowViewportHeight = `${Math.min(items.length, 8) * 40}px`
  const isPanelVisible = isOpen || isClosing
  const showActionArea = isPanelVisible && selectionMode === 'multi'
  const showSpacer = isPanelVisible && bottomType === 'spacer20'
  const showSingleAction = showActionArea && bottomType === 'clearAll40'
  const showDualAction = showActionArea && bottomType === 'clearAllSelectAll40'
  const bottomHeight = showSpacer ? '20px' : showActionArea ? '40px' : '0px'
  const panelMaxHeight = isOpen ? `calc(${rowViewportHeight} + ${bottomHeight})` : '0px'
  const isHeaderExpanded = isOpen || isClosing

  const handleHeaderToggle = () => {
    if (isOpen) {
      setIsOpen(false)
      setIsClosing(true)
      return
    }
    setIsClosing(false)
    setIsOpen(true)
  }

  const handlePanelTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== 'max-height') return
    if (!isOpen) {
      setIsClosing(false)
    }
  }

  const updateScrollbarMetrics = useCallback(() => {
    const element = listViewportRef.current
    if (!element) return

    const { scrollTop, scrollHeight, clientHeight } = element
    const hasOverflow = scrollHeight > clientHeight + 1
    setShowCustomScrollbar(hasOverflow)

    if (!hasOverflow) {
      setScrollbarThumbTop(0)
      setScrollbarThumbHeight(0)
      return
    }

    const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 28)
    const maxThumbTop = Math.max(clientHeight - thumbHeight, 0)
    const maxScrollTop = Math.max(scrollHeight - clientHeight, 1)
    const thumbTop = (scrollTop / maxScrollTop) * maxThumbTop

    setScrollbarThumbHeight(thumbHeight)
    setScrollbarThumbTop(thumbTop)
  }, [])

  const scrollViewportFromRailPointer = useCallback((clientY: number, grabOffset: number) => {
    const railElement = scrollbarRailRef.current
    const viewportElement = listViewportRef.current
    if (!railElement || !viewportElement) return

    const { scrollHeight, clientHeight } = viewportElement
    if (scrollHeight <= clientHeight) return

    const railRect = railElement.getBoundingClientRect()
    const railHeight = railElement.clientHeight
    const computedThumbHeight = Math.max((clientHeight / scrollHeight) * railHeight, 28)
    const maxThumbTop = Math.max(railHeight - computedThumbHeight, 0)
    const targetThumbTop = Math.min(
      Math.max(clientY - railRect.top - grabOffset, 0),
      maxThumbTop
    )
    const scrollRatio = maxThumbTop === 0 ? 0 : targetThumbTop / maxThumbTop
    viewportElement.scrollTop = scrollRatio * (scrollHeight - clientHeight)
  }, [])

  const stopScrollbarDrag = useCallback(() => {
    dragStateRef.current.active = false
    dragStateRef.current.pointerId = null
    dragStateRef.current.grabOffset = 0
  }, [])

  const handleRailPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (event.target !== event.currentTarget) return
    event.preventDefault()

    const grabOffset = scrollbarThumbHeight > 0 ? scrollbarThumbHeight / 2 : 14
    scrollViewportFromRailPointer(event.clientY, grabOffset)
  }

  const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const thumbRect = event.currentTarget.getBoundingClientRect()
    dragStateRef.current.active = true
    dragStateRef.current.pointerId = event.pointerId
    dragStateRef.current.grabOffset = event.clientY - thumbRect.top
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  useEffect(() => {
    if (!isPanelVisible) {
      setShowCustomScrollbar(false)
      return
    }

    const raf = window.requestAnimationFrame(updateScrollbarMetrics)
    window.addEventListener('resize', updateScrollbarMetrics)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', updateScrollbarMetrics)
    }
  }, [isPanelVisible, items.length, updateScrollbarMetrics])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current.active) return
      if (dragStateRef.current.pointerId !== null && event.pointerId !== dragStateRef.current.pointerId) return
      event.preventDefault()
      scrollViewportFromRailPointer(event.clientY, dragStateRef.current.grabOffset)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (!dragStateRef.current.active) return
      if (dragStateRef.current.pointerId !== null && event.pointerId !== dragStateRef.current.pointerId) return
      stopScrollbarDrag()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [scrollViewportFromRailPointer, stopScrollbarDrag])

  return (
    <div className={`but-ddm ${isOpen ? 'but-ddm--open' : 'but-ddm--closed'} ${className}`.trim()}>
      <div className="but-ddm__header">
        <BUTBaseButton
          variant="wide"
          shape={isHeaderExpanded ? 'top-rounded' : 'rounded'}
          width="fill"
          colorVariant={colorVariant}
          icon={isHeaderExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          iconPosition="right"
          instantAction
          onClick={handleHeaderToggle}
        >
          {headerText}
        </BUTBaseButton>
      </div>

      <div className="but-ddm__panel" style={{ maxHeight: panelMaxHeight }} onTransitionEnd={handlePanelTransitionEnd}>
        <div className={`but-ddm__list-wrap rs-button--color-${colorVariant}`}>
        <div
          ref={listViewportRef}
          className="but-ddm__list-viewport"
          style={{ maxHeight: rowViewportHeight }}
          onScroll={updateScrollbarMetrics}
        >
          {items.map((item, index) => {
            const selected = selectedSet.has(index)
            const disabled = disabledSet.has(index)
            return (
              <div
                key={`${item}-${index}`}
                className={`but-ddm__row ${disabled ? 'but-ddm__row--disabled' : ''}`}
              >
                <BUTBaseButton
                  variant="wide"
                  shape="squared"
                  width="fill"
                  colorVariant={colorVariant}
                  pressed={selected}
                  disabled={disabled}
                  icon={selected ? <span className="but-ddm__check">✓</span> : undefined}
                  iconPosition="right"
                  instantAction
                  onClick={() => toggleSelection(index)}
                >
                  {item}
                </BUTBaseButton>
              </div>
            )
          })}
        </div>
          {showCustomScrollbar && (
            <div ref={scrollbarRailRef} className="but-ddm__custom-scrollbar" onPointerDown={handleRailPointerDown}>
              <div
                className="but-ddm__custom-scrollbar-thumb"
                style={{
                  height: `${scrollbarThumbHeight}px`,
                  transform: `translateY(${scrollbarThumbTop}px)`,
                }}
                onPointerDown={handleThumbPointerDown}
              />
            </div>
          )}
        </div>

        {showSpacer && (
          <div className="but-ddm__bottom">
            <div
              className={`but-ddm__bottom-spacer rs-button--color-${colorVariant}`}
              aria-hidden="true"
            />
          </div>
        )}

        {showSingleAction && (
          <div className="but-ddm__bottom but-ddm__bottom-single">
            <BUTBaseButton
              variant="wide"
              shape="bottom-rounded"
              width="fill"
              colorVariant={colorVariant}
              instantAction
              onClick={clearSelection}
            >
              {clearAllLabel}
            </BUTBaseButton>
          </div>
        )}

        {showDualAction && (
          <div className="but-ddm__bottom but-ddm__bottom-dual">
            <BUTBaseButton
              className="but-ddm__dual-left"
              variant="wide"
              shape="bottom-rounded"
              width="fill"
              colorVariant={colorVariant}
              instantAction
              onClick={clearSelection}
            >
              {clearAllLabel}
            </BUTBaseButton>
            <BUTBaseButton
              className="but-ddm__dual-right"
              variant="wide"
              shape="bottom-rounded"
              width="fill"
              colorVariant={colorVariant}
              instantAction
              onClick={selectAll}
            >
              {selectAllLabel}
            </BUTBaseButton>
          </div>
        )}
      </div>
    </div>
  )
}

export type { BUTDDMListBaseProps, DDMSelectionMode, DDMBottomType }
export default BUTDDMListBase
