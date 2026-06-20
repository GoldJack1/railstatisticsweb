import { useEffect, useRef } from 'react'
import './MapAddStationContextMenu.css'

export type MapAddStationContextMenuState = {
  x: number
  y: number
  latitude: number
  longitude: number
}

interface MapAddStationContextMenuProps {
  menu: MapAddStationContextMenuState | null
  onClose: () => void
  onAddStation: (latitude: number, longitude: number) => void
}

export function MapAddStationContextMenu({ menu, onClose, onAddStation }: MapAddStationContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menu, onClose])

  if (!menu) return null

  return (
    <div
      ref={menuRef}
      className="map-add-station-context-menu"
      role="menu"
      style={{ top: menu.y, left: menu.x }}
    >
      <button
        type="button"
        className="map-add-station-context-menu__item"
        role="menuitem"
        onClick={() => {
          onAddStation(menu.latitude, menu.longitude)
          onClose()
        }}
      >
        Add station here
      </button>
      <p className="map-add-station-context-menu__coords" aria-hidden="true">
        {menu.latitude.toFixed(5)}, {menu.longitude.toFixed(5)}
      </p>
    </div>
  )
}
