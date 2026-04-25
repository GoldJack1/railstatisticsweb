import React from 'react'
import { BUTWideButton } from '../../../components/buttons'
import './LayoutPage.css'

const SPACING_TOKENS = [
  '--space-xs',
  '--space-sm',
  '--space-md',
  '--space-lg',
  '--space-xl',
  '--space-2xl',
  '--space-3xl',
  '--space-4xl',
]

const RADIUS_TOKENS = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl']

const CONTAINER_TOKENS = [
  '--container-sm',
  '--container-md',
  '--container-lg',
  '--container-xl',
  '--container-2xl',
  '--container-3xl',
]

const LayoutPage: React.FC = () => {
  return (
    <div className="container">
      <div className="ds-layout">
        <BUTWideButton to="/design-system" width="hug" colorVariant="primary" className="rs-button--text-size">
          ← Back to Design System
        </BUTWideButton>
        <header className="ds-layout__header">
          <h1>Design System Layout</h1>
          <p>Spacing, radius, and container tokens used to build responsive structure and hierarchy.</p>
        </header>

        <section className="ds-layout__section">
          <h2>Spacing Scale</h2>
          <div className="ds-layout__list">
            {SPACING_TOKENS.map((token) => (
              <div key={token} className="ds-layout__row">
                <code>{token}</code>
                <div className="ds-layout__spacing-sample" style={{ width: `var(${token})` }} />
              </div>
            ))}
          </div>
        </section>

        <section className="ds-layout__section">
          <h2>Border Radius</h2>
          <div className="ds-layout__radius-grid">
            {RADIUS_TOKENS.map((token) => (
              <article key={token} className="ds-layout__radius-card">
                <code>{token}</code>
                <div className="ds-layout__radius-sample" style={{ borderRadius: `var(${token})` }}>
                  Card
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ds-layout__section">
          <h2>Container Widths</h2>
          <div className="ds-layout__container-list">
            {CONTAINER_TOKENS.map((token) => (
              <div key={token} className="ds-layout__container-row">
                <code>{token}</code>
                <div className="ds-layout__container-sample" style={{ maxWidth: `var(${token})` }}>
                  {token}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ds-layout__section">
          <h2>Composition Patterns</h2>
          <div className="ds-layout__patterns">
            <article className="ds-layout__pattern ds-layout__pattern--single">
              <h3>Single Column Content</h3>
              <p>Used for legal pages and text-heavy content.</p>
            </article>
            <article className="ds-layout__pattern ds-layout__pattern--two-col">
              <div>
                <h3>Main</h3>
                <p>Primary data area</p>
              </div>
              <div>
                <h3>Side</h3>
                <p>Filters or metadata</p>
              </div>
            </article>
            <article className="ds-layout__pattern ds-layout__pattern--cards">
              <div />
              <div />
              <div />
            </article>
          </div>
        </section>
      </div>
    </div>
  )
}

export default LayoutPage

