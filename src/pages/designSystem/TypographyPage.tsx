import React from 'react'
import NavigationButton from '../../components/NavigationButton'
import '../../components/DesignSystemTypography.css'

const SCALE_TOKENS = [
  '--text-xs',
  '--text-sm',
  '--text-base',
  '--text-lg',
  '--text-xl',
  '--text-2xl',
  '--text-3xl',
  '--text-4xl',
  '--text-5xl',
]

const WEIGHTS = [300, 400, 500, 600, 700]

const TypographyPage: React.FC = () => {
  return (
    <div className="container">
      <div className="ds-typography">
        <NavigationButton to="/design-system" variant="wide" width="hug" colorVariant="primary" className="rs-button--text-size">
          ← Back to Design System
        </NavigationButton>
        <header className="ds-typography__header">
          <h1>Design System Typography</h1>
          <p>
            Typography references based on Geologica Cursive, with tokenized type sizing and weight usage across the app.
          </p>
        </header>

        <section className="ds-typography__section">
          <h2>Font Family</h2>
          <div className="ds-typography__families">
            <article className="ds-typography__family">
              <h3>Geologica Cursive</h3>
              <p className="ds-typography__sample ds-typography__sample--cursive">
                The quick brown fox jumps over the lazy dog. 0123456789
              </p>
            </article>
          </div>
        </section>

        <section className="ds-typography__section">
          <h2>Type Scale Tokens</h2>
          <div className="ds-typography__scale">
            {SCALE_TOKENS.map((token) => (
              <article key={token} className="ds-typography__scale-item">
                <div className="ds-typography__scale-meta">
                  <code>{token}</code>
                </div>
                <p style={{ fontSize: `var(${token})` }} className="ds-typography__scale-sample">
                  Rail Statistics typography sample
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="ds-typography__section">
          <h2>Variable Weights</h2>
          <div className="ds-typography__weights">
            {WEIGHTS.map((weight) => (
              <div key={weight} className="ds-typography__weight-row">
                <span>{weight}</span>
                <p style={{ fontWeight: weight }}>Geologica Cursive weight preview text</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default TypographyPage

