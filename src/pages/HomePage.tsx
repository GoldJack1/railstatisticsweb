import React from 'react'
import '../components/Home.css'
import HomeTopHero from '../components/home/HomeTopHero'
import HomeHero, { DEFAULT_IMAGE_SOURCES, type HomeHeroSlide } from '../components/home/HomeHero'

const HERO_SLIDES: HomeHeroSlide[] = [
  {
    title: 'Track Stations in Just One Click!',
    body: (
      <>
        <p>Find any station fast in list view or map view.</p>
        <p>Update station status in one click, instantly date-stamped.</p>
        <p>Upgrade to First Class to unlock one-click station updates directly on the map.</p>
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
        />
      </div>
    </div>
  )
}

export default HomePage

