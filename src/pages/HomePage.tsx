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

/** First carousel below the fold: three slides. */
const HOME_CAROUSEL_THREE_SLIDES: CarouselHeroSlide[] = [
  {
    title: 'Track stations in one tap',
    body: (
      <>
        <p>Search and filter thousands of National Rail stations from a fast list or an interactive map.</p>
        <p>Mark visited, planned, or favourite in a single action—each change is date-stamped automatically.</p>
      </>
    )
  },
  {
    title: 'See every visit on the map',
    body: (
      <>
        <p>Pan and zoom across Great Britain with stations plotted where you expect them.</p>
        <p>Open rich detail for any station without losing your place on the map.</p>
      </>
    ),
    ctas: [{ label: 'Download on iOS', href: IOS_APP_URL, target: '_blank' }]
  },
  {
    title: 'Upgrade when you need more',
    body: (
      <>
        <p>Start free with core logging tools, then move to First Class for deeper map workflows and batch updates.</p>
        <p>One subscription covers your signed-in devices; your data stays tied to your account.</p>
      </>
    ),
    ctas: [{ label: 'Get the Android app', href: ANDROID_APP_URL, target: '_blank' }]
  }
]

const HOME_STATIC_STATIONS: CarouselHeroSlide = {
  title: 'A living station database',
  body: (
    <>
      <p>
        CRS codes, coordinates, TOC, fare zones, and London borough fields are kept current in the cloud—when the
        network changes, your app and this website update together.
      </p>
      <p>Browse the same authoritative list on the web when you are at a desk, and pick it up in the app on the move.</p>
    </>
  ),
  ctas: [{ label: 'Browse stations', href: '/stations', target: '_self' }]
}

const HOME_STATIC_USAGE: CarouselHeroSlide = {
  title: 'Passenger usage you can trust',
  body: (
    <>
      <p>Annual entries and totals for stations go back to 1998, with a consistent methodology year on year.</p>
      <p>Use the figures to plan trips, compare hubs, or settle curiosity about how busy a line has become.</p>
    </>
  )
}

/** Second carousel: four slides. */
const HOME_CAROUSEL_FOUR_SLIDES: CarouselHeroSlide[] = [
  {
    title: 'List and map, same account',
    body: (
      <p>
        Switch between dense tables and a map canvas whenever the task suits—filters and sort orders follow you between
        views on web and mobile.
      </p>
    )
  },
  {
    title: 'Visits that remember the day',
    body: (
      <p>
        Every status change records when it happened so you can reconstruct a trip months later or export a clear
        history for yourself.
      </p>
    )
  },
  {
    title: 'Figures for planners and bashers',
    body: (
      <p>
        Compare stations by usage band, spot fast-growing hubs, and notice when new platforms open—all without leaving
        Rail Statistics.
      </p>
    )
  },
  {
    title: 'Ready when you are',
    body: (
      <>
        <p>Install on iPhone, iPad, or Android, or stay in the browser—pick the surface that fits the moment.</p>
        <p>Sign in once; pending reviews and edits line up the same wherever you work.</p>
      </>
    ),
    ctas: [{ label: 'Download now', href: IOS_APP_URL, target: '_blank' }]
  }
]

const HOME_STATIC_WEB: CarouselHeroSlide = {
  title: 'This website mirrors the app',
  body: (
    <>
      <p>
        Manage stations, review pending contributions, and read the same legal and policy pages you see in product—all
        from a responsive layout tuned for keyboard and large screens.
      </p>
      <p>Heavy editing workflows stay here; quick logging stays in your pocket.</p>
    </>
  ),
  ctas: [{ label: 'Log in', href: '/log-in', target: '_self' }]
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
            textStyle="splash"
            desktopContentVerticalAlign="center"
            titleHeadingLevel={1}
            imageLoading="eager"
          />
        </div>

        <HomeDownloadPlatformModal open={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} />

        <div className="home-page__hero-row">
          <CarouselHero
            slides={HOME_CAROUSEL_THREE_SLIDES}
            ariaLabel="Rail Statistics highlights"
            titleHeadingLevel={2}
            pauseOnHover={false}
            pauseOnFocusWithin={false}
          />
        </div>

        <div className="home-page__hero-row">
          <StaticHero slide={HOME_STATIC_STATIONS} ariaLabel="Station database" titleHeadingLevel={2} />
        </div>

        <div className="home-page__hero-row">
          <StaticHero slide={HOME_STATIC_USAGE} ariaLabel="Passenger usage data" titleHeadingLevel={2} />
        </div>

        <div className="home-page__hero-row">
          <CarouselHero
            slides={HOME_CAROUSEL_FOUR_SLIDES}
            ariaLabel="Product details"
            titleHeadingLevel={2}
            pauseOnHover={false}
            pauseOnFocusWithin={false}
          />
        </div>

        <div className="home-page__hero-row">
          <StaticHero slide={HOME_STATIC_WEB} ariaLabel="Website and account" titleHeadingLevel={2} />
        </div>
      </div>
    </div>
  )
}

export default HomePage
