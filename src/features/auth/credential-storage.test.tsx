import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'

import { fakeBackend } from '../../../tests/msw/handlers'
import { TEST_USER, renderApp, seedSession } from '../../../tests/render-app'

/** Everything a script on the page could read back from browser storage. */
async function readableStorage(): Promise<string> {
  const parts: string[] = [document.cookie]
  for (const storage of [localStorage, sessionStorage]) {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)!
      parts.push(key, storage.getItem(key) ?? '')
    }
  }
  if (typeof indexedDB !== 'undefined') {
    parts.push(JSON.stringify(await indexedDB.databases()))
  }
  return parts.join('\n')
}

/** Every token the backend issued, plus the password. */
function secrets(password: string): string[] {
  return [
    ...Object.keys(fakeBackend.state.accessTokens),
    ...Object.keys(fakeBackend.state.refreshTokens),
    password,
  ]
}

describe('credentials stay out of browser storage', () => {
  test('after signing in', async () => {
    seedSession({ signedIn: false })
    const user = userEvent.setup()
    renderApp('/login', { session: null })

    await user.type(await screen.findByLabelText('Email'), TEST_USER.email)
    await user.type(screen.getByLabelText('Password'), TEST_USER.password)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })

    const stored = await readableStorage()
    const issued = secrets(TEST_USER.password)
    expect(issued.length).toBeGreaterThan(2)
    for (const secret of issued) expect(stored).not.toContain(secret)
  })

  test('after registering', async () => {
    const user = userEvent.setup()
    renderApp('/register', { session: null })

    await user.type(await screen.findByLabelText('Name'), 'Rina')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret-password-1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByRole('heading', { level: 1 })
    await expect.poll(() => Object.keys(fakeBackend.state.accessTokens).length).toBe(1)

    const stored = await readableStorage()
    for (const secret of secrets('secret-password-1')) expect(stored).not.toContain(secret)
  })
})
