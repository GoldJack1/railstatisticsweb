import React from 'react'
import '../components/Home.css'
import HomeTopHero from '../components/home/HomeTopHero'
import HomeHero, { DEFAULT_IMAGE_SOURCES, type HomeHeroSlide } from '../components/home/HomeHero'

const HERO_SLIDES: HomeHeroSlide[] = [
  {
    title: 'Rail Statistics is Officially Live!',
    body: (
      <>
        <p>After a year of development, the ultimate station tracker is out of beta.</p>
        <p>Download now and start logging your journeys.</p>
        <p>
          Explore comprehensive data for every station, visualise your visits on an interactive map, and get real-time
          alerts the second a new station opens.
        </p>
      </>
    ),
    imageAlt: 'Rail Statistics app preview',
    imageSources: DEFAULT_IMAGE_SOURCES
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
    imageAlt: 'Rail Statistics map and station list preview',
    imageSources: DEFAULT_IMAGE_SOURCES
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
    imageAlt: 'Rail Statistics insights and notifications preview',
    imageSources: DEFAULT_IMAGE_SOURCES
  }
]

const HomePage: React.FC = () => {
  return (
    <div className="container">
      <div className="main">
        <HomeTopHero />

        <HomeHero
          slides={HERO_SLIDES}
          primaryCtaLabel="Download on iOS"
          secondaryCtaLabel="Download on Android"
        />
      </div>
    </div>
  )
}

export default HomePage

