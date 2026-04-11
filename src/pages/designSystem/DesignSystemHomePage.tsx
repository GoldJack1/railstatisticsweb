import React from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/Button'
import '../../components/DesignSystemHome.css'

const SECTIONS = [
  {
    title: 'Colours',
    description: 'Core light/dark theme colours, text, borders, and accents.',
    to: '/design-system/colours',
  },
  {
    title: 'Typography',
    description: 'Font families, variable-weight specimens, and scale tokens.',
    to: '/design-system/typography',
  },
  {
    title: 'Buttons',
    description: 'Primary button variants, bars, and visit state controls.',
    to: '/design-system/buttons',
  },
  {
    title: 'Layout',
    description: 'Spacing, radii, containers, and layout composition patterns.',
    to: '/design-system/layout',
  },
  {
    title: 'Components',
    description: 'High-level reusable UI components and where they are used.',
    to: '/design-system/components',
  },
  {
    title: 'Icons',
    description: 'Current icon usage patterns and shared icon guidance.',
    to: '/design-system/icons',
  },
  {
    title: 'Heroes',
    description: 'Static and carousel heroes: type scale, panel fill, CTAs, button colours, and carousel chrome.',
    to: '/design-system/heros',
  },
]

const DesignSystemHomePage: React.FC = () => {
  return (
    <div className="container">
      <div className="ds-home">
        <header className="ds-home__header">
          <h1 className="ds-home__title">Design System</h1>
          <p className="ds-home__subtitle">
            Central reference for typography, colour tokens, interaction states, and shared UI patterns used
            across Rail Statistics.
          </p>
        </header>

        <section className="ds-home__digest">
          <div className="ds-home__digest-card">
            <h2>Core Palette</h2>
            <div className="ds-home__swatches">
              <span className="ds-home__swatch ds-home__swatch--bg-primary" />
              <span className="ds-home__swatch ds-home__swatch--bg-secondary" />
              <span className="ds-home__swatch ds-home__swatch--bg-tertiary" />
              <span className="ds-home__swatch ds-home__swatch--accent" />
            </div>
          </div>

          <div className="ds-home__digest-card">
            <h2>Type Scale</h2>
            <p className="ds-home__type-sample ds-home__type-sample--xl">Heading Token</p>
            <p className="ds-home__type-sample ds-home__type-sample--base">Body token example text.</p>
            <p className="ds-home__type-sample ds-home__type-sample--sm">Caption token example text.</p>
          </div>

          <div className="ds-home__digest-card">
            <h2>Action Controls</h2>
            <div className="ds-home__actions">
              <Button variant="wide" width="hug">
                Primary
              </Button>
              <Button variant="wide" width="hug">Token</Button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="ds-home__section-title">System Sections</h2>
          <div className="ds-home__grid">
            {SECTIONS.map((section) => (
              <Link key={section.to} to={section.to} className="ds-home__card">
                <h3>{section.title}</h3>
                <p>{section.description}</p>
                <span className="ds-home__card-link">Open</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default DesignSystemHomePage

