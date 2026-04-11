import React, { useCallback, useEffect, useMemo, useState } from 'react'
import '../components/Home.css'
import CarouselHero, { type CarouselHeroSlide } from '../components/home/CarouselHero'
import HomeDownloadPlatformModal from '../components/home/HomeDownloadPlatformModal'
import StaticHero from '../components/home/StaticHero'
import { preventSingleWordWidow } from '../utils/textWidow'

const IOS_APP_URL = 'https://apps.apple.com/gb/app/rail-statistics/id6759503043'
const ANDROID_APP_URL =
  'https://play.google.com/store/apps/details?id=com.jw.railstatisticsandroid.beta&pli=1'

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

const HOME_PRIMARY_SUBTITLE =
  "Start building a map of where you've been, one station at a time."

/** Optional per slide: `imageSources` (partial ok) + `imageAlt` — see `CarouselHeroSlide` in `CarouselHero.tsx`. */
const HERO_SLIDES: CarouselHeroSlide[] = [
  {
    title: 'Track Stations in Just One Click!',
    body: (
      <>
        <p>Find any station fast in list view or map view.</p>
        <p>Update station status in one click, instantly date-stamped.</p>
        <p>Upgrade to First Class to unlock one-click station updates directly on the map.</p>
      </>
    )
  },
  {
    title: 'See every visit on the map',
    body: (
      <>
        <p>Visualise the stations you have visited and the ones still on your list in one interactive map.</p>
        <p>Pan, zoom, and tap stations to open rich detail without leaving your flow.</p>
        <p>First Class subscribers can use the Station Action Bar to update visits and favourites in a single tap.</p>
      </>
    ),
    ctas: [{ label: 'Download Now', href: IOS_APP_URL, target: '_blank' }]
  },
  {
    title: 'Usage data and instant updates',
    body: (
      <>
        <p>Browse passenger usage figures for National Rail stations, with history back to 1998 and annual refreshes.</p>
        <p>Get notified when new stations open—our cloud database keeps everyone on the latest network.</p>
        <p>Start free, then upgrade when you are ready for deeper tools.</p>
      </>
    ),
    ctas: [
      { label: 'Browse stations', onClick: () => undefined },
      { label: 'See pricing', onClick: () => undefined }
    ]
  }
]

/** Demo: desktop text column aligned to the top (`desktopContentVerticalAlign="top"`) + one CTA. */
const STATIC_HERO_EXAMPLE_SINGLE_CTA: CarouselHeroSlide = {
  title: 'Example — top alignment, single CTA',
  body: (
    <p>
      On wide desktop the copy and button sit toward the <strong>top</strong> of the left panel. Narrower breakpoints
      keep the stacked layout unchanged.
    </p>
  ),
  ctas: [{ label: 'Primary action', href: IOS_APP_URL, target: '_blank' }]
}

/** Demo: desktop text column vertically centered + two CTAs. */
const STATIC_HERO_EXAMPLE_DUAL_CTA: CarouselHeroSlide = {
  title: 'Example — centered block, dual CTAs',
  body: (
    <p>
      Here the copy + CTA group is <strong>vertically centered</strong> in the desktop content column. Two buttons use
      the multi-CTA row layout.
    </p>
  ),
  ctas: [
    { label: 'First action', onClick: () => undefined },
    { label: 'Second action', onClick: () => undefined }
  ]
}

/** Demo: no CTAs, desktop copy column aligned to the top. */
const STATIC_HERO_EXAMPLE_NO_CTA_TOP: CarouselHeroSlide = {
  title: 'Example — top alignment, no CTAs',
  body: (
    <p>
      Same static hero layout with <strong>no buttons</strong>; on wide desktop the text block sits toward the{' '}
      <strong>top</strong> of the panel.
    </p>
  )
}

/** Demo: no CTAs, desktop copy column vertically centered. */
const STATIC_HERO_EXAMPLE_NO_CTA_CENTER: CarouselHeroSlide = {
  title: 'Example — centered, no CTAs',
  body: (
    <p>
      Copy only: on desktop the text group is <strong>vertically centered</strong> in the left column, with no CTA row
      below.
    </p>
  )
}

/** Demo: `textStyle="splash"` — splash headline/body scale at all widths; title steps up at 1200px. */
const STATIC_HERO_EXAMPLE_SPLASH: CarouselHeroSlide = {
  title: 'Splash style — big type on desktop',
  body: (
    <p>
      From <strong>1200px</strong> up, this block uses the same headline and subcopy scale as the home top hero. Below
      that width you still get the standard static hero typography.
    </p>
  )
}

const HomePage: React.FC = () => {
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  const onDownloadCta = useCallback(() => {
    if (platform === 'ios') {
      window.location.href = IOS_APP_URL
    } else if (platform === 'android') {
      window.location.href = ANDROID_APP_URL
    } else {
      setDownloadModalOpen(true)
    }
  }, [platform])

  const homePrimarySlide = useMemo(
    (): CarouselHeroSlide => ({
      title: 'The Ultimate Station Bashing App is Here!',
      body: <p>{preventSingleWordWidow(HOME_PRIMARY_SUBTITLE)}</p>,
      ctas: [{ label: 'Download Now', onClick: onDownloadCta }]
    }),
    [onDownloadCta]
  )

  return (
    <div className="container">
      <div className="main">
        <div className="home-page__top-static-hero">
          <StaticHero
            slide={homePrimarySlide}
            ariaLabel="Download Rail Statistics"
            /* Splash type scale + desktop: copy + CTA vertically centered in the left panel (≥1200px). */
            textStyle="splash"
            desktopContentVerticalAlign="center"
            titleHeadingLevel={1}
            imageLoading="eager"
          />
        </div>

        <HomeDownloadPlatformModal open={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} />

        <div className="home-page__carousel-hero">
          <CarouselHero slides={HERO_SLIDES} />
        </div>

        <div className="home-page__static-hero-examples">
          <StaticHero
            slide={STATIC_HERO_EXAMPLE_SINGLE_CTA}
            ariaLabel="Static hero example: single CTA, top-aligned on desktop"
            desktopContentVerticalAlign="top"
          />
          <StaticHero
            slide={STATIC_HERO_EXAMPLE_DUAL_CTA}
            ariaLabel="Static hero example: two CTAs, vertically centered on desktop"
            desktopContentVerticalAlign="center"
          />
          <StaticHero
            slide={STATIC_HERO_EXAMPLE_NO_CTA_TOP}
            ariaLabel="Static hero example: no CTAs, top-aligned on desktop"
            desktopContentVerticalAlign="top"
          />
          <StaticHero
            slide={STATIC_HERO_EXAMPLE_NO_CTA_CENTER}
            ariaLabel="Static hero example: no CTAs, vertically centered on desktop"
            desktopContentVerticalAlign="center"
          />
        </div>

        <StaticHero
          slide={STATIC_HERO_EXAMPLE_SPLASH}
          ariaLabel="Static hero example: splash text style"
          textStyle="splash"
        />
      </div>
    </div>
  )
}

export default HomePage
