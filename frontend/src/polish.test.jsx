import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from './api/client.js'
import App from './App.jsx'
import { createMemoryStore } from './test/memoryStore.js'

function renderApp(initialTodos) {
  render(<App store={createMemoryStore(initialTodos)} />)
  return userEvent.setup()
}

describe('phone actions sheet', () => {
  beforeEach(() => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: true })
    vi.spyOn(api, 'breakdown').mockResolvedValue({ subtasks: ['Book venue'] })
  })

  it('lists the task actions and runs the chosen one', async () => {
    const user = renderApp([{ title: 'Call the bank' }, { title: 'Read docs' }])

    await user.click(await screen.findByRole('button', { name: 'More actions for "Call the bank"' }))
    const sheet = screen.getByRole('dialog', { name: 'Actions for "Call the bank"' })
    expect(
      within(sheet)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Break it down', 'Edit', 'Delete', 'Cancel'])
    expect(within(sheet).getByRole('button', { name: 'Break it down' })).toHaveFocus()

    await user.click(within(sheet).getByRole('button', { name: 'Delete' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Call the bank' })).not.toBeInTheDocument()
  })

  it('closes with Escape and returns focus to the more button', async () => {
    const user = renderApp([{ title: 'Call the bank' }])
    const more = await screen.findByRole('button', { name: 'More actions for "Call the bank"' })

    await user.click(more)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(more).toHaveFocus()
  })

  it('can open Break it down from the sheet', async () => {
    const user = renderApp([{ title: 'Plan party' }])

    await user.click(await screen.findByRole('button', { name: 'More actions for "Plan party"' }))
    await user.click(screen.getByRole('button', { name: 'Break it down' }))

    expect(await screen.findByRole('dialog', { name: 'Break down “Plan party”' })).toBeInTheDocument()
  })
})

describe('keyboard focus', () => {
  beforeEach(() => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })
  })

  it('returns focus to the sparkle button when Break it down closes', async () => {
    api.health.mockResolvedValue({ status: 'ok', ai_enabled: true })
    vi.spyOn(api, 'breakdown').mockResolvedValue({ subtasks: [] })
    const user = renderApp([{ title: 'Plan party' }])
    const opener = await screen.findByRole('button', { name: 'Break down "Plan party" with AI' })

    await user.click(opener)
    await screen.findByRole('dialog', { name: 'Break down “Plan party”' })
    await user.keyboard('{Escape}')

    expect(opener).toHaveFocus()
  })

  it('returns focus to the Edit button when editing ends', async () => {
    const user = renderApp([{ title: 'Call the bank' }])

    await user.click(await screen.findByRole('button', { name: 'Edit "Call the bank"' }))
    expect(screen.getByLabelText('Title')).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Edit "Call the bank"' })).toHaveFocus()
  })
})
