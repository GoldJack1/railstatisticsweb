import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import './DesignSystemColours.css'

type TokenItem = {
  label: string
  token: string
}

const SURFACE_TOKENS: TokenItem[] = [
  { label: 'Background Primary', token: '--bg-primary' },
  { label: 'Background Secondary', token: '--bg-secondary' },
  { label: 'Background Tertiary', token: '--bg-tertiary' },
]

const TEXT_TOKENS: TokenItem[] = [
  { label: 'Text Primary', token: '--text-primary' },
  { label: 'Text Secondary', token: '--text-secondary' },
  { label: 'Text Disabled', token: '--text-disabled' },
]

const ALL_TOKENS = [...SURFACE_TOKENS, ...TEXT_TOKENS]

const readTokenValue = (token: string): string => {
  if (typeof window === 'undefined') return ''
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return value || 'n/a'
}

const TokenCard: React.FC<TokenItem> = ({ label, token }) => {
  const value = useMemo(() => readTokenValue(token), [token])
  return (
    <article className="ds-colours__card">
      <div className="ds-colours__swatch" style={{ backgroundColor: `var(${token})` }} aria-hidden="true" />
      <h3>{label}</h3>
      <p className="ds-colours__token">{token}</p>
      <p className="ds-colours__value">{value}</p>
    </article>
  )
}

const DesignSystemColours: React.FC = () => {
  return (
    <div className="container">
      <div className="ds-colours">
        <Link to="/design-system" className="ds-colours__back-link">
          ← Back to Design System
        </Link>
        <header className="ds-colours__header">
          <h1>Design System Colours</h1>
          <p>Reference for colour tokens used by surfaces, text, and interactive UI states.</p>
        </header>

        <section>
          <h2>Surfaces</h2>
          <div className="ds-colours__grid">
            {SURFACE_TOKENS.map((item) => (
              <TokenCard key={item.token} {...item} />
            ))}
          </div>
        </section>

        <section>
          <h2>Text</h2>
          <div className="ds-colours__grid">
            {TEXT_TOKENS.map((item) => (
              <TokenCard key={item.token} {...item} />
            ))}
          </div>
        </section>

        <section>
          <h2>Dark Theme Preview</h2>
          <p className="ds-colours__hint">
            This preview applies the same tokens under a local dark theme container.
          </p>
          <div className="ds-colours__theme-preview" data-theme="dark">
            <div className="ds-colours__theme-preview-inner">
              {ALL_TOKENS.map((item) => (
                <TokenCard key={`dark-${item.token}`} {...item} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default DesignSystemColours
