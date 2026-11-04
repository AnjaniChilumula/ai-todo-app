import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api } from './api/client.js'
import { AppRoutes } from './App.jsx'
import AuthProvider from './auth/AuthProvider.jsx'

const ME = {
  id: 1,
  name: 'Anjani Chilumula',
  email: 'anjani@example.com',
  role: 'user',
  has_password: true,
  google_linked: false,
}

function renderAt(path, { demo = false } = {}) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider demo={demo}>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  )
  return userEvent.setup()
}

function signedOut() {
  api.me.mockRejectedValue(new ApiError(401, 'Please sign in.'))
}

describe('signing in and out', () => {
  beforeEach(() => {
    vi.spyOn(api, 'me').mockResolvedValue(ME)
    vi.spyOn(api, 'authConfig').mockResolvedValue({ password: true, google: false })
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })
    vi.spyOn(api, 'listTodos').mockResolvedValue([])
    vi.spyOn(api, 'signIn').mockResolvedValue(ME)
    vi.spyOn(api, 'signUp').mockResolvedValue(ME)
    vi.spyOn(api, 'signOut').mockResolvedValue(null)
  })

  it('sends signed-out visitors to the sign-in page', async () => {
    signedOut()
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('signs in and shows the task list', async () => {
    signedOut()
    const user = renderAt('/')

    await user.type(await screen.findByLabelText('Email'), '  anjani@example.com ')
    await user.type(screen.getByLabelText('Password'), 'correct horse battery')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'My Tasks' })).toBeInTheDocument()
    expect(api.signIn).toHaveBeenCalledWith({
      email: 'anjani@example.com',
      password: 'correct horse battery',
    })
  })

  it('shows the server’s message when sign-in fails', async () => {
    signedOut()
    api.signIn.mockRejectedValue(new ApiError(401, 'Email or password is incorrect.'))
    const user = renderAt('/login')

    await user.type(await screen.findByLabelText('Email'), 'anjani@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('offers Google only when the backend has it set up', async () => {
    signedOut()
    api.authConfig.mockResolvedValue({ password: true, google: true })
    renderAt('/login')

    const google = await screen.findByRole('link', { name: /Continue with Google/ })
    expect(google).toHaveAttribute('href', '/api/auth/google/start')
  })

  it('hides Google when it is not set up', async () => {
    signedOut()
    renderAt('/login')

    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(screen.queryByRole('link', { name: /Google/ })).not.toBeInTheDocument()
  })

  it('explains why Google sign-in sent you back', async () => {
    signedOut()
    renderAt('/login?error=google_conflict')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'already linked to a different Google account',
    )
  })

  it('shows and hides the password', async () => {
    signedOut()
    const user = renderAt('/login')
    const password = await screen.findByLabelText('Password')

    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('creates an account', async () => {
    signedOut()
    const user = renderAt('/signup')

    await user.type(await screen.findByLabelText('Name'), 'Anjani Chilumula')
    await user.type(screen.getByLabelText('Email'), 'anjani@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse battery')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'My Tasks' })).toBeInTheDocument()
    expect(api.signUp).toHaveBeenCalledWith({
      name: 'Anjani Chilumula',
      email: 'anjani@example.com',
      password: 'correct horse battery',
    })
  })

  it('checks the password length before creating an account', async () => {
    signedOut()
    const user = renderAt('/signup')

    await user.type(await screen.findByLabelText('Name'), 'A')
    await user.type(screen.getByLabelText('Email'), 'a@example.com')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(api.signUp).not.toHaveBeenCalled()
  })

  it('sends signed-in people away from the sign-in page', async () => {
    renderAt('/login')

    expect(await screen.findByRole('heading', { name: 'My Tasks' })).toBeInTheDocument()
  })

  it('sends unknown addresses home', async () => {
    renderAt('/no-such-page')

    expect(await screen.findByRole('heading', { name: 'My Tasks' })).toBeInTheDocument()
  })
})

describe('the user menu', () => {
  beforeEach(() => {
    vi.spyOn(api, 'me').mockResolvedValue(ME)
    vi.spyOn(api, 'authConfig').mockResolvedValue({ password: true, google: false })
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })
    vi.spyOn(api, 'listTodos').mockResolvedValue([])
    vi.spyOn(api, 'signOut').mockResolvedValue(null)
  })

  it('shows initials and opens with your name and email', async () => {
    const user = renderAt('/')
    const button = await screen.findByRole('button', { name: /Account menu for Anjani Chilumula/ })

    expect(button).toHaveTextContent('AC')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('anjani@example.com')).toBeInTheDocument()
  })

  it('signs out and returns to the sign-in page', async () => {
    const user = renderAt('/')
    await user.click(await screen.findByRole('button', { name: /Account menu/ }))

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(api.signOut).toHaveBeenCalled()
  })

  it('closes on Escape and gives focus back to the button', async () => {
    const user = renderAt('/')
    const button = await screen.findByRole('button', { name: /Account menu/ })
    await user.click(button)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })
})

describe('when the session ends while you use the app', () => {
  it('goes back to the sign-in page on any 401', async () => {
    const json = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/auth/me') return json(200, ME)
      if (url === '/api/auth/config') return json(200, { password: true, google: false })
      if (url === '/api/health') return json(200, { status: 'ok', ai_enabled: false })
      return json(401, { detail: 'Please sign in.' }) // e.g. /api/todos after the session expired
    })

    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})

describe('the demo', () => {
  beforeEach(() => {
    vi.spyOn(api, 'me')
    vi.spyOn(api, 'listTodos').mockResolvedValue([])
  })

  it('needs no sign-in and never asks the backend who you are', async () => {
    const user = renderAt('/login', { demo: true })

    expect(await screen.findByRole('heading', { name: 'My Tasks' })).toBeInTheDocument()
    expect(api.me).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Account menu for Guest/ }))
    const panel = screen.getByText(/Demo: no accounts/).closest('div')
    expect(within(panel).queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })
})
