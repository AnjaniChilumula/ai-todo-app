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

const sampleTodos = [
  { title: 'Submit FastAPI assignment', priority: 'high' },
  { title: 'Call the bank', priority: 'low' },
  { title: 'Read the React docs', completed: true },
]

describe('editing, filters and clear completed', () => {
  beforeEach(() => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })
  })

  it('shows priority chips on open tasks', async () => {
    renderApp(sampleTodos)

    const tasks = await screen.findByRole('list', { name: 'Tasks' })
    expect(within(tasks).getByText('High')).toBeInTheDocument()
    expect(within(tasks).getByText('Low')).toBeInTheDocument()
  })

  it('edits a task inline', async () => {
    const user = renderApp(sampleTodos)

    await user.click(await screen.findByRole('button', { name: 'Edit "Call the bank"' }))
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Call the bank about the card')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByRole('checkbox', { name: 'Call the bank about the card' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })

  it('cancels editing with Escape without saving', async () => {
    const user = renderApp(sampleTodos)

    await user.click(await screen.findByRole('button', { name: 'Edit "Call the bank"' }))
    await user.type(screen.getByLabelText('Title'), ' (changed){Escape}')

    expect(screen.getByRole('checkbox', { name: 'Call the bank' })).toBeInTheDocument()
  })

  it('filters by status and shows counts', async () => {
    const user = renderApp(sampleTodos)

    await user.click(await screen.findByRole('button', { name: 'Active · 2' }))
    expect(screen.queryByRole('checkbox', { name: 'Read the React docs' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active · 2' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Completed · 1' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: 'Read the React docs' })).toBeChecked()
  })

  it('shows a message when a filter has no tasks', async () => {
    const user = renderApp([{ title: 'Only task' }])

    await user.click(await screen.findByRole('button', { name: 'Completed · 0' }))

    expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument()
  })

  it('counts tasks left and clears completed ones', async () => {
    const user = renderApp(sampleTodos)

    expect(await screen.findByText('2 tasks left')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear completed (1)' }))

    expect(screen.queryByRole('checkbox', { name: 'Read the React docs' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Clear completed/ })).not.toBeInTheDocument()
  })
})
