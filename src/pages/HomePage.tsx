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

const HOME_PRIMARY_HERO_IMAGE_SOURCES = {
  darkDesktopTablet: '/media/home/hero1/slide1/hometophero-desktop-tablet-dark.png',
  darkMobile: '/media/home/hero1/slide1/hometophero-mobile-dark.png',
  lightDesktopTablet: '/media/home/hero1/slide1/hometophero-desktop-tablet-light.png',
  lightMobile: '/media/home/hero1/slide1/hometophero-mobile-light.png'
} as const

const HOME_CAROUSEL_TOP_FEATURES_SLIDES: CarouselHeroSlide[] = [
  {
    title: 'A live station database, ready when you are',
    body: (
      <>
      <p>
        Start ticking off stations straight away with a live database built for rail enthusiasts.
        </p>
        <p>
        Whether you are just starting out or already have a long travel history, Rail Statistics is ready to grow with your journeys.
      </p>
      </>
    ),
    videoSources: {
      light: '/media/home/hero2/slide1/light.mp4',
      dark: '/media/home/hero2/slide1/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 80,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 21,
      tabletTopPercent: 22
    },
    autoPlayMs: 18_000
  },
  {
    title: 'Bring your existing station list with you',
    body: (
      <>
      <p>
        Already using your own file to keep track of visited stations?
        </p>
        <p>
        You can migrate it to work with the Rail
        Statistics database, making it easier to continue from where you left off.
      </p>
      </>
    ),
    videoSources: {
      light: '/media/home/hero2/slide2/light.mp4',
      dark: '/media/home/hero2/slide2/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 80,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 21,
      tabletTopPercent: 22
    },
    autoPlayMs: 18_000
  },
  {
    title: 'Stay updated when new stations open',
    body: (
      <>
      <p>
        Get notifications when new stations open, so there is no need to keep searching for the latest station details yourself.
        </p>
        <p>
        Rail Statistics helps you stay current as the network changes.
      </p>
      </>
    ),
    videoSources: {
      light: '/media/home/hero2/slide3/light.mp4',
      dark: '/media/home/hero2/slide3/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 80,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 21,
      tabletTopPercent: 22
    },
    autoPlayMs: 13_000
  },
  {
    title: 'See your progress on the map',
    body: (
      <>
      <p>
        View your station progress on the map and get a clearer picture of how far your travels have taken you.
        </p>
        <p>
        It is a simple and visual way to explore your journey history.
      </p>
      </>
    ),
    videoSources: {
      light: '/media/home/hero2/slide4/light.mp4',
      dark: '/media/home/hero2/slide4/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 80,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 21,
      tabletTopPercent: 22
    },
    autoPlayMs: 15_000
  }
]

const HOME_STATIC_STATION_DETAIL: CarouselHeroSlide = {
  title: 'Dive deeper with detailed station pages',
  body: (
    <>
    <p>
      Explore a wide range of station details,
      including yearly station usage figures from the Office of Rail and Road.
      </p>
      <p>
      When new data is released, Rail Statistics is updated
      so you can keep exploring with the latest information.
    </p>
    </>
  ),
  videoSources: {
    light: '/media/home/hero3/slide1/light.mp4',
    dark: '/media/home/hero3/slide1/dark.mp4'
  },
  mobileTabletMediaMode: 'uncropped',
  mobileTabletUncroppedSettings: {
    scaleSpeed: 3.5,
    maxScale: 1.9,
    mobileMediaWidthPercent: 85,
    tabletMediaWidthPercent: 80,
    imageTopPercent: 20,
    videoTopPercent: 23,
    tabletTopPercent: 25
  }
}

const HOME_STATIC_FAVOURITES: CarouselHeroSlide = {
  title: 'Keep track of the stations you love',
  body: (
    <>
    <p>
      Found a station that stands out to you? Now you can mark it as a favourite to easily find it later. 
      </p>
      <p>
      This is a great way to build your own shortlist of memorable places across the network.
    </p>
    </>
  )
}

const HOME_CAROUSEL_SEARCH_AND_FILTER_SLIDES: CarouselHeroSlide[] = [
  {
    title: 'Search your way',
    body: (
      <>
        <p>
        Find stations in list view or on the map by station name,
        National Rail CRS code, or TIPLOC code.
        </p>
        <p>
        Whether you search casually or know exactly what you are looking for, Rail Statistics helps you get there faster.
      </p>
    </>
    ),
    videoSources: {
      light: '/media/home/hero5/slide1/light.mp4',
      dark: '/media/home/hero5/slide1/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 85,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 23,
      tabletTopPercent: 22
    },
    autoPlayMs: 17_000
  },
  {
    title: 'Filter stations with more control',
    body: (
      <>
        <p>
        Use advanced filters to browse stations by country, county, and operator.
        </p>
        <p>
        You can also narrow down stations within Greater London
        by all 33 London boroughs for more detailed exploration.
        </p>
      </>
    ),
    videoSources: {
      light: '/media/home/hero5/slide2/light.mp4',
      dark: '/media/home/hero5/slide2/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 85,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 23,
      tabletTopPercent: 22
    },
    autoPlayMs: 44_000
  }
]

const HOME_STATIC_EASY_VISIT_TRACKING: CarouselHeroSlide = {
  title: 'A simple way to remember when you visited',
  body: (
    <>
      <p>
        When you mark a station as visited,
        Rail Statistics automatically adds the current date by default.
      </p>
      <p>
        That makes it easy to keep track of when each visit happened
        as your journey history grows.
      </p>
    </>
  ),
  videoSources: {
    light: '/media/home/hero6/slide1/light.mp4',
    dark: '/media/home/hero6/slide1/dark.mp4'
  },
  mobileTabletMediaMode: 'uncropped',
  mobileTabletUncroppedSettings: {
    scaleSpeed: 3.5,
    maxScale: 1.9,
    mobileMediaWidthPercent: 85,
    tabletMediaWidthPercent: 70,
    imageTopPercent: 20,
    videoTopPercent: 23,
    tabletTopPercent: 25
  }
}

const HOME_CAROUSEL_SUBSCRIPTION_SLIDES: CarouselHeroSlide[] = [
  {
    title: 'Enjoy an ad-free experience',
    body: (
      <>
        <p>
          Included with Standard Premium and First Class,
          an ad-free experience lets you focus fully on tracking your
          journeys without distractions.
        </p>
      </>
    ),
    videoSources: {
      light: '/media/home/hero7/slide1/light.mp4',
      dark: '/media/home/hero7/slide1/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 85,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 22,
      tabletTopPercent: 23
    },
    autoPlayMs: 15_000
  },
  {
    title: 'Unlock home-screen widgets',
    body: (
      <>
        <p>
          Included with Standard Premium and First Class,
          home-screen widgets make it easy to keep your station visit
          progress visible at a glance every day.
        </p>
      </>
    ),
    videoSources: {
      light: '/media/home/hero7/slide2/light.mp4',
      dark: '/media/home/hero7/slide2/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 85,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 22,
      tabletTopPercent: 23
    },
    autoPlayMs: 15_000
  },
  {
    title: 'Be first to try ticket tracking in beta',
    body: (
      <>
        <p>
          Exclusive to First Class, be the first to try Ticket Tracking in beta when it launches in beta in summer 2026.
        </p>
      </>
    ),
    videoSources: {
      light: '/media/home/hero7/slide3/light.mp4',
      dark: '/media/home/hero7/slide3/dark.mp4'
    },
    mobileTabletMediaMode: 'uncropped',
    mobileTabletUncroppedSettings: {
      scaleSpeed: 3.5,
      maxScale: 1.9,
      mobileMediaWidthPercent: 85,
      tabletMediaWidthPercent: 70,
      imageTopPercent: 20,
      videoTopPercent: 22,
      tabletTopPercent: 23
    },
    autoPlayMs: 15_000
  }
]

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
      ctas: [{ label: 'Download Now', onClick: onDownloadCta }],
      imageSources: HOME_PRIMARY_HERO_IMAGE_SOURCES
    }),
    [onDownloadCta]
  )

  return (
    <div className="container">
      <div className="main">
          {/* Hero 1: Primary download splash */}
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

        {/* Hero 2: Top features carousel */}
        <div className="home-page__hero-row">
          <CarouselHero
            slides={HOME_CAROUSEL_TOP_FEATURES_SLIDES}
            ariaLabel="Top features"
            titleHeadingLevel={2}
            pauseOnHover={false}
            pauseOnFocusWithin={false}
          />
        </div>

        {/* Hero 3: Detailed station pages */}
        <div className="home-page__hero-row">
          <StaticHero
            slide={HOME_STATIC_STATION_DETAIL}
            ariaLabel="Detailed station pages"
            desktopContentVerticalAlign="center"
            desktopPanelSide="right"
            titleHeadingLevel={2}
          />
        </div>

        {/* Hero 4: Favourite stations */}
        <div className="home-page__hero-row">
          <StaticHero
            slide={HOME_STATIC_FAVOURITES}
            ariaLabel="Favourite stations"
            className="home-page__hero-favourites-mobile-image-bottom"
            contentFill="heroTint"
            desktopContentVerticalAlign="center"
            desktopPanelSide="right"
            mobilePanelPosition="top"
            titleHeadingLevel={2}
          />
        </div>

        {/* Hero 5: Search and filtering carousel */}
        <div className="home-page__hero-row">
          <CarouselHero
            slides={HOME_CAROUSEL_SEARCH_AND_FILTER_SLIDES}
            ariaLabel="Search and filtering options"
            titleHeadingLevel={2}
            pauseOnHover={false}
            pauseOnFocusWithin={false}
          />
        </div>

        {/* Hero 6: Easy visit tracking */}
        <div className="home-page__hero-row">
          <StaticHero
            slide={HOME_STATIC_EASY_VISIT_TRACKING}
            ariaLabel="Easy visit tracking"
            desktopContentVerticalAlign="center"
            desktopPanelSide="right"
            titleHeadingLevel={2}
          />
        </div>

        {/* Hero 7: Subscription features carousel */}
        <div className="home-page__hero-row">
          <CarouselHero
            slides={HOME_CAROUSEL_SUBSCRIPTION_SLIDES}
            ariaLabel="Subscription features"
            titleHeadingLevel={2}
            pauseOnHover={false}
            pauseOnFocusWithin={false}
          />
        </div>

        {/* Hero 8: Closing download splash */}
        <div className="home-page__hero-row">
          <StaticHero
            slide={homePrimarySlide}
            ariaLabel="Download Rail Statistics"
            contentFill="heroTint"
            textStyle="splash"
            desktopContentVerticalAlign="center"
            titleHeadingLevel={2}
          />
        </div>
      </div>
    </div>
  )
}

export default HomePage
