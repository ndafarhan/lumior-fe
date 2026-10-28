import { act, screen } from '@testing-library/react'
import type { Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

import { renderApp } from './bootstrap'

let root: Root | undefined

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

function mount(env: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.append(container)
  act(() => {
    root = renderApp(container, env)
  })
}

test('shows the configuration error screen and makes no requests when the base URL is invalid', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  mount({ VITE_API_BASE_URL: 'not-a-url' })

  expect(
    screen.getByRole('heading', { name: 'Lumior is not configured correctly' }),
  ).toBeInTheDocument()
  expect(screen.getByText('VITE_API_BASE_URL')).toBeInTheDocument()
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('renders the app when the configuration is valid', () => {
  mount({ VITE_API_BASE_URL: 'http://localhost:8000' })

  expect(screen.queryByText('Lumior is not configured correctly')).not.toBeInTheDocument()
})
