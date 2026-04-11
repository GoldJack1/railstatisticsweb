import React from 'react'
import '../components/Home.css'
import HomeTopHero from '../components/home/HomeTopHero'
import HomeHero, { type HomeHeroSlide } from '../components/home/HomeHero'

const IOS_APP_URL = 'https://apps.apple.com/gb/app/rail-statistics/id6759503043'

/** Optional per slide: `imageSources` (partial ok) + `imageAlt` — see `HomeHeroSlide` in `HomeHero.tsx`. */
const HERO_SLIDES: HomeHeroSlide[] = [
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

