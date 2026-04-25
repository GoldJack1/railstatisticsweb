import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Station } from '../../types'
import Button from '../../components/BUTMappedButton'
import ButtonBar from '../../components/BUTMappedButtonBar'
import NavigationButton from '../../components/NavigationButton'
import NavLink from '../../components/NavLink'
import VisitButton from '../../components/BUTMappedVisitButton'
import StationModal from '../../components/StationModal'
import StationEditModal from '../../components/StationEditModal'
import NewStationModal from '../../components/NewStationModal'
import '../../components/DesignSystemComponents.css'

const COMPONENT_GROUPS = [
  {
    title: 'Application Shell',
    items: [
      { name: 'Header', file: 'src/components/Header.tsx', usage: 'Logo + theme toggle only; legal and auth are in the footer' },
      { name: 'Footer', file: 'src/components/Footer.tsx', usage: 'Migration & Stations when signed in; legal links; Log in / Log out' },
    ],
  },
  {
    title: 'Navigation and Actions',
    items: [
      { name: 'NavigationButton', file: 'src/components/NavigationButton.tsx', usage: 'Route-based button nav' },
      { name: 'BUTMappedButton', file: 'src/components/BUTMappedButton.tsx', usage: 'Maps legacy props onto BUT* wrappers' },
      { name: 'BUTMappedButtonBar', file: 'src/components/BUTMappedButtonBar.tsx', usage: 'Routes grouped actions to BUT bar wrappers' },
      { name: 'BUTMappedVisitButton', file: 'src/components/BUTMappedVisitButton.tsx', usage: 'Visited/not-visited status control' },
    ],
  },
  {
    title: 'Content and Data UI',
    items: [
      { name: 'StationModal', file: 'src/components/StationModal.tsx', usage: 'Station details and metadata' },
      { name: 'StationEditModal', file: 'src/components/StationEditModal.tsx', usage: 'Station editing workflow' },
      { name: 'NewStationModal', file: 'src/components/NewStationModal.tsx', usage: 'Create station workflow' },
      { name: 'Stations', file: 'src/components/Stations.tsx', usage: 'Primary data table and filters' },
    ],
  },
]

const EXAMPLE_STATION: Station = {
  id: 'DS001',
  stationName: 'Design System Central',
  crsCode: 'DSC',
  tiploc: 'DSCENTRL',
  latitude: 51.5074,
  longitude: -0.1278,
  country: 'England',
  county: 'Greater London',
  toc: 'Sample TOC',
  stnarea: 'Central',
  londonBorough: 'City of Westminster',
  fareZone: '1',
  yearlyPassengers: {
    '2023': 1234567,
    '2024': 1456789,
    '2025': 1678901,
  },
}

const ComponentsPage: React.FC = () => {
  const [isVisited, setIsVisited] = useState(false)
  const [selectedButtonBar, setSelectedButtonBar] = useState<number | null>(0)
  const [showStationModal, setShowStationModal] = useState(false)
  const [showStationEditModal, setShowStationEditModal] = useState(false)
  const [showNewStationModal, setShowNewStationModal] = useState(false)

  return (
    <div className="container">
      <div className="ds-components">
        <NavigationButton to="/design-system" variant="wide" width="hug" colorVariant="primary" className="rs-button--text-size">
          ← Back to Design System
        </NavigationButton>
        <header className="ds-components__header">
          <h1>Design System Components</h1>
          <p>Catalogue of high-level components and where they are used in the product.</p>
        </header>

        {COMPONENT_GROUPS.map((group) => (
          <section key={group.title} className="ds-components__section">
            <h2>{group.title}</h2>
            <div className="ds-components__grid">
              {group.items.map((item) => (
                <article key={item.name} className="ds-components__card">
                  <h3>{item.name}</h3>
                  <p className="ds-components__meta">{item.file}</p>
                  <p>{item.usage}</p>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className="ds-components__section">
          <h2>Component Inventory</h2>
          <div className="ds-components__inventory">
            {COMPONENT_GROUPS.map((group) => (
              <article key={`inventory-${group.title}`} className="ds-components__inventory-group">
                <h3>{group.title}</h3>
                {group.items.map((item) => (
                  <div key={`inventory-item-${item.name}`} className="ds-components__inventory-item">
                    <p className="ds-components__inventory-name">{item.name}</p>
                    <p className="ds-components__inventory-file">{item.file}</p>
                    <p className="ds-components__inventory-usage">{item.usage}</p>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>

        <section className="ds-components__section">
          <h2>Live Component Examples</h2>
          <p className="ds-components__intro">
            This section renders interactive examples of the shared components used throughout the app.
          </p>

          <div className="ds-components__examples-grid">
            <article className="ds-components__example-card">
              <h3>Button Variants</h3>
              <div className="ds-components__example-row">
                <Button variant="wide" width="hug">
                  Wide
                </Button>
                <Button variant="circle" ariaLabel="Example circle">
                  12
                </Button>
                <Button variant="square" shape="squared" ariaLabel="Example square">
                  S
                </Button>
                <Button variant="chip">Chip</Button>
              </div>
            </article>

            <article className="ds-components__example-card">
              <h3>Navigation Components</h3>
              <div className="ds-components__example-row">
                <NavigationButton to="/design-system/components" variant="wide" width="hug" isActive>
                  NavigationButton
                </NavigationButton>
                <NavLink to="/design-system/components" className="ds-components__navlink-demo">
                  NavLink
                </NavLink>
              </div>
            </article>

            <article className="ds-components__example-card">
              <h3>ButtonBar</h3>
              <ButtonBar
                buttons={[
                  { label: 'Overview', value: 'overview' },
                  { label: 'Details', value: 'details' },
                  { label: 'History', value: 'history' },
                ]}
                selectedIndex={selectedButtonBar}
                onChange={(index) => setSelectedButtonBar(index)}
              />
              <p className="ds-components__example-meta">
                Selected: {selectedButtonBar === null ? 'none' : selectedButtonBar}
              </p>
            </article>

            <article className="ds-components__example-card">
              <h3>VisitButton</h3>
              <VisitButton visited={isVisited} onToggle={() => setIsVisited((prev) => !prev)} />
            </article>
          </div>
        </section>

        <section className="ds-components__section">
          <h2>Modal Component Examples</h2>
          <p className="ds-components__intro">
            Open each modal below to preview the exact component behavior used in station workflows.
          </p>
          <div className="ds-components__example-row">
            <Button variant="wide" width="hug" onClick={() => setShowStationModal(true)}>
              Open StationModal
            </Button>
            <Button variant="wide" width="hug" onClick={() => setShowStationEditModal(true)}>
              Open StationEditModal
            </Button>
            <Button variant="wide" width="hug" onClick={() => setShowNewStationModal(true)}>
              Open NewStationModal
            </Button>
          </div>
        </section>

        <section className="ds-components__section">
          <h2>Live Entry Points</h2>
          <div className="ds-components__links">
            <Link to="/migration">Open Migration</Link>
            <Link to="/stations">Open Stations</Link>
            <Link to="/stations">Open Stations</Link>
          </div>
        </section>

        <StationModal
          station={EXAMPLE_STATION}
          isOpen={showStationModal}
          onClose={() => setShowStationModal(false)}
        />
        <StationEditModal
          station={EXAMPLE_STATION}
          isOpen={showStationEditModal}
          onClose={() => setShowStationEditModal(false)}
        />
        <NewStationModal
          isOpen={showNewStationModal}
          onClose={() => setShowNewStationModal(false)}
          nextStationId="DS002"
        />
      </div>
    </div>
  )
}

export default ComponentsPage

