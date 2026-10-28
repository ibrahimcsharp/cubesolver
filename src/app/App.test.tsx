import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { routes } from '@/app/router'
import {
  applyMoves,
  parseMoves,
  solvedCube,
  STANDARD_CENTERS,
  toFacelets,
  type Face,
} from '@/modules/cube'
import { emptyStickers, useCubeStore } from '@/store/cubeStore'
import { useSettingsStore } from '@/store/settingsStore'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

function loadCube(scramble: string) {
  const colors = [...toFacelets(applyMoves(solvedCube(), parseMoves(scramble)))].map(
    (ch) => STANDARD_CENTERS[ch as Face],
  )
  useCubeStore.getState().setAll(colors)
}

describe('app', () => {
  beforeEach(() => {
    useSettingsStore.setState({ solveStyle: 'beginner' })
    useCubeStore.setState({ stickers: emptyStickers(), cube: null })
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

  it('asks for a cube when the solution page has none', () => {
    renderAt('/solution')
    expect(screen.getByRole('heading', { name: /no cube yet/i })).toBeInTheDocument()
  })

  it('shows the solution and switches between Beginner and Optimal', async () => {
    loadCube("R U F'")
    renderAt('/solution')
    const beginner = screen.getByRole('radio', { name: /beginner/i })
    const optimal = screen.getByRole('radio', { name: /optimal/i })
    expect(beginner).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/stage 1/i, { selector: 'h2' })).toBeInTheDocument()

    await userEvent.click(optimal)
    expect(optimal).toHaveAttribute('aria-checked', 'true')
    expect(useSettingsStore.getState().solveStyle).toBe('optimal')
    // R U F' is undone by F U' R' — 3 moves.
    expect(screen.getByText(/^3 moves/)).toBeInTheDocument()
  })

  it('steps through the optimal solution to a solved cube', async () => {
    useSettingsStore.setState({ solveStyle: 'optimal' })
    loadCube("R U F'")
    renderAt('/solution')
    const next = screen.getByRole('button', { name: /next/i })
    for (let i = 0; i < 3; i++) await userEvent.click(next)
    expect(screen.getByText(/your cube is solved/i)).toBeInTheDocument()
    expect(next).toBeDisabled()
  })

  it('reports problems on the enter-by-hand page', async () => {
    loadCube('R')
    // Paint one sticker the wrong color: 10 of one color, 8 of another.
    const stickers = [...useCubeStore.getState().stickers]
    stickers[0] = stickers[0] === 'red' ? 'blue' : 'red'
    useCubeStore.getState().setAll(stickers)
    renderAt('/manual')
    await userEvent.click(screen.getByRole('button', { name: /check & solve/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/each color should appear 9 times/i)
  })
})
