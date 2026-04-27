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
import BUTDDMList from '../../../components/buttons/ddm/BUTDDMList'
import BUTDDMListAction from '../../../components/buttons/ddm/BUTDDMListAction'
import BUTDDMListActionDual from '../../../components/buttons/ddm/BUTDDMListActionDual'
import TXTINPBUTWideButton from '../../../components/textInputButtons/plain/TXTINPBUTWideButton'
import TXTINPBUTLeftRoundedButton from '../../../components/textInputButtons/plain/TXTINPBUTLeftRoundedButton'
import TXTINPBUTSquaredButton from '../../../components/textInputButtons/plain/TXTINPBUTSquaredButton'
import TXTINPSquared from '../../../components/textInputs/plain/TXTINPSquared'
import TXTINPBUTRightRoundedButton from '../../../components/textInputButtons/plain/TXTINPBUTRightRoundedButton'
import TXTINPBUTTopRoundedButton from '../../../components/textInputButtons/plain/TXTINPBUTTopRoundedButton'
import TXTINPBUTBottomRoundedButton from '../../../components/textInputButtons/plain/TXTINPBUTBottomRoundedButton'
import TXTINPWideButton from '../../../components/textInputs/plain/TXTINPWideButton'
import TXTINPLeftRoundedButton from '../../../components/textInputs/plain/TXTINPLeftRoundedButton'
import TXTINPSquaredButton from '../../../components/textInputs/plain/TXTINPSquaredButton'
import TXTINPRightRoundedButton from '../../../components/textInputs/plain/TXTINPRightRoundedButton'
import TXTINPTopRoundedButton from '../../../components/textInputs/plain/TXTINPTopRoundedButton'
import TXTINPBottomRoundedButton from '../../../components/textInputs/plain/TXTINPBottomRoundedButton'
import TXTINPBUTIconWideButton from '../../../components/textInputButtons/icon/TXTINPBUTIconWideButton'
import TXTINPBUTIconLeftRoundedButton from '../../../components/textInputButtons/icon/TXTINPBUTIconLeftRoundedButton'
import TXTINPBUTIconSquaredButton from '../../../components/textInputButtons/icon/TXTINPBUTIconSquaredButton'
import TXTINPBUTIconRightRoundedButton from '../../../components/textInputButtons/icon/TXTINPBUTIconRightRoundedButton'
import TXTINPBUTIconTopRoundedButton from '../../../components/textInputButtons/icon/TXTINPBUTIconTopRoundedButton'
import TXTINPBUTIconBottomRoundedButton from '../../../components/textInputButtons/icon/TXTINPBUTIconBottomRoundedButton'
import TXTINPIconWideButton from '../../../components/textInputs/icon/TXTINPIconWideButton'
import TXTINPIconLeftRoundedButton from '../../../components/textInputs/icon/TXTINPIconLeftRoundedButton'
import TXTINPIconSquaredButton from '../../../components/textInputs/icon/TXTINPIconSquaredButton'
import TXTINPIconRightRoundedButton from '../../../components/textInputs/icon/TXTINPIconRightRoundedButton'
import TXTINPIconTopRoundedButton from '../../../components/textInputs/icon/TXTINPIconTopRoundedButton'
import TXTINPIconBottomRoundedButton from '../../../components/textInputs/icon/TXTINPIconBottomRoundedButton'
import TXTINPBUTLabelWideButton from '../../../components/textInputButtons/label/TXTINPBUTLabelWideButton'
import TXTINPBUTLabelLeftRoundedButton from '../../../components/textInputButtons/label/TXTINPBUTLabelLeftRoundedButton'
import TXTINPBUTLabelSquaredButton from '../../../components/textInputButtons/label/TXTINPBUTLabelSquaredButton'
import TXTINPBUTLabelRightRoundedButton from '../../../components/textInputButtons/label/TXTINPBUTLabelRightRoundedButton'
import TXTINPBUTLabelTopRoundedButton from '../../../components/textInputButtons/label/TXTINPBUTLabelTopRoundedButton'
import TXTINPBUTLabelBottomRoundedButton from '../../../components/textInputButtons/label/TXTINPBUTLabelBottomRoundedButton'
import TXTINPLabelWideButton from '../../../components/textInputs/label/TXTINPLabelWideButton'
import TXTINPLabelLeftRoundedButton from '../../../components/textInputs/label/TXTINPLabelLeftRoundedButton'
import TXTINPLabelSquaredButton from '../../../components/textInputs/label/TXTINPLabelSquaredButton'
import TXTINPLabelRightRoundedButton from '../../../components/textInputs/label/TXTINPLabelRightRoundedButton'
import TXTINPLabelTopRoundedButton from '../../../components/textInputs/label/TXTINPLabelTopRoundedButton'
import TXTINPLabelBottomRoundedButton from '../../../components/textInputs/label/TXTINPLabelBottomRoundedButton'
import TXTINPBUTWideButtonPrice from '../../../components/textInputButtons/special/TXTINPBUTWideButtonPrice'
import TXTINPBUTLabelWideButtonPrice from '../../../components/textInputButtons/special/TXTINPBUTLabelWideButtonPrice'
import TXTINPBUTIconWideButtonSearch from '../../../components/textInputButtons/special/TXTINPBUTIconWideButtonSearch'
import TXTINPBUTWideIconLabelBar from '../../../components/textInputButtons/special/TXTINPBUTWideIconLabelBar'
import TXTINPWideButtonPrice from '../../../components/textInputs/special/TXTINPWideButtonPrice'
import TXTINPLabelWideButtonPrice from '../../../components/textInputs/special/TXTINPLabelWideButtonPrice'
import TXTINPIconWideButtonSearch from '../../../components/textInputs/special/TXTINPIconWideButtonSearch'
import TXTINPWideIconLabelBar from '../../../components/textInputs/special/TXTINPWideIconLabelBar'
import type { TXTINPBUTBaseButtonProps } from '../../../components/textInputButtons/base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'
import { SelectionDot, TextCard } from '../../../components/cards'
import type { TextCardState } from '../../../components/cards/TextCard/TextCard'
import { PageTopHeader } from '../../../components/misc'
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
const DDM_ITEMS = [
  'Avanti West Coast',
  'CrossCountry',
  'East Midlands Railway',
  'Gatwick Express',
  'Great Northern',
  'Great Western Railway',
  'LNER',
  'London Northwestern Railway',
  'Merseyrail',
  'Northern',
  'Southeastern',
]
const TEXT_CARD_STATES: TextCardState[] = ['default', 'accent', 'redAction', 'greenAction']

// Loose component type so we can iterate plain/icon/label/special wrappers in
// a single map without per-wrapper prop-type narrowing on the showcase page.
type TxtInpComponent = React.ComponentType<TXTINPBUTBaseButtonProps & Record<string, unknown>>

interface TxtInpEntry {
  name: string
  Component: TxtInpComponent
  /** Extra props applied to every preview cell (icon, label, etc.). */
  extraProps?: Record<string, unknown>
}

const asTxtInp = (component: unknown): TxtInpComponent => component as TxtInpComponent

const PLAIN_TXTINP_ENTRIES: TxtInpEntry[] = [
  { name: 'TXTINPBUTWideButton', Component: asTxtInp(TXTINPBUTWideButton) },
  { name: 'TXTINPBUTLeftRoundedButton', Component: asTxtInp(TXTINPBUTLeftRoundedButton) },
  { name: 'TXTINPBUTSquaredButton', Component: asTxtInp(TXTINPBUTSquaredButton) },
  { name: 'TXTINPSquared', Component: asTxtInp(TXTINPSquared) },
  { name: 'TXTINPBUTRightRoundedButton', Component: asTxtInp(TXTINPBUTRightRoundedButton) },
  { name: 'TXTINPBUTTopRoundedButton', Component: asTxtInp(TXTINPBUTTopRoundedButton) },
  { name: 'TXTINPBUTBottomRoundedButton', Component: asTxtInp(TXTINPBUTBottomRoundedButton) },
]

const ICON_TXTINP_ENTRIES: TxtInpEntry[] = [
  { name: 'TXTINPBUTIconWideButton', Component: asTxtInp(TXTINPBUTIconWideButton) },
  { name: 'TXTINPBUTIconLeftRoundedButton', Component: asTxtInp(TXTINPBUTIconLeftRoundedButton) },
  { name: 'TXTINPBUTIconSquaredButton', Component: asTxtInp(TXTINPBUTIconSquaredButton) },
  { name: 'TXTINPBUTIconRightRoundedButton', Component: asTxtInp(TXTINPBUTIconRightRoundedButton) },
  { name: 'TXTINPBUTIconTopRoundedButton', Component: asTxtInp(TXTINPBUTIconTopRoundedButton) },
  { name: 'TXTINPBUTIconBottomRoundedButton', Component: asTxtInp(TXTINPBUTIconBottomRoundedButton) },
]

const LABEL_TXTINP_ENTRIES: TxtInpEntry[] = [
  { name: 'TXTINPBUTLabelWideButton', Component: asTxtInp(TXTINPBUTLabelWideButton), extraProps: { label: 'Name:' } },
  { name: 'TXTINPBUTLabelLeftRoundedButton', Component: asTxtInp(TXTINPBUTLabelLeftRoundedButton), extraProps: { label: 'CRS:' } },
  { name: 'TXTINPBUTLabelSquaredButton', Component: asTxtInp(TXTINPBUTLabelSquaredButton), extraProps: { label: 'TIPLOC:' } },
  { name: 'TXTINPBUTLabelRightRoundedButton', Component: asTxtInp(TXTINPBUTLabelRightRoundedButton), extraProps: { label: 'Code:' } },
  { name: 'TXTINPBUTLabelTopRoundedButton', Component: asTxtInp(TXTINPBUTLabelTopRoundedButton), extraProps: { label: 'Operator:' } },
  { name: 'TXTINPBUTLabelBottomRoundedButton', Component: asTxtInp(TXTINPBUTLabelBottomRoundedButton), extraProps: { label: 'Notes:' } },
]

const SPECIAL_TXTINP_ENTRIES: TxtInpEntry[] = [
  { name: 'TXTINPBUTWideButtonPrice', Component: asTxtInp(TXTINPBUTWideButtonPrice) },
  { name: 'TXTINPBUTLabelWideButtonPrice', Component: asTxtInp(TXTINPBUTLabelWideButtonPrice), extraProps: { label: 'Fare' } },
  { name: 'TXTINPBUTIconWideButtonSearch', Component: asTxtInp(TXTINPBUTIconWideButtonSearch) },
  { name: 'TXTINPBUTWideIconLabelBar', Component: asTxtInp(TXTINPBUTWideIconLabelBar), extraProps: { labelPrefix: 'Name:', forceUppercase: true } },
]

const PLAIN_TXTINP_ALIAS_ENTRIES: TxtInpEntry[] = [
  { name: 'TXTINPWideButton', Component: asTxtInp(TXTINPWideButton) },
  { name: 'TXTINPLeftRoundedButton', Component: asTxtInp(TXTINPLeftRoundedButton) },
  { name: 'TXTINPSquaredButton', Component: asTxtInp(TXTINPSquaredButton) },
  { name: 'TXTINPSquared', Component: asTxtInp(TXTINPSquared) },
  { name: 'TXTINPRightRoundedButton', Component: asTxtInp(TXTINPRightRoundedButton) },
  { name: 'TXTINPTopRoundedButton', Component: asTxtInp(TXTINPTopRoundedButton) },
  { name: 'TXTINPBottomRoundedButton', Component: asTxtInp(TXTINPBottomRoundedButton) },
]

const ICON_TXTINP_ALIAS_ENTRIES: TxtInpEntry[] = [
  { name: 'TXTINPIconWideButton', Component: asTxtInp(TXTINPIconWideButton) },
  { name: 'TXTINPIconLeftRoundedButton', Component: asTxtInp(TXTINPIconLeftRoundedButton) },
  { name: 'TXTINPIconSquaredButton', Component: asTxtInp(TXTINPIconSquaredButton) },
  { name: 'TXTINPIconRightRoundedButton', Component: asTxtInp(TXTINPIconRightRoundedButton) },
  { name: 'TXTINPIconTopRoundedButton', Component: asTxtInp(TXTINPIconTopRoundedButton) },
  { name: 'TXTINPIconBottomRoundedButton', Component: asTxtInp(TXTINPIconBottomRoundedButton) },
]

const LABEL_TXTINP_ALIAS_ENTRIES: TxtInpEntry[] = [
  { name: 'TXTINPLabelWideButton', Component: asTxtInp(TXTINPLabelWideButton), extraProps: { label: 'Name:' } },
  { name: 'TXTINPLabelLeftRoundedButton', Component: asTxtInp(TXTINPLabelLeftRoundedButton), extraProps: { label: 'CRS:' } },
  { name: 'TXTINPLabelSquaredButton', Component: asTxtInp(TXTINPLabelSquaredButton), extraProps: { label: 'TIPLOC:' } },
  { name: 'TXTINPLabelRightRoundedButton', Component: asTxtInp(TXTINPLabelRightRoundedButton), extraProps: { label: 'Code:' } },
  { name: 'TXTINPLabelTopRoundedButton', Component: asTxtInp(TXTINPLabelTopRoundedButton), extraProps: { label: 'Operator:' } },
  { name: 'TXTINPLabelBottomRoundedButton', Component: asTxtInp(TXTINPLabelBottomRoundedButton), extraProps: { label: 'Notes:' } },
]

const SPECIAL_TXTINP_ALIAS_ENTRIES: TxtInpEntry[] = [
  { name: 'TXTINPWideButtonPrice', Component: asTxtInp(TXTINPWideButtonPrice) },
  { name: 'TXTINPLabelWideButtonPrice', Component: asTxtInp(TXTINPLabelWideButtonPrice), extraProps: { label: 'Fare' } },
  { name: 'TXTINPIconWideButtonSearch', Component: asTxtInp(TXTINPIconWideButtonSearch) },
  { name: 'TXTINPWideIconLabelBar', Component: asTxtInp(TXTINPWideIconLabelBar), extraProps: { labelPrefix: 'Name:', forceUppercase: true } },
]

const ButtonsPage: React.FC = () => {
  const [controlledIndex, setControlledIndex] = useState<number | null>(0)
  const [visited, setVisited] = useState(false)
  const [selectionDotSelected, setSelectionDotSelected] = useState(false)
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

  const renderTxtInpSection = (
    title: string,
    description: string,
    entries: TxtInpEntry[],
    keyPrefix: string,
    sectionExtraProps?: Record<string, unknown>,
  ) => (
    <section className="ds-buttons__section">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="ds-buttons__controls-grid">
        {entries.map(({ name, Component, extraProps }) => {
          const mergedExtraProps = { ...sectionExtraProps, ...extraProps }
          return (
            <article key={`${keyPrefix}-${name}`} className="ds-buttons__card">
              <h3>{name}</h3>
              <p className="ds-buttons__name-preview">File name: {name}</p>
              <div className="ds-buttons__state-stack">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div
                    key={`${keyPrefix}-${name}-${colorVariant}`}
                    className="ds-buttons__state-row ds-buttons__state-row--inputs"
                  >
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <div className="ds-buttons__txtinp-slot">
                      <Component
                        {...mergedExtraProps}
                        colorVariant={colorVariant}
                        placeholder="Active"
                      />
                    </div>
                    <div className="ds-buttons__txtinp-slot">
                      <Component
                        {...mergedExtraProps}
                        colorVariant={colorVariant}
                        defaultValue="Focused"
                        forceFocusedAppearance
                      />
                    </div>
                    <div className="ds-buttons__txtinp-slot">
                      <Component
                        {...mergedExtraProps}
                        colorVariant={colorVariant}
                        placeholder="Disabled"
                        disabled
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="ds-buttons-page">
      <PageTopHeader
        title="Buttons"
        subtitle="Clean reference for button states and one focused interactive demo section."
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
        <div className="ds-buttons">

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

        {renderTxtInpSection('Plain Text Inputs', 'Active, focused (flattened) and disabled states for the plain TXTINPBUT* family.', PLAIN_TXTINP_ENTRIES, 'plain')}
        {renderTxtInpSection('Icon Text Inputs', 'Icon-prefixed TXTINPBUT* variants \u2014 the leading icon mirrors the BUT* icon slot.', ICON_TXTINP_ENTRIES, 'icon', { icon: <SearchIcon /> })}
        {renderTxtInpSection('Label Text Inputs', 'Static label-prefixed TXTINPBUT* variants for key/value rows.', LABEL_TXTINP_ENTRIES, 'label')}
        {renderTxtInpSection('Special Text Inputs', 'Price (numeric + currency), Search (query API) and the icon\u2192label switcher bar.', SPECIAL_TXTINP_ENTRIES, 'special', { icon: <SearchIcon /> })}
        {renderTxtInpSection('Plain Text Inputs (TXTINP)', 'Alias TXTINP* variants matching TXTINPBUT plain behaviors.', PLAIN_TXTINP_ALIAS_ENTRIES, 'txtinp-plain')}
        {renderTxtInpSection('Icon Text Inputs (TXTINP)', 'Alias TXTINP icon variants matching TXTINPBUT icon behaviors.', ICON_TXTINP_ALIAS_ENTRIES, 'txtinp-icon', { icon: <SearchIcon /> })}
        {renderTxtInpSection('Label Text Inputs (TXTINP)', 'Alias TXTINP label variants for key/value style rows.', LABEL_TXTINP_ALIAS_ENTRIES, 'txtinp-label')}
        {renderTxtInpSection('Special Text Inputs (TXTINP)', 'Alias TXTINP special variants (price, search, icon/label bar).', SPECIAL_TXTINP_ALIAS_ENTRIES, 'txtinp-special', { icon: <SearchIcon /> })}

        <section className="ds-buttons__section">
          <h2>DDM Dropdown Buttons</h2>
          <p>Dropdown menu components replicated for web: base spacer, single action, and dual action variants.</p>
          <div className="ds-buttons__controls-grid">
            <article className="ds-buttons__card ds-buttons__card--full">
              <h3>BUTDDMList</h3>
              <p className="ds-buttons__name-preview">File name: BUTDDMList (decorative bottom spacer)</p>
              <div className="ds-buttons__ddm-grid">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`ddm-list-${colorVariant}`} className="ds-buttons__ddm-cell">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTDDMList
                      items={DDM_ITEMS}
                      filterName="Operators"
                      selectionMode="single"
                      colorVariant={colorVariant}
                      selectedPositions={[2]}
                    />
                  </div>
                ))}
              </div>
            </article>

            <article className="ds-buttons__card ds-buttons__card--full">
              <h3>BUTDDMListAction</h3>
              <p className="ds-buttons__name-preview">File name: BUTDDMListAction (Clear All action in multi mode)</p>
              <div className="ds-buttons__ddm-grid">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`ddm-action-${colorVariant}`} className="ds-buttons__ddm-cell">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTDDMListAction
                      items={DDM_ITEMS}
                      filterName="Operators"
                      selectionMode="multi"
                      colorVariant={colorVariant}
                      selectedPositions={[0, 3, 8]}
                      disabledPositions={[5]}
                    />
                  </div>
                ))}
              </div>
            </article>

            <article className="ds-buttons__card ds-buttons__card--full">
              <h3>BUTDDMListActionDual</h3>
              <p className="ds-buttons__name-preview">File name: BUTDDMListActionDual (Clear All + Select All in multi mode)</p>
              <div className="ds-buttons__ddm-grid">
                {COLOR_VARIANTS.map((colorVariant) => (
                  <div key={`ddm-dual-${colorVariant}`} className="ds-buttons__ddm-cell">
                    <span className="ds-buttons__variant-label">{colorVariant}</span>
                    <BUTDDMListActionDual
                      items={DDM_ITEMS}
                      filterName="Operators"
                      selectionMode="multi"
                      colorVariant={colorVariant}
                      selectedPositions={[1, 4]}
                      disabledPositions={[6, 7]}
                    />
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="ds-buttons__section">
          <h2>Text Card Examples</h2>
          <p>Android-style text card primitive with delayed spring-back press behavior and state-color variants.</p>
          <div className="ds-buttons__controls-grid">
            <article className="ds-buttons__card ds-buttons__card--full">
              <h3>TextCard</h3>
              <p className="ds-buttons__name-preview">File name: TextCard</p>
              <div className="ds-buttons__state-stack">
                {TEXT_CARD_STATES.map((textCardState) => (
                  <div key={`text-card-${textCardState}`} className="ds-buttons__text-card-row">
                    <span className="ds-buttons__variant-label">{textCardState}</span>
                    <div className="ds-buttons__text-card-slot">
                      <TextCard
                        state={textCardState}
                        title="Open Message"
                        description="Unread messages use accent; default applies once read."
                        onClick={() => handlePressPreview(`interactive-text-card-${textCardState}`)}
                        pressed={Boolean(clickedButtons[`interactive-text-card-${textCardState}`])}
                      />
                    </div>
                    <div className="ds-buttons__text-card-slot">
                      <TextCard
                        state={textCardState}
                        title="Pressed State"
                        description="Static pressed preview for style parity checks."
                        pressed
                      />
                    </div>
                    <div className="ds-buttons__text-card-slot">
                      <TextCard
                        state={textCardState}
                        title="Disabled State"
                        description="Non-interactive card with disabled tint treatment."
                        disabled
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="ds-buttons__text-card-fixed">
                <span className="ds-buttons__variant-label">fixed 325px</span>
                <div className="ds-buttons__text-card-fixed-slot">
                  <TextCard
                    state="default"
                    title="Fixed Width Card"
                    description="This example is constrained to exactly 325px wide."
                    onClick={() => handlePressPreview('interactive-text-card-fixed-300')}
                    pressed={Boolean(clickedButtons['interactive-text-card-fixed-300'])}
                  />
                </div>
              </div>
              <div className="ds-buttons__text-card-fixed">
                <span className="ds-buttons__variant-label">fill (flex)</span>
                <div className="ds-buttons__text-card-flex-slot">
                  <TextCard
                    state="default"
                    title="Flexible Width Card"
                    description="This example fills the remaining row width using flex."
                    onClick={() => handlePressPreview('interactive-text-card-flex-fill')}
                    pressed={Boolean(clickedButtons['interactive-text-card-flex-fill'])}
                  />
                </div>
              </div>

              <h3>SelectionDot</h3>
              <p className="ds-buttons__name-preview">File name: SelectionDot</p>
              <div className="ds-buttons__selection-dot-grid">
                <div className="ds-buttons__selection-dot-cell">
                  <span className="ds-buttons__variant-label">selected=false, disabled=false</span>
                  <TextCard
                    state="default"
                    title="Standard Plan"
                    description="SelectionDot shown in the TextCard trailing slot."
                    trailingIcon={<SelectionDot selected={false} />}
                  />
                </div>
                <div className="ds-buttons__selection-dot-cell">
                  <span className="ds-buttons__variant-label">selected=true, disabled=false</span>
                  <TextCard
                    state="default"
                    title="Standard Plan"
                    description="SelectionDot shown in the TextCard trailing slot."
                    trailingIcon={<SelectionDot selected />}
                  />
                </div>
                <div className="ds-buttons__selection-dot-cell">
                  <span className="ds-buttons__variant-label">selected=false, disabled=true</span>
                  <TextCard
                    state="default"
                    title="Standard Plan"
                    description="Disabled state with secondary-tint selection dot."
                    trailingIcon={<SelectionDot selected={false} disabled />}
                    disabled
                  />
                </div>
                <div className="ds-buttons__selection-dot-cell">
                  <span className="ds-buttons__variant-label">selected=true, disabled=true</span>
                  <TextCard
                    state="default"
                    title="Standard Plan"
                    description="Disabled state with selected selection dot."
                    trailingIcon={<SelectionDot selected disabled />}
                    disabled
                  />
                </div>
              </div>
              <div className="ds-buttons__selection-dot-toggle">
                <span className="ds-buttons__variant-label">interactive toggle</span>
                <div className="ds-buttons__selection-dot-toggle-card">
                  <TextCard
                    state="default"
                    title={selectionDotSelected ? 'Selected (click to clear)' : 'Unselected (click to select)'}
                    description="Click to toggle selection state in the trailing SelectionDot."
                    trailingIcon={<SelectionDot selected={selectionDotSelected} />}
                    onClick={() => setSelectionDotSelected((prev) => !prev)}
                  />
                </div>
              </div>
            </article>
          </div>
        </section>

        </div>
      </div>
    </div>
  )
}

export default ButtonsPage

