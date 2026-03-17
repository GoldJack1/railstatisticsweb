import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from './Button'
import ButtonBar from './ButtonBar'
import VisitButton from './VisitButton'
import ButtonDemo from './ButtonDemo'
import './DesignSystemButtons.css'

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="3" x2="8" y2="13" />
    <line x1="3" y1="8" x2="13" y2="8" />
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7" cy="7" r="4" />
    <line x1="11" y1="11" x2="13" y2="13" />
  </svg>
)

const DesignSystemButtons: React.FC = () => {
  const [controlledIndex, setControlledIndex] = useState<number | null>(0)
  const [visited, setVisited] = useState(false)

  return (
    <div className="container">
      <div className="ds-buttons">
        <Link to="/design-system" className="ds-buttons__back-link">
          ← Back to Design System
        </Link>
        <header className="ds-buttons__header">
          <h1>Design System Buttons and Controls</h1>
          <p>
            Integration of the existing button library plus focused guidance for grouped controls and visit state
            actions.
          </p>
        </header>

        <section className="ds-buttons__section">
          <h2>ButtonBar Patterns</h2>
          <p>Includes both uncontrolled and controlled usage.</p>
          <div className="ds-buttons__controls-grid">
            <article className="ds-buttons__card">
              <h3>Uncontrolled</h3>
              <ButtonBar
                buttons={[
                  { label: 'List', value: 'list' },
                  { label: 'Map', value: 'map' },
                  { label: 'Timeline', value: 'timeline' },
                ]}
              />
            </article>
            <article className="ds-buttons__card">
              <h3>Controlled</h3>
              <ButtonBar
                buttons={[
                  { label: 'Current', value: 'current' },
                  { label: 'Historic', value: 'historic' },
                  { label: 'Forecast', value: 'forecast' },
                ]}
                selectedIndex={controlledIndex}
                onChange={(index) => setControlledIndex(index)}
              />
              <p className="ds-buttons__meta">Selected index: {controlledIndex === null ? 'none' : controlledIndex}</p>
            </article>
          </div>
        </section>

        <section className="ds-buttons__section">
          <h2>Visit Status Control</h2>
          <div className="ds-buttons__controls-grid">
            <article className="ds-buttons__card">
              <h3>Interactive</h3>
              <VisitButton visited={visited} onToggle={() => setVisited((prev) => !prev)} />
            </article>
            <article className="ds-buttons__card">
              <h3>States</h3>
              <div className="ds-buttons__visit-states">
                <VisitButton visited date="2026-03-16" />
                <VisitButton visited={false} />
                <VisitButton visited disabled />
              </div>
            </article>
          </div>
        </section>

        <section className="ds-buttons__section">
          <h2>Icon Usage Pattern</h2>
          <p>
            Icon-only buttons should use clear `ariaLabel` values and follow the existing `icon` prop pattern on the
            shared `Button` component.
          </p>
          <div className="ds-buttons__icon-row">
            <Button variant="circle" icon={<PlusIcon />} ariaLabel="Add item" />
            <Button variant="circle" icon={<SearchIcon />} ariaLabel="Search" />
            <Button variant="square" shape="squared" icon={<PlusIcon />} ariaLabel="Add square" />
          </div>
        </section>

        <section className="ds-buttons__section">
          <h2>Full Button Library</h2>
          <p>The full existing component showcase is embedded below.</p>
          <div className="ds-buttons__demo-wrap">
            <ButtonDemo />
          </div>
        </section>
      </div>
    </div>
  )
}

export default DesignSystemButtons
