import React, { useState } from 'react'
import { BUTWideButton } from '../../../components/buttons'
import BUTTabButton from '../../../components/buttons/wide/BUTTabButton'
import BUTOperatorChip from '../../../components/buttons/wide/BUTOperatorChip'
import BUTLeftIconWideButton from '../../../components/buttons/wide/BUTLeftIconWideButton'
import BUTRightIconWideButton from '../../../components/buttons/wide/BUTRightIconWideButton'
import { BUTCircleButton } from '../../../components/buttons'
import BUTLeftRoundedCircleButton from '../../../components/buttons/small/BUTLeftRoundedCircleButton'
import BUTRightRoundedCircleButton from '../../../components/buttons/small/BUTRightRoundedCircleButton'
import BUTSquareButton from '../../../components/buttons/small/BUTSquareButton'
import BUTLeftRoundedSquareButton from '../../../components/buttons/small/BUTLeftRoundedSquareButton'
import BUTRightRoundedSquareButton from '../../../components/buttons/small/BUTRightRoundedSquareButton'
import BUTTextNumberCircleButton from '../../../components/buttons/small/BUTTextNumberCircleButton'
import BUTLeftRoundedTextNumberCircleButton from '../../../components/buttons/small/BUTLeftRoundedTextNumberCircleButton'
import BUTRightRoundedTextNumberCircleButton from '../../../components/buttons/small/BUTRightRoundedTextNumberCircleButton'
import BUTTextNumberSquareButton from '../../../components/buttons/small/BUTTextNumberSquareButton'
import BUTLeftRoundedTextNumberSquareButton from '../../../components/buttons/small/BUTLeftRoundedTextNumberSquareButton'
import BUTRightRoundedTextNumberSquareButton from '../../../components/buttons/small/BUTRightRoundedTextNumberSquareButton'
import BUTLeftRoundedWideButton from '../../../components/buttons/rounded/BUTLeftRoundedWideButton'
import BUTRightRoundedWideButton from '../../../components/buttons/rounded/BUTRightRoundedWideButton'
import BUTTopRoundedWideButton from '../../../components/buttons/rounded/BUTTopRoundedWideButton'
import BUTBottomRoundedWideButton from '../../../components/buttons/rounded/BUTBottomRoundedWideButton'
import BUTSquaredWideButton from '../../../components/buttons/wide/BUTSquaredWideButton'
import BUTTwoButtonBar from '../../../components/buttons/other/BUTTwoButtonBar'
import BUTThreeButtonBar from '../../../components/buttons/other/BUTThreeButtonBar'
import BUTVisitStatusButton from '../../../components/buttons/other/BUTVisitStatusButton'
import './ButtonsPage.css'

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

type ColorVariant = 'primary' | 'secondary' | 'accent' | 'green-action' | 'red-action' | 'fav-action'

const COLOR_VARIANTS: ColorVariant[] = ['primary', 'secondary', 'accent', 'green-action', 'red-action', 'fav-action']
const SHARED_VARIANTS: Array<'wide' | 'tab' | 'chip'> = ['wide', 'tab', 'chip']
const SHAPES: Array<'left-rounded' | 'right-rounded' | 'top-rounded' | 'bottom-rounded' | 'squared'> = [
  'left-rounded',
  'right-rounded',
  'top-rounded',
  'bottom-rounded',
  'squared',
]

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

  const getVariantComponent = (variant: 'wide' | 'tab' | 'chip') => {
    if (variant === 'wide') return BUTWideButton
    if (variant === 'tab') return BUTTabButton
    return BUTOperatorChip
  }
  const getVariantComponentName = (variant: 'wide' | 'tab' | 'chip') => {
    if (variant === 'wide') return 'BUTWideButton'
    if (variant === 'tab') return 'BUTTabButton'
    return 'BUTOperatorChip'
  }
  const getShapeComponent = (shape: 'left-rounded' | 'right-rounded' | 'top-rounded' | 'bottom-rounded' | 'squared') => {
    if (shape === 'left-rounded') return BUTLeftRoundedWideButton
    if (shape === 'right-rounded') return BUTRightRoundedWideButton
    if (shape === 'top-rounded') return BUTTopRoundedWideButton
    if (shape === 'bottom-rounded') return BUTBottomRoundedWideButton
    return BUTSquaredWideButton
  }
  const getShapeComponentName = (shape: 'left-rounded' | 'right-rounded' | 'top-rounded' | 'bottom-rounded' | 'squared') => {
    if (shape === 'left-rounded') return 'BUTLeftRoundedWideButton'
    if (shape === 'right-rounded') return 'BUTRightRoundedWideButton'
    if (shape === 'top-rounded') return 'BUTTopRoundedWideButton'
    if (shape === 'bottom-rounded') return 'BUTBottomRoundedWideButton'
    return 'BUTSquaredWideButton'
  }

  return (
    <div className="container">
      <div className="ds-buttons">
        <BUTWideButton to="/design-system" width="hug" colorVariant="primary" className="rs-button--text-size">
          ← Back to Design System
        </BUTWideButton>
        <header className="ds-buttons__header">
          <h1>Buttons</h1>
          <p>Clean reference for button states and one focused interactive demo section.</p>
        </header>

        <section className="ds-buttons__section">
          <h2>Interactive Buttons</h2>
          <p>Working examples for variants, shapes, button bars, and visit status.</p>
          <div className="ds-buttons__controls-grid">
            {SHARED_VARIANTS.map((variant) => (
              <article key={variant} className="ds-buttons__card">
                <h3>{getVariantComponentName(variant)}</h3>
                <p className="ds-buttons__name-preview">File name: {getVariantComponentName(variant)}</p>
                <div className="ds-buttons__state-stack">
                  {COLOR_VARIANTS.map((colorVariant) => (
                    <div key={`${variant}-${colorVariant}`} className="ds-buttons__state-row">
                      {(() => {
                        const VariantButton = getVariantComponent(variant)
                        return (
                          <>
                            <span className="ds-buttons__variant-label">{colorVariant}</span>
                            <VariantButton
                              width="hug"
                              colorVariant={colorVariant}
                              pressed={Boolean(clickedButtons[`interactive-${variant}-${colorVariant}`])}
                              onClick={() => handlePressPreview(`interactive-${variant}-${colorVariant}`)}
                            >
                              Active
                            </VariantButton>
                            <VariantButton width="hug" colorVariant={colorVariant} pressed>
                              Pressed
                            </VariantButton>
                            <VariantButton width="hug" colorVariant={colorVariant} disabled>
                              Disabled
                            </VariantButton>
                          </>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              </article>
            ))}
            <article className="ds-buttons__card">
              <h3>BUTLeftIconWideButton</h3>
              <p className="ds-buttons__name-preview">File name: BUTLeftIconWideButton</p>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`wide-icons-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTLeftIconWideButton
                      width="hug"
                      colorVariant={colorVariant}
                      icon={<PlusIcon />}
                      pressed={Boolean(clickedButtons[`interactive-wide-left-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-wide-left-${colorVariant}`)}
                    >
                      Add Station
                    </BUTLeftIconWideButton>
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card">
              <h3>BUTRightIconWideButton</h3>
              <p className="ds-buttons__name-preview">File name: BUTRightIconWideButton</p>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`wide-right-icons-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTRightIconWideButton
                      width="hug"
                      colorVariant={colorVariant}
                      icon={<SearchIcon />}
                      pressed={Boolean(clickedButtons[`interactive-wide-right-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-wide-right-${colorVariant}`)}
                    >
                      Search
                    </BUTRightIconWideButton>
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card">
              <h3>BUTCircleButton</h3>
              <p className="ds-buttons__name-preview">File name: BUTCircleButton</p>
              <div className="ds-buttons__state-row">
                <span className="ds-buttons__variant-label">left/right rounded</span>
                <BUTLeftRoundedCircleButton colorVariant="primary" icon={<PlusIcon />} ariaLabel="Left rounded" />
                <BUTRightRoundedCircleButton colorVariant="primary" icon={<PlusIcon />} ariaLabel="Right rounded" />
              </div>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`icons-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTCircleButton
                      colorVariant={colorVariant}
                      icon={<PlusIcon />}
                      ariaLabel="Active"
                      pressed={Boolean(clickedButtons[`interactive-circle-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-circle-${colorVariant}`)}
                    />
                    <BUTCircleButton
                      colorVariant={colorVariant}
                      icon={<PlusIcon />}
                      ariaLabel="Pressed"
                      pressed
                    />
                    <BUTCircleButton
                      colorVariant={colorVariant}
                      icon={<PlusIcon />}
                      ariaLabel="Disabled"
                      disabled
                    />
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card">
              <h3>BUTSquareButton</h3>
              <p className="ds-buttons__name-preview">File name: BUTSquareButton</p>
              <div className="ds-buttons__state-row">
                <span className="ds-buttons__variant-label">left/right rounded</span>
                <BUTLeftRoundedSquareButton colorVariant="primary" icon={<SearchIcon />} ariaLabel="Left rounded" />
                <BUTRightRoundedSquareButton colorVariant="primary" icon={<SearchIcon />} ariaLabel="Right rounded" />
              </div>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`square-icons-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTSquareButton
                      colorVariant={colorVariant}
                      icon={<SearchIcon />}
                      ariaLabel="Active"
                      pressed={Boolean(clickedButtons[`interactive-square-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-square-${colorVariant}`)}
                    />
                    <BUTSquareButton
                      colorVariant={colorVariant}
                      icon={<SearchIcon />}
                      ariaLabel="Pressed"
                      pressed
                    />
                    <BUTSquareButton
                      colorVariant={colorVariant}
                      icon={<SearchIcon />}
                      ariaLabel="Disabled"
                      disabled
                    />
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card">
              <h3>BUTTextNumberCircleButton</h3>
              <p className="ds-buttons__name-preview">File name: BUTTextNumberCircleButton</p>
              <div className="ds-buttons__state-row">
                <span className="ds-buttons__variant-label">Examples</span>
                <BUTTextNumberCircleButton text="A" colorVariant="primary" ariaLabel="A" />
                <BUTTextNumberCircleButton text="AA" colorVariant="primary" ariaLabel="AA" />
                <BUTTextNumberCircleButton text="1" colorVariant="primary" ariaLabel="1" />
                <BUTTextNumberCircleButton text="12" colorVariant="primary" ariaLabel="12" />
              </div>
              <div className="ds-buttons__state-row">
                <span className="ds-buttons__variant-label">left/right rounded</span>
                <BUTLeftRoundedTextNumberCircleButton text="AA" colorVariant="primary" ariaLabel="Left rounded AA" />
                <BUTRightRoundedTextNumberCircleButton text="12" colorVariant="primary" ariaLabel="Right rounded 12" />
              </div>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`text-number-circle-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTTextNumberCircleButton
                      text="AA"
                      colorVariant={colorVariant}
                      ariaLabel="Active"
                      pressed={Boolean(clickedButtons[`interactive-text-number-circle-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-text-number-circle-${colorVariant}`)}
                    />
                    <BUTTextNumberCircleButton
                      text="AA"
                      colorVariant={colorVariant}
                      ariaLabel="Pressed"
                      pressed
                    />
                    <BUTTextNumberCircleButton
                      text="AA"
                      colorVariant={colorVariant}
                      ariaLabel="Disabled"
                      disabled
                    />
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card">
              <h3>BUTTextNumberSquareButton</h3>
              <p className="ds-buttons__name-preview">File name: BUTTextNumberSquareButton</p>
              <div className="ds-buttons__state-row">
                <span className="ds-buttons__variant-label">Examples</span>
                <BUTTextNumberSquareButton text="A" colorVariant="primary" ariaLabel="A" />
                <BUTTextNumberSquareButton text="AA" colorVariant="primary" ariaLabel="AA" />
                <BUTTextNumberSquareButton text="1" colorVariant="primary" ariaLabel="1" />
                <BUTTextNumberSquareButton text="12" colorVariant="primary" ariaLabel="12" />
              </div>
              <div className="ds-buttons__state-row">
                <span className="ds-buttons__variant-label">left/right rounded</span>
                <BUTLeftRoundedTextNumberSquareButton text="AA" colorVariant="primary" ariaLabel="Left rounded AA" />
                <BUTRightRoundedTextNumberSquareButton text="12" colorVariant="primary" ariaLabel="Right rounded 12" />
              </div>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`text-number-square-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTTextNumberSquareButton
                      text="12"
                      colorVariant={colorVariant}
                      ariaLabel="Active"
                      pressed={Boolean(clickedButtons[`interactive-text-number-square-${colorVariant}`])}
                      onClick={() => handlePressPreview(`interactive-text-number-square-${colorVariant}`)}
                    />
                    <BUTTextNumberSquareButton
                      text="12"
                      colorVariant={colorVariant}
                      ariaLabel="Pressed"
                      pressed
                    />
                    <BUTTextNumberSquareButton
                      text="12"
                      colorVariant={colorVariant}
                      ariaLabel="Disabled"
                      disabled
                    />
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card">
              <h3>Small Left Rounded Buttons</h3>
              <p className="ds-buttons__name-preview">Files: BUTLeftRoundedCircleButton, BUTLeftRoundedSquareButton, BUTLeftRoundedTextNumberCircleButton, BUTLeftRoundedTextNumberSquareButton</p>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`small-left-rounded-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTLeftRoundedCircleButton colorVariant={colorVariant} icon={<PlusIcon />} ariaLabel="Left rounded circle" />
                    <BUTLeftRoundedSquareButton colorVariant={colorVariant} icon={<SearchIcon />} ariaLabel="Left rounded square" />
                    <BUTLeftRoundedTextNumberCircleButton text="AA" colorVariant={colorVariant} ariaLabel="Left rounded text number circle" />
                    <BUTLeftRoundedTextNumberSquareButton text="12" colorVariant={colorVariant} ariaLabel="Left rounded text number square" />
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card">
              <h3>Small Right Rounded Buttons</h3>
              <p className="ds-buttons__name-preview">Files: BUTRightRoundedCircleButton, BUTRightRoundedSquareButton, BUTRightRoundedTextNumberCircleButton, BUTRightRoundedTextNumberSquareButton</p>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`small-right-rounded-${colorVariant}`} className="ds-buttons__state-row">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTRightRoundedCircleButton colorVariant={colorVariant} icon={<PlusIcon />} ariaLabel="Right rounded circle" />
                    <BUTRightRoundedSquareButton colorVariant={colorVariant} icon={<SearchIcon />} ariaLabel="Right rounded square" />
                    <BUTRightRoundedTextNumberCircleButton text="AA" colorVariant={colorVariant} ariaLabel="Right rounded text number circle" />
                    <BUTRightRoundedTextNumberSquareButton text="12" colorVariant={colorVariant} ariaLabel="Right rounded text number square" />
                  </div>
                ))}
              </div>
            </article>
            {SHAPES.map((shape) => (
              <article key={shape} className="ds-buttons__card">
                <h3>{getShapeComponentName(shape)}</h3>
                <p className="ds-buttons__name-preview">File name: {getShapeComponentName(shape)}</p>
                <div className="ds-buttons__state-stack">
                  {COLOR_VARIANTS.map((colorVariant) => (
                    <div key={`${shape}-${colorVariant}`} className="ds-buttons__state-row">
                      {(() => {
                        const ShapeButton = getShapeComponent(shape)
                        return (
                          <>
                            <span className="ds-buttons__variant-label">{colorVariant}</span>
                            <ShapeButton
                              width="hug"
                              colorVariant={colorVariant}
                              pressed={Boolean(clickedButtons[`interactive-shape-${shape}-${colorVariant}`])}
                              onClick={() => handlePressPreview(`interactive-shape-${shape}-${colorVariant}`)}
                            >
                              Active
                            </ShapeButton>
                            <ShapeButton width="hug" colorVariant={colorVariant} pressed>
                              Pressed
                            </ShapeButton>
                            <ShapeButton width="hug" colorVariant={colorVariant} disabled>
                              Disabled
                            </ShapeButton>
                          </>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              </article>
            ))}
            <article className="ds-buttons__card">
              <h3>BUTTwoButtonBar</h3>
              <p className="ds-buttons__name-preview">File name: BUTTwoButtonBar</p>
              <div className="ds-buttons__visit-states">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`bar-two-${colorVariant}`} className="ds-buttons__state-stack">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTTwoButtonBar
                      colorVariant={colorVariant}
                      buttons={[
                        { label: 'List', value: 'list' },
                        { label: 'Map', value: 'map' },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </article>
            <article className="ds-buttons__card">
              <h3>BUTThreeButtonBar</h3>
              <p className="ds-buttons__name-preview">File name: BUTThreeButtonBar</p>
              <div className="ds-buttons__visit-states">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`bar-three-${colorVariant}`} className="ds-buttons__state-stack">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTThreeButtonBar
                      colorVariant={colorVariant}
                      buttons={[
                        { label: 'Current', value: 'current' },
                        { label: 'Historic', value: 'historic' },
                        { label: 'Forecast', value: 'forecast' },
                      ]}
                      selectedIndex={colorVariant === 'primary' ? controlledIndex : undefined}
                      onChange={colorVariant === 'primary' ? (index: number | null) => setControlledIndex(index) : undefined}
                    />
                  </div>
                ))}
                <p className="ds-buttons__meta">Primary 3-button selected index: {controlledIndex === null ? 'none' : controlledIndex}</p>
              </div>
            </article>
            <article className="ds-buttons__card ds-buttons__card--full">
              <h3>BUTVisitStatusButton</h3>
              <p className="ds-buttons__name-preview">File name: BUTVisitStatusButton</p>
              <div className="ds-buttons__visit-states">
                <BUTVisitStatusButton visited={visited} onToggle={() => setVisited((prev) => !prev)} />
                <BUTVisitStatusButton visited date="2026-03-16" />
                <BUTVisitStatusButton visited={false} />
              </div>
            </article>
          </div>
        </section>

      </div>
    </div>
  )
}

export default ButtonsPage

