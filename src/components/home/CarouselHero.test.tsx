import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CarouselHero from './CarouselHero'

describe('CarouselHero', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  it('renders the first slide title as a heading', () => {
    render(
      <CarouselHero
        slides={[{ title: 'Alpha', body: 'Body one' }]}
        pauseOnHover={false}
        pauseOnFocusWithin={false}
      />
    )
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument()
  })

  it('advances to the next slide when the slide 2 dot is activated', async () => {
    render(
      <CarouselHero
        slides={[
          { title: 'Alpha', body: 'A' },
          { title: 'Beta', body: 'B' }
        ]}
        pauseOnHover={false}
        pauseOnFocusWithin={false}
      />
    )
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Slide 2 of 2' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Beta' })).toBeInTheDocument()
    })
  })

  it('advances to the next slide on autoplay interval', () => {
    vi.useFakeTimers()
    render(
      <CarouselHero
        slides={[
          { title: 'Alpha', body: 'A' },
          { title: 'Beta', body: 'B' }
        ]}
        pauseOnHover={false}
        pauseOnFocusWithin={false}
        autoPlayMs={5000}
      />
    )
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByRole('heading', { name: 'Beta' })).toBeInTheDocument()
  })

  it('toggles autoplay pause on the active indicator control', () => {
    render(
      <CarouselHero
        slides={[
          { title: 'Alpha', body: 'A' },
          { title: 'Beta', body: 'B' }
        ]}
        pauseOnHover={false}
        pauseOnFocusWithin={false}
      />
    )
    const pauseBtn = screen.getByRole('button', { name: 'Pause autoplay' })
    expect(pauseBtn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(pauseBtn)
    expect(screen.getByRole('button', { name: 'Resume autoplay' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Resume autoplay' }))
    expect(screen.getByRole('button', { name: 'Pause autoplay' })).toHaveAttribute('aria-pressed', 'true')
  })
})
