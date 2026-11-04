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

const hoursAgo = (n) => new Date(Date.now() - n * 3_600_000).toISOString()

const SESSIONS = [
  {
    id: 'here',
    device: 'Chrome on Windows',
    created_at: hoursAgo(20),
    last_seen_at: hoursAgo(0),
    current: true,
  },
  {
    id: 'phone',
    device: 'Safari on iPhone',
    created_at: hoursAgo(50),
    last_seen_at: hoursAgo(3),
    current: false,
  },
  {
    id: 'laptop',
    device: 'Firefox on Linux',
    created_at: hoursAgo(200),
    last_seen_at: hoursAgo(72),
    current: false,
  },
]

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider demo={false}>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  )
  return userEvent.setup()
}

function devices() {
  return within(screen.getByRole('list', { name: 'Signed-in devices' })).getAllByRole('listitem')
}

beforeEach(() => {
  vi.spyOn(api, 'me').mockResolvedValue(ME)
  vi.spyOn(api, 'authConfig').mockResolvedValue({ password: true, google: false })
  vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })
  vi.spyOn(api, 'listTodos').mockResolvedValue([])
  vi.spyOn(api, 'listSessions').mockResolvedValue(SESSIONS)
})

describe('the settings page', () => {
  it('opens from the account menu', async () => {
    const user = renderAt('/')
    await user.click(await screen.findByRole('button', { name: /Account menu/ }))

    await user.click(screen.getByRole('link', { name: 'Settings' }))

    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
  })

  it('needs a signed-in account', async () => {
    api.me.mockRejectedValue(new ApiError(401, 'Please sign in.'))
    renderAt('/settings')

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})

describe('the profile', () => {
  it('saves a new name and shows it in the account menu', async () => {
    vi.spyOn(api, 'updateAccount').mockResolvedValue({ ...ME, name: 'Anjani C' })
    const user = renderAt('/settings')
    const name = await screen.findByLabelText('Name')
    const save = screen.getByRole('button', { name: 'Save' })

    expect(save).toBeDisabled() // nothing changed yet
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    await user.clear(name)
    await user.type(name, '  Anjani C ')
    await user.click(save)

    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(api.updateAccount).toHaveBeenCalledWith({ name: 'Anjani C' })
    expect(screen.getByRole('button', { name: /Account menu for Anjani C$/ })).toBeInTheDocument()
  })

  it('shows the server’s message when saving fails', async () => {
    vi.spyOn(api, 'updateAccount').mockRejectedValue(new ApiError(422, 'Name is too long.'))
    const user = renderAt('/settings')

    await user.type(await screen.findByLabelText('Name'), '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name is too long.')
  })
})

describe('the password', () => {
  it('changes the password and reloads the device list', async () => {
    vi.spyOn(api, 'changePassword').mockResolvedValue(null)
    const user = renderAt('/settings')

    await user.type(await screen.findByLabelText('Current password'), 'old password 1')
    await user.type(screen.getByLabelText('New password'), 'new password 22')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText(/Password changed/)).toBeInTheDocument()
    expect(api.changePassword).toHaveBeenCalledWith({
      current_password: 'old password 1',
      new_password: 'new password 22',
    })
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    await screen.findByRole('list', { name: 'Signed-in devices' })
    expect(api.listSessions).toHaveBeenCalledTimes(2)
  })

  it('checks the new password’s length before asking the server', async () => {
    vi.spyOn(api, 'changePassword')
    const user = renderAt('/settings')

    await user.type(await screen.findByLabelText('Current password'), 'old password 1')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(api.changePassword).not.toHaveBeenCalled()
  })

  it('shows the server’s message when the current password is wrong', async () => {
    vi.spyOn(api, 'changePassword').mockRejectedValue(
      new ApiError(400, 'Your current password is incorrect.'),
    )
    const user = renderAt('/settings')

    await user.type(await screen.findByLabelText('Current password'), 'not my password')
    await user.type(screen.getByLabelText('New password'), 'new password 22')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your current password is incorrect.')
  })

  it('lets a Google-only account set a first password', async () => {
    api.me.mockResolvedValue({ ...ME, has_password: false, google_linked: true })
    vi.spyOn(api, 'changePassword').mockResolvedValue(null)
    const user = renderAt('/settings')

    expect(await screen.findByRole('heading', { name: 'Set a password' })).toBeInTheDocument()
    expect(screen.getByText('Google linked')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('New password'), 'new password 22')
    await user.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText(/Password set/)).toBeInTheDocument()
    expect(api.changePassword).toHaveBeenCalledWith({ new_password: 'new password 22' })
    // The section switches to "change" now that the account has a password.
    expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument()
  })
})

describe('signed-in devices', () => {
  it('lists each device with when it was last used', async () => {
    renderAt('/settings')
    await screen.findByRole('list', { name: 'Signed-in devices' })

    const [here, phone, laptop] = devices()
    expect(here).toHaveTextContent('Chrome on Windows')
    expect(here).toHaveTextContent('This device')
    expect(within(here).queryByRole('button')).not.toBeInTheDocument()
    expect(phone).toHaveTextContent('Last active 3 hours ago')
    expect(laptop).toHaveTextContent('Last active 3 days ago')
  })

  it('signs out one other device', async () => {
    vi.spyOn(api, 'endSession').mockResolvedValue(null)
    const user = renderAt('/settings')

    await user.click(await screen.findByRole('button', { name: 'Sign out Safari on iPhone' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Signed out Safari on iPhone.')
    expect(api.endSession).toHaveBeenCalledWith('phone')
    expect(devices()).toHaveLength(2)
  })

  it('signs out everywhere else', async () => {
    vi.spyOn(api, 'endOtherSessions').mockResolvedValue({ ended: 2 })
    const user = renderAt('/settings')
    const button = await screen.findByRole('button', { name: 'Sign out everywhere else' })
    await screen.findByRole('list', { name: 'Signed-in devices' })

    await user.click(button)

    expect(await screen.findByRole('status')).toHaveTextContent('Signed out 2 other devices.')
    expect(devices()).toHaveLength(1)
    expect(button).toBeDisabled() // nothing left to sign out
  })

  it('shows the server’s message when signing out fails', async () => {
    vi.spyOn(api, 'endSession').mockRejectedValue(new ApiError(404, 'That session has ended.'))
    const user = renderAt('/settings')

    await user.click(await screen.findByRole('button', { name: 'Sign out Firefox on Linux' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That session has ended.')
    expect(devices()).toHaveLength(3)
  })
})
