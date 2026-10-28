import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { routes } from '@/app/router'
import { useSettingsStore } from '@/store/settingsStore'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('app shell', () => {
  beforeEach(() => {
    useSettingsStore.setState({ solveStyle: 'beginner' })
  })

  it('shows the 3 ways to enter a cube on the home page', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/solve your rubik/i)
    expect(screen.getByRole('link', { name: /scan my cube/i })).toHaveAttribute('href', '/scan')
    expect(screen.getByRole('link', { name: /upload photos or video/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /enter colors by hand/i })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown paths', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })

  it('switches between Beginner and Optimal on the solution page', async () => {
    renderAt('/solution')
    const beginner = screen.getByRole('radio', { name: /beginner/i })
    const optimal = screen.getByRole('radio', { name: /optimal/i })
    expect(beginner).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(optimal)
    expect(optimal).toHaveAttribute('aria-checked', 'true')
    expect(useSettingsStore.getState().solveStyle).toBe('optimal')
  })
})
