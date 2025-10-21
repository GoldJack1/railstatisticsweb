import React, { useState } from 'react'
import Button from './Button'
import ButtonBar from './ButtonBar'
import './ButtonDemo.css'

const ButtonDemo: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0)
  const [clickedButtons, setClickedButtons] = useState<Record<string, boolean>>({})

  const handleButtonClick = (id: string) => {
    // Set to pressed state
    setClickedButtons(prev => ({ ...prev, [id]: true }))
    // Reset after a short delay to show the interaction
    setTimeout(() => {
      setClickedButtons(prev => ({ ...prev, [id]: false }))
    }, 300)
  }

  // Icon components
  const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="3" x2="8" y2="13"/>
      <line x1="3" y1="8" x2="13" y2="8"/>
    </svg>
  )

  const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7" cy="7" r="4"/>
      <line x1="11" y1="11" x2="13" y2="13"/>
    </svg>
  )

  const StarIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 11l-4 2.5 1.5-4.5L2 6.5h4.5z"/>
    </svg>
  )

  const SettingsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/>
    </svg>
  )

  return (
    <div className="container">
      <div className="button-demo">
        <div className="button-demo__header">
          <h1 className="button-demo__title">Button Component Library</h1>
          <p className="button-demo__subtitle">
            Comprehensive button design system with multiple variants, shapes, and states
          </p>
        </div>

        {/* Wide Buttons */}
        <section className="button-demo__section">
          <h2 className="button-demo__section-title">Wide Buttons</h2>
          <p className="button-demo__section-description">
            Full-width buttons in various states and shapes
          </p>
          
          <div className="button-demo__group">
            <h3>Standard Wide Button</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="wide" 
                  pressed={clickedButtons['wide-active']}
                  onClick={() => handleButtonClick('wide-active')}
                >
                  Active State
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button variant="wide" pressed>Pressed State</Button>
                <span className="button-demo__label">Always Pressed</span>
              </div>
              <div className="button-demo__item">
                <Button variant="wide" disabled>Disabled State</Button>
                <span className="button-demo__label">Disabled</span>
              </div>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Rounded Variants</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="wide" 
                  shape="left-rounded"
                  pressed={clickedButtons['left-rounded']}
                  onClick={() => handleButtonClick('left-rounded')}
                >
                  Left Rounded
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="wide" 
                  shape="right-rounded"
                  pressed={clickedButtons['right-rounded']}
                  onClick={() => handleButtonClick('right-rounded')}
                >
                  Right Rounded
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="wide" 
                  shape="squared"
                  pressed={clickedButtons['squared']}
                  onClick={() => handleButtonClick('squared')}
                >
                  Squared Button
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Top/Bottom Rounded</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="wide" 
                  shape="top-rounded"
                  pressed={clickedButtons['top-rounded']}
                  onClick={() => handleButtonClick('top-rounded')}
                >
                  Top Rounded
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="wide" 
                  shape="bottom-rounded"
                  pressed={clickedButtons['bottom-rounded']}
                  onClick={() => handleButtonClick('bottom-rounded')}
                >
                  Bottom Rounded
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Wide Button Examples */}
        <section className="button-demo__section button-demo__interactive">
          <h2 className="button-demo__section-title">Interactive Wide Button Examples</h2>
          <p className="button-demo__section-description">
            Practical examples showing how wide buttons can be used in real applications
          </p>
          
          <div className="button-demo__group">
            <h3>Action Buttons</h3>
            <div className="button-demo__row button-demo__row--vertical">
              <Button 
                variant="wide"
                pressed={clickedButtons['action-submit']}
                onClick={() => handleButtonClick('action-submit')}
              >
                Submit Form
              </Button>
              <Button 
                variant="wide"
                pressed={clickedButtons['action-save']}
                onClick={() => handleButtonClick('action-save')}
              >
                Save Changes
              </Button>
              <Button 
                variant="wide"
                pressed={clickedButtons['action-cancel']}
                onClick={() => handleButtonClick('action-cancel')}
              >
                Cancel
              </Button>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Navigation Buttons</h3>
            <div className="button-demo__row button-demo__row--grid">
              <Button 
                variant="wide"
                shape="left-rounded"
                pressed={clickedButtons['nav-back']}
                onClick={() => handleButtonClick('nav-back')}
              >
                ← Back
              </Button>
              <Button 
                variant="wide"
                shape="right-rounded"
                pressed={clickedButtons['nav-next']}
                onClick={() => handleButtonClick('nav-next')}
              >
                Next →
              </Button>
              <Button 
                variant="wide"
                pressed={clickedButtons['nav-home']}
                onClick={() => handleButtonClick('nav-home')}
              >
                🏠 Home
              </Button>
              <Button 
                variant="wide"
                pressed={clickedButtons['nav-search']}
                onClick={() => handleButtonClick('nav-search')}
              >
                🔍 Search
              </Button>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Stacked Button Group</h3>
            <div className="button-demo__row button-demo__row--stack">
              <Button 
                variant="wide"
                shape="top-rounded"
                pressed={clickedButtons['stack-option1']}
                onClick={() => handleButtonClick('stack-option1')}
              >
                Option 1: Default Choice
              </Button>
              <Button 
                variant="wide"
                shape="squared"
                pressed={clickedButtons['stack-option2']}
                onClick={() => handleButtonClick('stack-option2')}
              >
                Option 2: Alternative
              </Button>
              <Button 
                variant="wide"
                shape="bottom-rounded"
                pressed={clickedButtons['stack-option3']}
                onClick={() => handleButtonClick('stack-option3')}
              >
                Option 3: Advanced
              </Button>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Mixed States</h3>
            <div className="button-demo__row button-demo__row--vertical">
              <Button 
                variant="wide"
                pressed={clickedButtons['mixed-active']}
                onClick={() => handleButtonClick('mixed-active')}
              >
                ✓ Active Button (Click me!)
              </Button>
              <Button 
                variant="wide"
                pressed
              >
                ⏸ Processing... (Always Pressed)
              </Button>
              <Button 
                variant="wide"
                disabled
              >
                🔒 Disabled (No Action)
              </Button>
            </div>
          </div>
        </section>

        {/* Circle Buttons */}
        <section className="button-demo__section">
          <h2 className="button-demo__section-title">Circle Buttons</h2>
          <p className="button-demo__section-description">
            Circular icon buttons for compact interfaces
          </p>
          
          <div className="button-demo__group">
            <h3>Icon Buttons</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="circle" 
                  icon={<PlusIcon />} 
                  ariaLabel="Add"
                  pressed={clickedButtons['circle-plus']}
                  onClick={() => handleButtonClick('circle-plus')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="circle" 
                  icon={<SearchIcon />} 
                  ariaLabel="Search"
                  pressed={clickedButtons['circle-search']}
                  onClick={() => handleButtonClick('circle-search')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="circle" 
                  icon={<StarIcon />} 
                  ariaLabel="Star"
                  pressed={clickedButtons['circle-star']}
                  onClick={() => handleButtonClick('circle-star')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="circle" 
                  icon={<SettingsIcon />} 
                  ariaLabel="Settings"
                  pressed={clickedButtons['circle-settings']}
                  onClick={() => handleButtonClick('circle-settings')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Circle Button States</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="circle" 
                  icon={<PlusIcon />} 
                  ariaLabel="Active"
                  pressed={clickedButtons['circle-state-active']}
                  onClick={() => handleButtonClick('circle-state-active')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button variant="circle" icon={<PlusIcon />} pressed ariaLabel="Pressed" />
                <span className="button-demo__label">Always Pressed</span>
              </div>
              <div className="button-demo__item">
                <Button variant="circle" icon={<PlusIcon />} disabled ariaLabel="Disabled" />
                <span className="button-demo__label">Disabled</span>
              </div>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Number/Text Circle Buttons</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="circle"
                  pressed={clickedButtons['circle-num']}
                  onClick={() => handleButtonClick('circle-num')}
                >
                  12
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button variant="circle" pressed>12</Button>
                <span className="button-demo__label">Always Pressed</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="circle"
                  pressed={clickedButtons['circle-letter']}
                  onClick={() => handleButtonClick('circle-letter')}
                >
                  A
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
            </div>
          </div>
        </section>

        {/* Square Buttons */}
        <section className="button-demo__section">
          <h2 className="button-demo__section-title">Square Buttons</h2>
          <p className="button-demo__section-description">
            Square icon buttons with sharp corners
          </p>
          
          <div className="button-demo__group">
            <h3>Square Icon Buttons</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="square" 
                  shape="squared" 
                  icon={<PlusIcon />} 
                  ariaLabel="Add"
                  pressed={clickedButtons['square-plus']}
                  onClick={() => handleButtonClick('square-plus')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="square" 
                  shape="squared" 
                  icon={<SearchIcon />} 
                  ariaLabel="Search"
                  pressed={clickedButtons['square-search']}
                  onClick={() => handleButtonClick('square-search')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="square" 
                  shape="squared" 
                  icon={<StarIcon />} 
                  ariaLabel="Star"
                  pressed={clickedButtons['square-star']}
                  onClick={() => handleButtonClick('square-star')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button 
                  variant="square" 
                  shape="squared" 
                  icon={<SettingsIcon />} 
                  ariaLabel="Settings"
                  pressed={clickedButtons['square-settings']}
                  onClick={() => handleButtonClick('square-settings')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Square Button States</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="square" 
                  shape="squared" 
                  icon={<StarIcon />} 
                  ariaLabel="Active"
                  pressed={clickedButtons['square-state-active']}
                  onClick={() => handleButtonClick('square-state-active')}
                />
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button variant="square" shape="squared" icon={<StarIcon />} pressed ariaLabel="Pressed" />
                <span className="button-demo__label">Always Pressed</span>
              </div>
              <div className="button-demo__item">
                <Button variant="square" shape="squared" icon={<StarIcon />} disabled ariaLabel="Disabled" />
                <span className="button-demo__label">Disabled</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Buttons */}
        <section className="button-demo__section">
          <h2 className="button-demo__section-title">Tab Buttons</h2>
          <p className="button-demo__section-description">
            Navigation tab-style buttons
          </p>
          
          <div className="button-demo__group">
            <h3>Individual Tab Buttons</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="tab"
                  pressed={clickedButtons['tab-1']}
                  onClick={() => handleButtonClick('tab-1')}
                >
                  Tab 1
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button variant="tab" pressed>Tab 2</Button>
                <span className="button-demo__label">Always Pressed</span>
              </div>
              <div className="button-demo__item">
                <Button variant="tab" disabled>Tab 3</Button>
                <span className="button-demo__label">Disabled</span>
              </div>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Tab Group (Simulated)</h3>
            <div className="button-demo__row">
              <div className="button-demo__tabs">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="button-demo__tab-item">
                    <Button
                      variant="tab"
                      pressed={selectedTab === index}
                      onClick={() => setSelectedTab(index)}
                    >
                      Tab {index + 1}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Button Bars */}
        <section className="button-demo__section">
          <h2 className="button-demo__section-title">Button Bars</h2>
          <p className="button-demo__section-description">
            Grouped button controls with selection state
          </p>
          
          <div className="button-demo__group">
            <h3>2-Button Bar</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <ButtonBar
                  buttons={[
                    { label: 'Left Text', value: 'left' },
                    { label: 'Right Text', value: 'right' }
                  ]}
                  onChange={(index, value) => 
                    console.log(`Selected: ${index !== null ? `Button ${index} (${value})` : 'None'}`)
                  }
                />
              </div>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>3-Button Bar</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <ButtonBar
                  buttons={[
                    { label: 'Left Text', value: 'left' },
                    { label: 'Middle Text', value: 'middle' },
                    { label: 'Right Text', value: 'right' }
                  ]}
                  onChange={(index, value) => 
                    console.log(`Selected: ${index !== null ? `Button ${index} (${value})` : 'None'}`)
                  }
                />
              </div>
            </div>
          </div>

          <div className="button-demo__group">
            <h3>Button Bar with Disabled Option</h3>
            <div className="button-demo__row">
              <div className="button-demo__item">
                <ButtonBar
                  buttons={[
                    { label: 'Active', value: 'active' },
                    { label: 'Disabled', value: 'disabled', disabled: true },
                    { label: 'Active', value: 'active2' }
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Operator Chips */}
        <section className="button-demo__section">
          <h2 className="button-demo__section-title">Operator Chips</h2>
          <p className="button-demo__section-description">
            Small chip-style buttons for operators and tags
          </p>
          
          <div className="button-demo__group">
            <div className="button-demo__row">
              <div className="button-demo__item">
                <Button 
                  variant="chip"
                  pressed={clickedButtons['chip-1']}
                  onClick={() => handleButtonClick('chip-1')}
                >
                  Southern Railway
                </Button>
                <span className="button-demo__label">Click to test</span>
              </div>
              <div className="button-demo__item">
                <Button variant="chip" pressed>Great Western</Button>
                <span className="button-demo__label">Always Pressed</span>
              </div>
              <div className="button-demo__item">
                <Button variant="chip" disabled>Northern Rail</Button>
                <span className="button-demo__label">Disabled</span>
              </div>
            </div>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="button-demo__section button-demo__guidelines">
          <h2 className="button-demo__section-title">Usage Guidelines</h2>
          <div className="button-demo__guidelines-content">
            <div className="button-demo__guideline">
              <h3>Accessibility</h3>
              <p>All buttons meet the minimum 44px touch target size and include proper ARIA labels for icon-only buttons.</p>
            </div>
            <div className="button-demo__guideline">
              <h3>Theme Support</h3>
              <p>Buttons automatically adapt to light and dark themes with appropriate color contrasts.</p>
            </div>
            <div className="button-demo__guideline">
              <h3>States</h3>
              <p>Three primary states: Active (default), Pressed (during interaction), and Disabled (non-interactive).</p>
            </div>
            <div className="button-demo__guideline">
              <h3>Responsive</h3>
              <p>Buttons scale appropriately on mobile devices while maintaining touch-friendly sizing.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default ButtonDemo

