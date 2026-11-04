import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api } from './api/client.js'
import { AppRoutes } from './App.jsx'
import AuthProvider from './auth/AuthProvider.jsx'

const ADMIN = {
  id: 1,
  name: 'Anjani Chilumula',
  email: 'anjani@example.com',
  role: 'admin',
  has_password: true,
  google_linked: false,
}

const hoursAgo = (n) => new Date(Date.now() - n * 3_600_000).toISOString()

const USERS = [
  {
    id: 1,
    email: 'anjani@example.com',
    name: 'Anjani Chilumula',
    role: 'admin',
    is_active: true,
    task_count: 12,
    created_at: hoursAgo(500),
    last_active_at: hoursAgo(0),
  },
  {
    id: 2,
    email: 'priya@example.com',
    name: 'Priya Shah',
    role: 'user',
    is_active: true,
    task_count: 4,
    created_at: hoursAgo(300),
    last_active_at: hoursAgo(2),
  },
  {
    id: 3,
    email: 'sam@example.com',
    name: 'Sam Lee',
    role: 'user',
    is_active: false,
    task_count: 0,
    created_at: hoursAgo(100),
    last_active_at: null,
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

async function rowFor(name) {
  return (await screen.findByRole('rowheader', { name })).closest('tr')
}

beforeEach(() => {
  vi.spyOn(api, 'me').mockResolvedValue(ADMIN)
  vi.spyOn(api, 'authConfig').mockResolvedValue({ password: true, google: false })
  vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })
  vi.spyOn(api, 'listTodos').mockResolvedValue([])
  vi.spyOn(api, 'adminUsers').mockResolvedValue(USERS)
  vi.spyOn(api, 'adminUpdateUser')
})

describe('who can reach the admin page', () => {
  it('admins open it from the account menu', async () => {
    const user = renderAt('/')
    await user.click(await screen.findByRole('button', { name: /Account menu/ }))

    await user.click(screen.getByRole('link', { name: 'Admin' }))

    expect(await screen.findByRole('heading', { name: 'Users', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText(/3 accounts/)).toBeInTheDocument()
  })

  it('other people don’t see the link, and /admin sends them to their tasks', async () => {
    api.me.mockResolvedValue({ ...ADMIN, role: 'user' })
    const user = renderAt('/admin')

    expect(await screen.findByRole('heading', { name: 'My Tasks' })).toBeInTheDocument()
    expect(api.adminUsers).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Account menu/ }))
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })
})

describe('the users table', () => {
  it('shows each account’s role, status, task count and last activity', async () => {
    renderAt('/admin')

    const priya = await rowFor('Priya Shah')
    expect(priya).toHaveTextContent('priya@example.com')
    expect(priya).toHaveTextContent('User')
    expect(priya).toHaveTextContent('Active')
    expect(within(priya).getByRole('cell', { name: '4' })).toBeInTheDocument()
    expect(priya).toHaveTextContent('2 hours ago')

    const sam = await rowFor('Sam Lee')
    expect(sam).toHaveTextContent('Disabled')
    expect(sam).toHaveTextContent('Never')
  })

  it('doesn’t let you change your own account', async () => {
    renderAt('/admin')

    const me = await rowFor('Anjani Chilumula')
    expect(me).toHaveTextContent('This is you')
    expect(within(me).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the server’s message when the list can’t load', async () => {
    api.adminUsers.mockRejectedValue(new ApiError(403, 'Only admins can do that.'))
    renderAt('/admin')

    expect(await screen.findByRole('alert')).toHaveTextContent('Only admins can do that.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('changing an account', () => {
  it('makes someone an admin, then removes it again', async () => {
    api.adminUpdateUser
      .mockResolvedValueOnce({ ...USERS[1], role: 'admin' })
      .mockResolvedValueOnce({ ...USERS[1], role: 'user' })
    const user = renderAt('/admin')
    const priya = await rowFor('Priya Shah')

    await user.click(within(priya).getByRole('button', { name: 'Make admin Priya Shah' }))
    const remove = await within(priya).findByRole('button', { name: 'Remove admin Priya Shah' })
    expect(priya).toHaveTextContent('Admin')
    expect(api.adminUpdateUser).toHaveBeenCalledWith(2, { role: 'admin' })

    await user.click(remove)
    expect(await within(priya).findByRole('button', { name: 'Make admin Priya Shah' })).toBeEnabled()
    expect(api.adminUpdateUser).toHaveBeenLastCalledWith(2, { role: 'user' })
  })

  it('disables an active account and enables a disabled one', async () => {
    api.adminUpdateUser.mockImplementation(async (id, changes) => ({
      ...USERS.find((u) => u.id === id),
      ...changes,
    }))
    const user = renderAt('/admin')
    const priya = await rowFor('Priya Shah')
    const sam = await rowFor('Sam Lee')

    await user.click(within(priya).getByRole('button', { name: 'Disable Priya Shah' }))
    expect(await within(priya).findByText('Disabled')).toBeInTheDocument()
    expect(api.adminUpdateUser).toHaveBeenCalledWith(2, { is_active: false })

    await user.click(within(sam).getByRole('button', { name: 'Enable Sam Lee' }))
    expect(await within(sam).findByText('Active')).toBeInTheDocument()
    expect(api.adminUpdateUser).toHaveBeenCalledWith(3, { is_active: true })
  })

  it('shows the server’s message and keeps the row as it was when a change fails', async () => {
    api.adminUpdateUser.mockRejectedValue(new ApiError(404, 'No account with that id.'))
    const user = renderAt('/admin')
    const priya = await rowFor('Priya Shah')

    await user.click(within(priya).getByRole('button', { name: 'Disable Priya Shah' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No account with that id.')
    expect(priya).toHaveTextContent('Active')
    expect(within(priya).getByRole('button', { name: 'Disable Priya Shah' })).toBeEnabled()
  })
})
