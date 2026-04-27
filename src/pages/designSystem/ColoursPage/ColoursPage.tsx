import React, { useState } from 'react'
import { BUTBaseButton as Button, BUTSquaredWideButton } from '../../../components/buttons'
import { PageTopHeader } from '../../../components/misc'
import './ColoursPage.css'

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

const ACCENT_TOKENS: TokenItem[] = [
  { label: 'Accent Bright', token: '--accent-bright' },
  { label: 'Accent Strong', token: '--accent-strong' },
  { label: 'Accent Base', token: '--accent-base' },
  { label: 'Accent Deep', token: '--accent-deep' },
  { label: 'Accent Darkest', token: '--accent-darkest' },
]

const UI_COLOUR_TOKENS: TokenItem[] = [
  { label: 'Border Color', token: '--border-color' },
  { label: 'Accent Color (Alias)', token: '--accent-color' },
  { label: 'Accent Hover', token: '--accent-hover' },
  { label: 'Accent Pressed', token: '--accent-pressed' },
  { label: 'Accent Light', token: '--accent-light' },
]

const ALL_TOKENS = [...SURFACE_TOKENS, ...TEXT_TOKENS, ...ACCENT_TOKENS, ...UI_COLOUR_TOKENS]

const LIGHT_TOKEN_FILLS: Record<string, string> = {
  '--bg-primary': '#F5F5F5',
  '--bg-secondary': '#E8E8E8',
  '--bg-tertiary': '#D1D1D1',
  '--text-primary': '#000000',
  '--text-secondary': '#404040',
  '--text-disabled': '#737373',
  '--accent-bright': '#E50000',
  '--accent-strong': '#CC0000',
  '--accent-base': '#B20016',
  '--accent-deep': '#990000',
  '--accent-darkest': '#7F0000',
  '--border-color': '#B8B8B8',
  '--accent-color': '#B20016',
  '--accent-hover': '#CC0000',
  '--accent-pressed': '#990000',
  '--accent-light': '#F3C8CD',
}

const DARK_TOKEN_FILLS: Record<string, string> = {
  '--bg-primary': '#333333',
  '--bg-secondary': '#262626',
  '--bg-tertiary': '#1A1A1A',
  '--text-primary': '#FFFFFF',
  '--text-secondary': '#BFBFBF',
  '--text-disabled': '#8C8C8C',
  '--accent-bright': '#E50000',
  '--accent-strong': '#CC0000',
  '--accent-base': '#B20016',
  '--accent-deep': '#990000',
  '--accent-darkest': '#7F0000',
  '--border-color': '#525252',
  '--accent-color': '#B20016',
  '--accent-hover': '#CC0000',
  '--accent-pressed': '#990000',
  '--accent-light': '#4D0E16',
}

type ColorVariant = 'primary' | 'secondary' | 'accent' | 'green-action' | 'red-action' | 'fav-action'

type StateValues = {
  bg: { hsl: string; hex: string }
  text: { hsl: string; hex: string }
}

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
  {
    id: 'fav-action',
    label: 'Favourite',
    active: {
      light: { bg: { hsl: 'hsl(53 59% 60%)', hex: '#D6C85C' }, text: { hsl: 'hsl(0 0% 0%)', hex: '#000000' } },
      dark: { bg: { hsl: 'hsl(53 100% 24%)', hex: '#7A6C00' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    pressed: {
      light: { bg: { hsl: 'hsl(53 55% 50%)', hex: '#C6B539' }, text: { hsl: 'hsl(0 0% 0%)', hex: '#000000' } },
      dark: { bg: { hsl: 'hsl(53 100% 12%)', hex: '#3D3600' }, text: { hsl: 'hsl(0 0% 100%)', hex: '#FFFFFF' } },
    },
    disabled: {
      light: {
        bg: { hsl: 'hsl(53 55% 50%)', hex: '#C6B539' },
        text: { hsl: 'hsl(0 0% 35%)', hex: '#595959' },
      },
      dark: {
        bg: { hsl: 'hsl(53 100% 12%)', hex: '#3D3600' },
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


const StateColorChips: React.FC<{ values: { light: StateValues; dark: StateValues } }> = ({ values }) => (
  <div className="ds-colours__chip-grid">
    <div className="ds-colours__chip">
      <span className="ds-colours__chip-label">Light bg</span>
      <span className="ds-colours__chip-swatch" style={{ backgroundColor: values.light.bg.hex }} aria-hidden="true" />
    </div>
    <div className="ds-colours__chip">
      <span className="ds-colours__chip-label">Light text</span>
      <span className="ds-colours__chip-swatch" style={{ backgroundColor: values.light.text.hex }} aria-hidden="true" />
    </div>
    <div className="ds-colours__chip">
      <span className="ds-colours__chip-label">Dark bg</span>
      <span className="ds-colours__chip-swatch" style={{ backgroundColor: values.dark.bg.hex }} aria-hidden="true" />
    </div>
    <div className="ds-colours__chip">
      <span className="ds-colours__chip-label">Dark text</span>
      <span className="ds-colours__chip-swatch" style={{ backgroundColor: values.dark.text.hex }} aria-hidden="true" />
    </div>
  </div>
)

const ColoursPage: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<TokenItem>(ALL_TOKENS[0])
  const lightFill = LIGHT_TOKEN_FILLS[selectedToken.token] ?? '#000000'
  const darkFill = DARK_TOKEN_FILLS[selectedToken.token] ?? '#000000'
  const lightPreviewBg = selectedToken.token === '--bg-tertiary' ? LIGHT_TOKEN_FILLS['--bg-primary'] : undefined
  const darkPreviewBg = selectedToken.token === '--bg-tertiary' ? DARK_TOKEN_FILLS['--bg-primary'] : undefined

  return (
    <div className="ds-colours-page">
      <PageTopHeader
        title="Colours"
        subtitle="Reference for colour tokens used by surfaces, text, and interactive UI states."
        actionButton={{
          to: '/design-system',
          label: 'Back',
          mode: 'iconText',
          iconPosition: 'left',
          icon: (
            <svg
              className="rs-page-top-header__action-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M11.5 8H4.5" />
              <path d="M7.5 5L4.5 8L7.5 11" />
            </svg>
          ),
        }}
      />
      <div className="container">
        <div className="ds-colours">
          <section className="ds-colours__section-panel ds-colours__section-panel--comparison">
            <h2>Token Light vs Dark Comparison</h2>
            <p className="ds-colours__hint">
              Pick a token on the left and compare its light/dark rendering on the right.
            </p>
            <div className="ds-colours__token-compare-layout">
              <div className="ds-colours__token-list">
                {ALL_TOKENS.map((item) => (
                  <BUTSquaredWideButton
                    key={item.token}
                    width="fill"
                    colorVariant="primary"
                    pressed={selectedToken.token === item.token}
                    onClick={() => setSelectedToken(item)}
                    className="ds-colours__token-button"
                  >
                    {item.label}
                  </BUTSquaredWideButton>
                ))}
              </div>

              <div className="ds-colours__token-preview-panel">
                <div className="ds-colours__token-preview-head">
                  <h3>{selectedToken.label}</h3>
                  <p>{selectedToken.token}</p>
                </div>

                <div className="ds-colours__theme-compare">
                  <div className="ds-colours__theme-column">
                    <h3 className="ds-colours__theme-column-title">Light Theme</h3>
                    <div className="ds-colours__theme-preview" style={{ backgroundColor: lightPreviewBg }}>
                      <div
                        className="ds-colours__single-swatch"
                        style={{ backgroundColor: lightFill }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <div className="ds-colours__theme-column">
                    <h3 className="ds-colours__theme-column-title">Dark Theme</h3>
                    <div className="ds-colours__theme-preview" style={{ backgroundColor: darkPreviewBg }}>
                      <div
                        className="ds-colours__single-swatch"
                        style={{ backgroundColor: darkFill }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="ds-colours__section-panel">
            <h2>Button States + Values</h2>
            <p className="ds-colours__hint">
              Each state shows the button plus light/dark HSL, HSB, and HEX values for background and text.
            </p>
            <div className="ds-colours__matrix">
              {VARIANT_TOKENS.map((token) => (
                <article key={token.id} className="ds-colours__card">
                  <h3 className="ds-colours__matrix-title">{token.label}</h3>
                  <div className="ds-colours__state-detail-grid">
                    <div className="ds-colours__state-detail">
                      <div className="ds-colours__state-detail-title">Active</div>
                      <Button variant="wide" width="hug" colorVariant={token.id}>
                        Active
                      </Button>
                      <StateColorChips values={token.active} />
                      <div className="ds-colours__value-block">
                        <div><strong>Light bg</strong> {formatColorValues(token.active.light.bg.hsl, token.active.light.bg.hex)}</div>
                        <div><strong>Light text</strong> {formatColorValues(token.active.light.text.hsl, token.active.light.text.hex)}</div>
                        <div><strong>Dark bg</strong> {formatColorValues(token.active.dark.bg.hsl, token.active.dark.bg.hex)}</div>
                        <div><strong>Dark text</strong> {formatColorValues(token.active.dark.text.hsl, token.active.dark.text.hex)}</div>
                      </div>
                    </div>
                    <div className="ds-colours__state-detail">
                      <div className="ds-colours__state-detail-title">Pressed</div>
                      <Button variant="wide" width="hug" colorVariant={token.id} pressed>
                        Pressed
                      </Button>
                      <StateColorChips values={token.pressed} />
                      <div className="ds-colours__value-block">
                        <div><strong>Light bg</strong> {formatColorValues(token.pressed.light.bg.hsl, token.pressed.light.bg.hex)}</div>
                        <div><strong>Light text</strong> {formatColorValues(token.pressed.light.text.hsl, token.pressed.light.text.hex)}</div>
                        <div><strong>Dark bg</strong> {formatColorValues(token.pressed.dark.bg.hsl, token.pressed.dark.bg.hex)}</div>
                        <div><strong>Dark text</strong> {formatColorValues(token.pressed.dark.text.hsl, token.pressed.dark.text.hex)}</div>
                      </div>
                    </div>
                    <div className="ds-colours__state-detail">
                      <div className="ds-colours__state-detail-title">Disabled</div>
                      <Button variant="wide" width="hug" colorVariant={token.id} disabled>
                        Disabled
                      </Button>
                      <StateColorChips values={token.disabled} />
                      <div className="ds-colours__value-block">
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

          <section className="ds-colours__section-panel">
            <h2>Copy Prompt</h2>
            <p className="ds-colours__hint">Copy this text block to share all button colour values.</p>
            <textarea className="ds-colours__prompt-textarea" value={BUTTON_VALUES_PROMPT} readOnly />
          </section>

          <section className="ds-colours__section-panel">
            <h2>Copy Prompt: Site Text Colours</h2>
            <p className="ds-colours__hint">Copy this text block for the site text colour tokens.</p>
            <textarea className="ds-colours__prompt-textarea" value={SITE_TEXT_COLOURS_PROMPT} readOnly />
          </section>

          <section className="ds-colours__section-panel">
            <h2>Copy Prompt: Site Colours</h2>
            <p className="ds-colours__hint">Copy this text block for the site background and accent colour tokens.</p>
            <textarea className="ds-colours__prompt-textarea" value={SITE_COLOURS_PROMPT} readOnly />
          </section>
        </div>
      </div>
    </div>
  )
}

export default ColoursPage

