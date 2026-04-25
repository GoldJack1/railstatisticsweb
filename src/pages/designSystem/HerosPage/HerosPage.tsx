import React, { type MouseEvent } from 'react'
import { BUTWideButton } from '../../../components/buttons'
import CarouselHero from '../../../components/heros/CarouselHero/CarouselHero'
import StaticHero from '../../../components/heros/StaticHero/StaticHero'
import type { ButtonColorVariant } from '../../../components/buttons/base/BUTBaseButton/BUTBaseButton'
import type { CarouselHeroSlide } from '../../../components/models/heroCarouselSlideModel'
import './HerosPage.css'

/** Design-system demos: block in-app navigation from placeholder CTAs. */
function preventDefaultNav(e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) {
  e.preventDefault()
}

const SHORT_BODY = (
  <p>
    Supporting copy uses the hero body style. Toggle light and dark theme to check contrast on both the text panel
    gradient and the art.
  </p>
)

const SLIDE_TEXT_HERO: CarouselHeroSlide = {
  title: 'Text style: hero (default)',
  body: (
    <>
      <p>
        Default title and body scale for band heroes. This is the same <code>textStyle=&quot;hero&quot;</code> used on the
        home carousel and static blocks.
      </p>
      {SHORT_BODY}
    </>
  )
}

const SLIDE_TEXT_SPLASH: CarouselHeroSlide = {
  title: 'Text style: splash',
  body: (
    <>
      <p>
        From 1200px width, splash uses larger headline and subcopy. Below that, typography matches the standard hero
        band.
      </p>
      {SHORT_BODY}
    </>
  )
}

const SLIDE_FILL_SECONDARY: CarouselHeroSlide = {
  title: 'Panel fill: page secondary',
  body: (
    <p>
      <code>contentFill=&quot;bgSecondary&quot;</code> — the text panel gradient uses <code>var(--bg-secondary)</code> where
      it is opaque before fading out.
    </p>
  )
}

const SLIDE_FILL_TINT: CarouselHeroSlide = {
  title: 'Panel fill: hero tint',
  body: (
    <p>
      <code>contentFill=&quot;heroTint&quot;</code> — gradient solid stops use the same tint as the hero image band (light{' '}
      <code>hsl(354 100% 85%)</code> / dark <code>hsl(0 100% 8%)</code>).
    </p>
  )
}

const SLIDE_NO_CTA: CarouselHeroSlide = {
  title: 'No CTAs',
  body: <p>Copy only; no button row. Useful for announcement-only heroes.</p>
}

const SLIDE_ONE_CTA: CarouselHeroSlide = {
  title: 'Single CTA',
  body: <p>One wide button respects the desktop max width; on narrow viewports it stretches full width.</p>,
  ctas: [{ label: 'Primary action', onClick: preventDefaultNav }]
}

const SLIDE_TWO_CTA: CarouselHeroSlide = {
  title: 'Two CTAs',
  body: <p>Two buttons use the multi-CTA row rules on wide desktop (side by side with inset).</p>,
  ctas: [
    { label: 'First', onClick: preventDefaultNav },
    { label: 'Second', onClick: preventDefaultNav }
  ]
}

const BUTTON_COLOR_VARIANTS: ButtonColorVariant[] = ['primary', 'secondary', 'accent', 'green-action', 'red-action']

function slideForButtonColor(variant: ButtonColorVariant): CarouselHeroSlide {
  return {
    title: `CTA colour: ${variant}`,
    body: (
      <p>
        <code>{`{ label, colorVariant: '${variant}' }`}</code>
      </p>
    ),
    ctas: [{ label: `Sample — ${variant}`, onClick: preventDefaultNav, colorVariant: variant }]
  }
}

const SLIDE_LAYOUT_DEMO: CarouselHeroSlide = {
  title: 'Layout placement',
  body: (
    <p>
      <code>desktopPanelSide</code> flips which half holds the copy on desktop (≥1200px). <code>mobilePanelPosition</code>{' '}
      moves the stacked copy band to the top or bottom under 1200px.
    </p>
  ),
  ctas: [{ label: 'Sample CTA', onClick: preventDefaultNav }]
}

const CAROUSEL_LAYOUT_SLIDES: CarouselHeroSlide[] = [
  {
    title: 'Carousel + right panel',
    body: <p>Same carousel chrome with the copy column on the right on desktop.</p>,
    ctas: [{ label: 'Next slide', onClick: preventDefaultNav }]
  },
  {
    title: 'Second slide',
    body: <p>Autoplay and controls behave the same as the default layout.</p>
  }
]

const CAROUSEL_SHOWCASE_SLIDES: CarouselHeroSlide[] = [
  {
    title: 'Carousel — slide 1',
    body: <p>Autoplay, dots, and prev/next controls. Pause behaviour follows product defaults.</p>,
    ctas: [{ label: 'Accent CTA', onClick: preventDefaultNav, colorVariant: 'accent' }]
  },
  {
    title: 'Carousel — slide 2',
    body: <p>Second slide with two CTAs to show the row layout inside the carousel copy panel.</p>,
    ctas: [
      { label: 'Secondary', onClick: preventDefaultNav, colorVariant: 'secondary' },
      { label: 'Primary', onClick: preventDefaultNav, colorVariant: 'primary' }
    ]
  },
  {
    title: 'Carousel — slide 3',
    body: <p>Third slide, copy only.</p>
  }
]

const HerosPage: React.FC = () => {
  return (
    <div className="container">
      <div className="ds-heros">
        <BUTWideButton to="/design-system" width="hug" colorVariant="primary" className="rs-button--text-size">
          ← Back to Design System
        </BUTWideButton>

        <header className="ds-heros__header">
          <h1>Heroes</h1>
          <p>
            Live specimens of <code>StaticHero</code> and <code>CarouselHero</code>: typography scale, text-panel fill,
            layout placement, CTA count, button colour variants, and carousel behaviour. Full-bleed layout matches the home
            page.
          </p>
        </header>

        <section className="ds-heros__section">
          <h2>Panel placement</h2>
          <p>
            Defaults match the home page: copy on the <strong>left</strong> on desktop, stacked toward the{' '}
            <strong>bottom</strong> on narrow viewports. Override with <code>desktopPanelSide</code> and{' '}
            <code>mobilePanelPosition</code>.
          </p>
          <div className="ds-heros__stack">
            <div>
              <p className="ds-heros__meta">Defaults — desktop left / mobile bottom (omit props)</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_LAYOUT_DEMO}
                  imageLoading="lazy"
                  ariaLabel="Design system: layout defaults"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
            <div>
              <p className="ds-heros__meta">desktopPanelSide=&quot;right&quot; · mobile bottom</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_LAYOUT_DEMO}
                  desktopPanelSide="right"
                  imageLoading="lazy"
                  ariaLabel="Design system: desktop panel right"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
            <div>
              <p className="ds-heros__meta">desktop left · mobilePanelPosition=&quot;top&quot;</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_LAYOUT_DEMO}
                  mobilePanelPosition="top"
                  imageLoading="lazy"
                  ariaLabel="Design system: mobile panel top"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
            <div>
              <p className="ds-heros__meta">desktopPanelSide=&quot;right&quot; · mobilePanelPosition=&quot;top&quot;</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_LAYOUT_DEMO}
                  desktopPanelSide="right"
                  mobilePanelPosition="top"
                  imageLoading="lazy"
                  ariaLabel="Design system: panel right and mobile top"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
            <div>
              <p className="ds-heros__meta">Carousel: right desktop + mobile top</p>
              <div className="ds-heros__hero-slot">
                <CarouselHero
                  slides={CAROUSEL_LAYOUT_SLIDES}
                  desktopPanelSide="right"
                  mobilePanelPosition="top"
                  autoPlayMs={9000}
                  pauseOnHover={false}
                  pauseOnFocusWithin={false}
                  ariaLabel="Design system: carousel layout"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="ds-heros__section">
          <h2>Text styling</h2>
          <p>Compare default band type with splash scaling on large desktop.</p>
          <div className="ds-heros__stack">
            <div>
              <p className="ds-heros__meta">textStyle=&quot;hero&quot; (default)</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_TEXT_HERO}
                  textStyle="hero"
                  imageLoading="eager"
                  ariaLabel="Design system: hero text style"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
            <div>
              <p className="ds-heros__meta">textStyle=&quot;splash&quot;</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_TEXT_SPLASH}
                  textStyle="splash"
                  imageLoading="lazy"
                  ariaLabel="Design system: splash text style"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="ds-heros__section">
          <h2>Text panel background (content fill)</h2>
          <p>Gradient solid stops: page secondary surface versus the hero band tint.</p>
          <div className="ds-heros__stack">
            <div>
              <p className="ds-heros__meta">contentFill=&quot;bgSecondary&quot;</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_FILL_SECONDARY}
                  contentFill="bgSecondary"
                  imageLoading="lazy"
                  ariaLabel="Design system: content fill bg secondary"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
            <div>
              <p className="ds-heros__meta">contentFill=&quot;heroTint&quot;</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_FILL_TINT}
                  contentFill="heroTint"
                  imageLoading="lazy"
                  ariaLabel="Design system: content fill hero tint"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="ds-heros__section">
          <h2>CTA count</h2>
          <p>None, one, or two wide buttons in the static hero CTA row.</p>
          <div className="ds-heros__stack">
            <div>
              <p className="ds-heros__meta">0 CTAs</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_NO_CTA}
                  imageLoading="lazy"
                  ariaLabel="Design system: no CTA"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
            <div>
              <p className="ds-heros__meta">1 CTA</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_ONE_CTA}
                  imageLoading="lazy"
                  ariaLabel="Design system: single CTA"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
            <div>
              <p className="ds-heros__meta">2 CTAs</p>
              <div className="ds-heros__hero-slot">
                <StaticHero
                  slide={SLIDE_TWO_CTA}
                  imageLoading="lazy"
                  ariaLabel="Design system: dual CTA"
                  titleHeadingLevel={2}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="ds-heros__section">
          <h2>CTA button colours</h2>
          <p>
            Each slide sets <code>colorVariant</code> on the CTA (same tokens as <code>Button</code>). Home production
            heroes default to accent when omitted.
          </p>
          <div className="ds-heros__stack">
            {BUTTON_COLOR_VARIANTS.map((variant) => (
              <div key={variant}>
                <p className="ds-heros__meta">colorVariant=&quot;{variant}&quot;</p>
                <div className="ds-heros__hero-slot">
                  <StaticHero
                    slide={slideForButtonColor(variant)}
                    imageLoading="lazy"
                    ariaLabel={`Design system: CTA ${variant}`}
                    titleHeadingLevel={2}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ds-heros__section">
          <h2>Carousel</h2>
          <p>
            Multi-slide <code>CarouselHero</code> with autoplay (8s), indicators, and keyboard-focus behaviour.{' '}
            <code>contentFill=&quot;bgSecondary&quot;</code> here; try <code>heroTint</code> on the home page carousel for the
            alternate panel fill.
          </p>
          <div className="ds-heros__hero-slot">
            <CarouselHero
              slides={CAROUSEL_SHOWCASE_SLIDES}
              autoPlayMs={8000}
              pauseOnHover={false}
              pauseOnFocusWithin={false}
              ariaLabel="Design system carousel"
              titleHeadingLevel={2}
            />
          </div>
        </section>

        <section className="ds-heros__section">
          <h2>Carousel + hero tint panel</h2>
          <p>Same carousel shell with the text panel tied to the hero band tint.</p>
          <div className="ds-heros__hero-slot">
            <CarouselHero
              slides={CAROUSEL_SHOWCASE_SLIDES}
              contentFill="heroTint"
              autoPlayMs={12000}
              pauseOnHover={false}
              pauseOnFocusWithin={false}
              ariaLabel="Design system carousel hero tint"
              titleHeadingLevel={2}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

export default HerosPage
