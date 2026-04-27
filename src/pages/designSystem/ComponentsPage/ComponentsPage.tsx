import React, { useState } from 'react'
import type { Station } from '../../../types'
import { BUTBaseButton as Button } from '../../../components/buttons'
import { BUTBaseButtonBar as ButtonBar } from '../../../components/buttons'
import { NavLink } from '../../../components/buttons'
import VisitButton from '../../../components/buttons/other/BUTVisitStatusButton'
import BUTLink from '../../../components/buttons/other/BUTLink'
import StationModal from '../../../components/models/StationModal/StationModal'
import StationEditModal from '../../../components/models/StationEditModal/StationEditModal'
import NewStationModal from '../../../components/models/NewStationModal/NewStationModal'
import { PageTopHeader } from '../../../components/misc'
import './ComponentsPage.css'

const COMPONENT_GROUPS = [
  {
    title: 'Application Shell',
    items: [
      { name: 'Header', file: 'src/components/misc/Header.tsx', usage: 'Logo + theme toggle only; legal and auth are in the footer' },
      { name: 'Footer', file: 'src/components/misc/Footer.tsx', usage: 'Migration & Stations when signed in; legal links; Log in / Log out' },
    ],
  },
  {
    title: 'Navigation and Actions',
    items: [
      { name: 'BUTWideButton', file: 'src/components/buttons/wide/BUTWideButton.tsx', usage: 'Wide button + route-based nav via `to`' },
      { name: 'BUTBaseButton', file: 'src/components/buttons/BUTBaseButton.tsx', usage: 'Shared base button primitives and variants' },
      { name: 'BUTBaseButtonBar', file: 'src/components/buttons/BUTBaseButtonBar.tsx', usage: 'Shared grouped action bar button primitive' },
      { name: 'BUTVisitStatusButton', file: 'src/components/buttons/other/BUTVisitStatusButton/BUTVisitStatusButton.tsx', usage: 'Visited/not-visited status control' },
    ],
  },
  {
    title: 'Content and Data UI',
    items: [
      { name: 'StationModal', file: 'src/components/models/StationModal/StationModal.tsx', usage: 'Station details and metadata' },
      { name: 'StationEditModal', file: 'src/components/models/StationEditModal/StationEditModal.tsx', usage: 'Station editing workflow' },
      { name: 'NewStationModal', file: 'src/components/models/NewStationModal/NewStationModal.tsx', usage: 'Create station workflow' },
      { name: 'Stations', file: 'src/pages/Stations.tsx', usage: 'Primary data table and filters' },
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
    <div className="ds-components-page">
      <PageTopHeader
        title="Components"
        subtitle="Catalogue of high-level components and where they are used in the product."
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
        <div className="ds-components">

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
                <BUTWideButton to="/design-system/components" width="hug" isActive>
                  BUTWideButton
                </BUTWideButton>
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
            <BUTLink to="/migration">Open Migration</BUTLink>
            <BUTLink to="/stations">Open Stations</BUTLink>
            <BUTLink to="/stations">Open Stations</BUTLink>
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
    </div>
  )
}

export default ComponentsPage

