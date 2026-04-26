import React, { useEffect, useMemo, useRef, useState } from 'react'
import StationLocationMapView from './StationLocationMapView'

interface StationResponsiveLocationMapProps {
  latitude: number
  longitude: number
}

function getResponsiveAspectRatio(width: number): number {
  // Scale from near-square on very small screens up to desktop-like ratio.
  if (width <= 0) return 4 / 3
  const minRatio = 1
  const maxRatio = 1.6
  const normalized = Math.min(1, Math.max(0, (width - 280) / 360))
  return minRatio + (maxRatio - minRatio) * normalized
}

const StationResponsiveLocationMap: React.FC<StationResponsiveLocationMapProps> = ({ latitude, longitude }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const updateWidth = () => {
      const next = Math.round(el.getBoundingClientRect().width)
      setWidth((prev) => (prev === next ? prev : next))
    }

    updateWidth()

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateWidth) : null
    observer?.observe(el)
    window.addEventListener('resize', updateWidth)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  const aspectRatio = useMemo(() => getResponsiveAspectRatio(width), [width])
  const mapHeight = useMemo(() => {
    if (width <= 0) return undefined
    return Math.max(240, Math.round(width / aspectRatio))
  }, [width, aspectRatio])

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H10',location:'StationResponsiveLocationMap.tsx:ratio',message:'Responsive map ratio computed',data:{wrapperWidth:width,aspectRatio:Number(aspectRatio.toFixed(3)),mapHeight:mapHeight ?? null},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }, [width, aspectRatio, mapHeight])

  return (
    <div ref={wrapperRef} className="station-responsive-location-map">
      <StationLocationMapView
        latitude={latitude}
        longitude={longitude}
        height={mapHeight}
      />
    </div>
  )
}

export default StationResponsiveLocationMap
