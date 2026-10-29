import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { renderApp } from '../../tests/render-app'

import { NAV_ITEMS } from './navigation'

const AREAS = [
  ['/', 'Dashboard'],
  ['/budgets', 'Budgets'],
  ['/expenses', 'Expenses'],
  ['/catalog', 'Catalog'],
  ['/shopping-lists', 'Shopping Lists'],
  ['/optimize', 'Optimize'],
] as const

const sidebar = () => screen.getByRole('navigation', { name: 'Main' })

describe('routing', () => {
  test.each(AREAS)('%s renders the %s page inside the layout', async (path, title) => {
    renderApp(path)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(sidebar()).toBeInTheDocument()
  })

  test('every sidebar item has a route', () => {
    expect(NAV_ITEMS.map((item) => [item.to, item.label])).toEqual(AREAS)
  })
})

describe('sidebar navigation', () => {
  test('clicking a link navigates without a reload and marks the link active', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    const documentBefore = document

    await user.click(within(sidebar()).getByRole('link', { name: 'Budgets' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Budgets' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/budgets')
    expect(document).toBe(documentBefore)
    expect(within(sidebar()).getByRole('link', { name: 'Budgets' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(sidebar()).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  test('a direct link marks its area active', async () => {
    renderApp('/shopping-lists')

    await screen.findByRole('heading', { level: 1, name: 'Shopping Lists' })
    expect(within(sidebar()).getByRole('link', { name: 'Shopping Lists' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('the menu button shows every area and closes after choosing one', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Open menu' }))
    const menu = await screen.findByRole('dialog')
    const links = within(within(menu).getByRole('navigation', { name: 'Menu' })).getAllByRole(
      'link',
    )
    expect(links.map((link) => link.textContent)).toEqual(NAV_ITEMS.map((item) => item.label))

    await user.click(within(menu).getByRole('link', { name: 'Catalog' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Catalog' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
