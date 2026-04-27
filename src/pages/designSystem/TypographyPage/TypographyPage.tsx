import React from 'react'
import { PageTopHeader } from '../../../components/misc'
import './TypographyPage.css'

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
    <div className="ds-typography-page">
      <PageTopHeader
        title="Typography"
        subtitle="Typography references based on Geologica Cursive, with tokenized type sizing and weight usage across the app."
        actionButton={{
          to: '/design-system',
          label: 'Back',
          mode: 'iconText',
          icon: (
            <svg className="rs-page-top-header__action-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11.5 8H4.5" />
              <path d="M7.5 5L4.5 8L7.5 11" />
            </svg>
          ),
        }}
      />
      <div className="container">
        <div className="ds-typography">

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
    </div>
  )
}

export default TypographyPage

