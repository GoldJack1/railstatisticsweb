import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/Button'
import ButtonBar from '../../components/ButtonBar'
import VisitButton from '../../components/VisitButton'
import '../../components/DesignSystemButtons.css'

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

type ColorVariant = 'primary' | 'secondary' | 'accent' | 'green-action' | 'red-action'

const COLOR_VARIANTS: ColorVariant[] = ['primary', 'secondary', 'accent', 'green-action', 'red-action']
const SHARED_VARIANTS: Array<'wide' | 'tab' | 'chip'> = ['wide', 'tab', 'chip']
const SHAPES: Array<'rounded' | 'left-rounded' | 'right-rounded' | 'top-rounded' | 'bottom-rounded' | 'squared'> = [
  'rounded',
  'left-rounded',
  'right-rounded',
  'top-rounded',
  'bottom-rounded',
  'squared',
]

type StateValues = {
  bg: { hsl: string; hex: string }
  text: { hsl: string; hex: string }
}

const formatHsbFromHex = (hex: string): string => {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return 'hsb(0 0% 0%)'

  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let hue = 0
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
  }

  hue = Math.round(hue * 60)
  if (hue < 0) hue += 360

  const saturation = max === 0 ? 0 : Math.round((delta / max) * 100)
  const brightness = Math.round(max * 100)

  return `hsb(${hue} ${saturation}% ${brightness}%)`
}

const formatColorValues = (hsl: string, hex: string): string => `${hsl} / ${formatHsbFromHex(hex)} / ${hex}`

type VariantToken = {
  id: ColorVariant
  label: string
  active: { light: StateValues; dark: StateValues }
  pressed: { light: StateValues; dark: StateValues }
  disabled: {
    light: StateValues
    dark: StateValues
  }
}

const VARIANT_TOKENS: VariantToken[] = [
  {
    id: 'primary',
    label: 'Primary',
    active: {
      light: { bg: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' }, text: { hsl: 'hsl(0 0% 0%)', hex: '#000000' } },
      dark: { bg: { hsl: 'hsl(0 0% 24%)', hex: '#3D3D3D' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    pressed: {
      light: { bg: { hsl: 'hsl(0 0% 77%)', hex: '#C4C4C4' }, text: { hsl: 'hsl(0 0% 0%)', hex: '#000000' } },
      dark: { bg: { hsl: 'hsl(0 0% 12%)', hex: '#1F1F1F' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    disabled: {
      light: {
        bg: { hsl: 'hsl(0 0% 77%)', hex: '#C4C4C4' },
        text: { hsl: 'hsl(0 0% 45%)', hex: '#737373' },
      },
      dark: {
        bg: { hsl: 'hsl(0 0% 12%)', hex: '#1F1F1F' },
        text: { hsl: 'hsl(0 0% 55%)', hex: '#8C8C8C' },
      },
    },
  },
  {
    id: 'secondary',
    label: 'Secondary',
    active: {
      light: { bg: { hsl: 'hsl(0 0% 5%)', hex: '#0D0D0D' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
      dark: { bg: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' }, text: { hsl: 'hsl(0 0% 0%)', hex: '#000000' } },
    },
    pressed: {
      light: { bg: { hsl: 'hsl(0 0% 20%)', hex: '#333333' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
      dark: { bg: { hsl: 'hsl(0 0% 89%)', hex: '#E3E3E3' }, text: { hsl: 'hsl(0 0% 0%)', hex: '#000000' } },
    },
    disabled: {
      light: {
        bg: { hsl: 'hsl(0 0% 20%)', hex: '#333333' },
        text: { hsl: 'hsl(0 0% 77%)', hex: '#C4C4C4' },
      },
      dark: {
        bg: { hsl: 'hsl(0 0% 89%)', hex: '#E3E3E3' },
        text: { hsl: 'hsl(0 0% 55%)', hex: '#8C8C8C' },
      },
    },
  },
  {
    id: 'accent',
    label: 'Accent',
    active: {
      light: { bg: { hsl: 'hsl(353 57% 48%)', hex: '#C03545' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
      dark: { bg: { hsl: 'hsl(353 100% 19%)', hex: '#61000B' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    pressed: {
      light: { bg: { hsl: 'hsl(353 57% 38%)', hex: '#982A37' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
      dark: { bg: { hsl: 'hsl(352 100% 12%)', hex: '#3D0008' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    disabled: {
      light: {
        bg: { hsl: 'hsl(353 57% 38%)', hex: '#982A37' },
        text: { hsl: 'hsl(0 0% 80%)', hex: '#CCCCCC' },
      },
      dark: {
        bg: { hsl: 'hsl(352 100% 12%)', hex: '#3D0008' },
        text: { hsl: 'hsl(0 0% 40%)', hex: '#666666' },
      },
    },
  },
  {
    id: 'green-action',
    label: 'Green Action',
    active: {
      light: { bg: { hsl: 'hsl(141 60% 40%)', hex: '#29A354' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
      dark: { bg: { hsl: 'hsl(141 100% 19%)', hex: '#006122' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    pressed: {
      light: { bg: { hsl: 'hsl(141 60% 35%)', hex: '#248F49' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
      dark: { bg: { hsl: 'hsl(141 100% 12%)', hex: '#003D15' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    disabled: {
      light: {
        bg: { hsl: 'hsl(141 60% 35%)', hex: '#248F49' },
        text: { hsl: 'hsl(0 0% 80%)', hex: '#CCCCCC' },
      },
      dark: {
        bg: { hsl: 'hsl(141 100% 12%)', hex: '#003D15' },
        text: { hsl: 'hsl(0 0% 40%)', hex: '#666666' },
      },
    },
  },
  {
    id: 'red-action',
    label: 'Red Action',
    active: {
      light: { bg: { hsl: 'hsl(0 68% 58%)', hex: '#DD4B4B' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
      dark: { bg: { hsl: 'hsl(359 100% 25%)', hex: '#800002' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    pressed: {
      light: { bg: { hsl: 'hsl(0 68% 48%)', hex: '#CE2727' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
      dark: { bg: { hsl: 'hsl(359 100% 17%)', hex: '#570001' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    disabled: {
      light: {
        bg: { hsl: 'hsl(0 68% 48%)', hex: '#CE2727' },
        text: { hsl: 'hsl(0 0% 80%)', hex: '#CCCCCC' },
      },
      dark: {
        bg: { hsl: 'hsl(359 100% 17%)', hex: '#570001' },
        text: { hsl: 'hsl(0 0% 40%)', hex: '#666666' },
      },
    },
  },
]

const BUTTON_VALUES_PROMPT = `Button colour values (all variants)

${VARIANT_TOKENS.map((token) => {
  return [
    `${token.label}`,
    `- Active`,
    `  - Light bg: ${formatColorValues(token.active.light.bg.hsl, token.active.light.bg.hex)}`,
    `  - Light text: ${formatColorValues(token.active.light.text.hsl, token.active.light.text.hex)}`,
    `  - Dark bg: ${formatColorValues(token.active.dark.bg.hsl, token.active.dark.bg.hex)}`,
    `  - Dark text: ${formatColorValues(token.active.dark.text.hsl, token.active.dark.text.hex)}`,
    `- Pressed`,
    `  - Light bg: ${formatColorValues(token.pressed.light.bg.hsl, token.pressed.light.bg.hex)}`,
    `  - Light text: ${formatColorValues(token.pressed.light.text.hsl, token.pressed.light.text.hex)}`,
    `  - Dark bg: ${formatColorValues(token.pressed.dark.bg.hsl, token.pressed.dark.bg.hex)}`,
    `  - Dark text: ${formatColorValues(token.pressed.dark.text.hsl, token.pressed.dark.text.hex)}`,
    `- Disabled`,
    `  - Light bg: ${formatColorValues(token.disabled.light.bg.hsl, token.disabled.light.bg.hex)}`,
    `  - Light text: ${formatColorValues(token.disabled.light.text.hsl, token.disabled.light.text.hex)}`,
    `  - Dark bg: ${formatColorValues(token.disabled.dark.bg.hsl, token.disabled.dark.bg.hex)}`,
    `  - Dark text: ${formatColorValues(token.disabled.dark.text.hsl, token.disabled.dark.text.hex)}`,
  ].join('\n')
}).join('\n\n')}`

const SITE_TEXT_COLOURS_PROMPT = `Site text colours

Light theme
- Primary text: hsl(0 0% 0%) / #000000
- Secondary text: hsl(0 0% 25%) / #404040
- Disabled text: hsl(0 0% 45%) / #737373

Dark theme
- Primary text: hsl(0 0% 100%) / #FFFFFF
- Secondary text: hsl(0 0% 75%) / #BFBFBF
- Disabled text: hsl(0 0% 55%) / #8C8C8C`

const SITE_COLOURS_PROMPT = `Site colour tokens

Light theme
- Background primary: hsl(0 0% 96%) / #F5F5F5
- Background secondary: hsl(0 0% 91%) / #E8E8E8
- Background tertiary: hsl(0 0% 82%) / #D1D1D1
- Accent bright: #E50000
- Accent strong: #CC0000
- Accent base: #B20016
- Accent deep: #990000
- Accent darkest: #7F0000

Dark theme
- Background primary: hsl(0 0% 20%) / #333333
- Background secondary: hsl(0 0% 15%) / #262626
- Background tertiary: hsl(0 0% 10%) / #1A1A1A
- Accent bright: #E50000
- Accent strong: #CC0000
- Accent base: #B20016
- Accent deep: #990000
- Accent darkest: #7F0000`

const ButtonsPage: React.FC = () => {
  const [controlledIndex, setControlledIndex] = useState<number | null>(0)
  const [visited, setVisited] = useState(false)
  const [clickedButtons, setClickedButtons] = useState<Record<string, boolean>>({})

  const handlePressPreview = (id: string) => {
    setClickedButtons((prev) => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setClickedButtons((prev) => ({ ...prev, [id]: false }))
    }, 250)
  }

  return (
    <div className="container">
      <div className="ds-buttons">
        <Link to="/design-system" className="ds-buttons__back-link">
          ← Back to Design System
        </Link>
        <header className="ds-buttons__header">
          <h1>Buttons</h1>
          <p>Clean reference for button states and one focused interactive demo section.</p>
        </header>

        <section className="ds-buttons__section">
          <h2>Button States + Values</h2>
          <p>Each state shows the button plus light/dark HSL, HSB, and HEX values for background and text.</p>
          <div className="ds-buttons__matrix">
            {VARIANT_TOKENS.map((token) => (
              <article key={token.id} className="ds-buttons__card">
                <h3 className="ds-buttons__matrix-title">{token.label}</h3>
                <div className="ds-buttons__state-detail-grid">
                  <div className="ds-buttons__state-detail">
                    <div className="ds-buttons__state-detail-title">Active</div>
                    <Button variant="wide" width="hug" colorVariant={token.id}>
                      Active
                    </Button>
                    <div className="ds-buttons__value-block">
                      <div><strong>Light bg</strong> {formatColorValues(token.active.light.bg.hsl, token.active.light.bg.hex)}</div>
                      <div><strong>Light text</strong> {formatColorValues(token.active.light.text.hsl, token.active.light.text.hex)}</div>
                      <div><strong>Dark bg</strong> {formatColorValues(token.active.dark.bg.hsl, token.active.dark.bg.hex)}</div>
                      <div><strong>Dark text</strong> {formatColorValues(token.active.dark.text.hsl, token.active.dark.text.hex)}</div>
                    </div>
                  </div>
                  <div className="ds-buttons__state-detail">
                    <div className="ds-buttons__state-detail-title">Pressed</div>
                    <Button variant="wide" width="hug" colorVariant={token.id} pressed>
                      Pressed
                    </Button>
                    <div className="ds-buttons__value-block">
                      <div><strong>Light bg</strong> {formatColorValues(token.pressed.light.bg.hsl, token.pressed.light.bg.hex)}</div>
                      <div><strong>Light text</strong> {formatColorValues(token.pressed.light.text.hsl, token.pressed.light.text.hex)}</div>
                      <div><strong>Dark bg</strong> {formatColorValues(token.pressed.dark.bg.hsl, token.pressed.dark.bg.hex)}</div>
                      <div><strong>Dark text</strong> {formatColorValues(token.pressed.dark.text.hsl, token.pressed.dark.text.hex)}</div>
                    </div>
                  </div>
                  <div className="ds-buttons__state-detail">
                    <div className="ds-buttons__state-detail-title">Disabled</div>
                    <Button variant="wide" width="hug" colorVariant={token.id} disabled>
                      Disabled
                    </Button>
                    <div className="ds-buttons__value-block">
                      <div><strong>Light bg</strong> {formatColorValues(token.disabled.light.bg.hsl, token.disabled.light.bg.hex)}</div>
                      <div><strong>Light text</strong> {formatColorValues(token.disabled.light.text.hsl, token.disabled.light.text.hex)}</div>
                      <div><strong>Dark bg</strong> {formatColorValues(token.disabled.dark.bg.hsl, token.disabled.dark.bg.hex)}</div>
                      <div><strong>Dark text</strong> {formatColorValues(token.disabled.dark.text.hsl, token.disabled.dark.text.hex)}</div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ds-buttons__section">
          <h2>Interactive Buttons</h2>
          <p>Working examples for variants, shapes, button bars, and visit status.</p>
          <div className="ds-buttons__controls-grid">
            {SHARED_VARIANTS.map((variant) => (
              <article key={variant} className="ds-buttons__card">
                <h3>{variant}</h3>
                <div className="ds-buttons__state-stack">
                  {COLOR_VARIANTS.map((colorVariant) => (
                    <div key={`${variant}-${colorVariant}`} className="ds-buttons__state-row">
                      <span className="ds-buttons__variant-label">{colorVariant}</span>
                      <Button
                        variant={variant}
                        width="hug"
                        colorVariant={colorVariant}
                        pressed={Boolean(clickedButtons[`interactive-${variant}-${colorVariant}`])}
                        onClick={() => handlePressPreview(`interactive-${variant}-${colorVariant}`)}
                      >
                        Active
                      </Button>
                      <Button variant={variant} width="hug" colorVariant={colorVariant} pressed>
                        Pressed
                      </Button>
                      <Button variant={variant} width="hug" colorVariant={colorVariant} disabled>
                        Disabled
                      </Button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            <article className="ds-buttons__card ds-buttons__card--span-2">
              <h3>wide with icons (left + right)</h3>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`wide-icons-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <Button
                      variant="wide"
                      width="hug"
                      colorVariant={colorVariant}
                      icon={<PlusIcon />}
                      iconPosition="left"
                      pressed={Boolean(clickedButtons[`interactive-wide-left-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-wide-left-${colorVariant}`)}
                    >
                      Add Station
                    </Button>
                    <Button
                      variant="wide"
                      width="hug"
                      colorVariant={colorVariant}
                      icon={<SearchIcon />}
                      iconPosition="right"
                      pressed={Boolean(clickedButtons[`interactive-wide-right-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-wide-right-${colorVariant}`)}
                    >
                      Search
                    </Button>
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card ds-buttons__card--span-2">
              <h3>circle + square</h3>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`icons-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <Button
                      variant="circle"
                      colorVariant={colorVariant}
                      icon={<PlusIcon />}
                      ariaLabel="Active"
                      pressed={Boolean(clickedButtons[`interactive-circle-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-circle-${colorVariant}`)}
                    />
                    <Button
                      variant="square"
                      shape="squared"
                      colorVariant={colorVariant}
                      icon={<SearchIcon />}
                      ariaLabel="Pressed"
                      pressed
                    />
                    <Button
                      variant="square"
                      shape="squared"
                      colorVariant={colorVariant}
                      icon={<SearchIcon />}
                      ariaLabel="Disabled"
                      disabled
                    />
                  </div>
                ))}
              </div>
            </article>
            {SHAPES.map((shape) => (
              <article key={shape} className="ds-buttons__card">
                <h3>{shape}</h3>
                <div className="ds-buttons__state-stack">
                  {COLOR_VARIANTS.map((colorVariant) => (
                    <div key={`${shape}-${colorVariant}`} className="ds-buttons__state-row">
                      <span className="ds-buttons__variant-label">{colorVariant}</span>
                      <Button
                        variant="wide"
                        width="hug"
                        shape={shape}
                        colorVariant={colorVariant}
                        pressed={Boolean(clickedButtons[`interactive-shape-${shape}-${colorVariant}`])}
                        onClick={() => handlePressPreview(`interactive-shape-${shape}-${colorVariant}`)}
                      >
                        Active
                      </Button>
                      <Button variant="wide" width="hug" shape={shape} colorVariant={colorVariant} pressed>
                        Pressed
                      </Button>
                      <Button variant="wide" width="hug" shape={shape} colorVariant={colorVariant} disabled>
                        Disabled
                      </Button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            <article className="ds-buttons__card ds-buttons__card--full">
              <h3>ButtonBar (2 / 3 Buttons) + Visit Button</h3>
              <div className="ds-buttons__visit-states">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`bar-${colorVariant}`} className="ds-buttons__state-stack">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <ButtonBar
                      colorVariant={colorVariant}
                      buttons={[
                        { label: 'List', value: 'list' },
                        { label: 'Map', value: 'map' },
                      ]}
                    />
                    <ButtonBar
                      colorVariant={colorVariant}
                      buttons={[
                        { label: 'Current', value: 'current' },
                        { label: 'Historic', value: 'historic' },
                        { label: 'Forecast', value: 'forecast' },
                      ]}
                      selectedIndex={colorVariant === 'primary' ? controlledIndex : undefined}
                      onChange={colorVariant === 'primary' ? (index) => setControlledIndex(index) : undefined}
                    />
                  </div>
                ))}
                <p className="ds-buttons__meta">Primary 3-button selected index: {controlledIndex === null ? 'none' : controlledIndex}</p>
                <VisitButton visited={visited} onToggle={() => setVisited((prev) => !prev)} />
                <VisitButton visited date="2026-03-16" />
                <VisitButton visited={false} />
              </div>
            </article>
          </div>
        </section>

        <section className="ds-buttons__section">
          <h2>Copy Prompt</h2>
          <p>Copy this text block to share all button colour values.</p>
          <textarea className="ds-buttons__prompt-textarea" value={BUTTON_VALUES_PROMPT} readOnly />
        </section>

        <section className="ds-buttons__section">
          <h2>Copy Prompt: Site Text Colours</h2>
          <p>Copy this text block for the site text colour tokens.</p>
          <textarea className="ds-buttons__prompt-textarea" value={SITE_TEXT_COLOURS_PROMPT} readOnly />
        </section>

        <section className="ds-buttons__section">
          <h2>Copy Prompt: Site Colours</h2>
          <p>Copy this text block for the site background and accent colour tokens.</p>
          <textarea className="ds-buttons__prompt-textarea" value={SITE_COLOURS_PROMPT} readOnly />
        </section>
      </div>
    </div>
  )
}

export default ButtonsPage

