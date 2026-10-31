import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api } from './api/client.js'
import App from './App.jsx'
import { createMemoryStore } from './test/memoryStore.js'

function renderApp(initialTodos = []) {
  render(<App store={createMemoryStore(initialTodos)} />)
  return userEvent.setup()
}

async function typeAndAdd(user, text) {
  await user.type(await screen.findByLabelText('New task'), text)
  await user.click(screen.getByRole('button', { name: 'Add' }))
}

describe('Smart Add', () => {
  beforeEach(() => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: true })
    vi.spyOn(api, 'parseTask').mockResolvedValue({
      title: 'Call mom',
      notes: null,
      due_at: null,
      priority: 'high',
    })
  })

  it('is on by default when AI is ready', async () => {
    renderApp()

    expect(await screen.findByRole('button', { name: 'Smart Add: on' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shows what the AI understood and saves only after confirming', async () => {
    const user = renderApp()

    await typeAndAdd(user, 'call mom tomorrow, high priority')

    expect(api.parseTask).toHaveBeenCalledWith('call mom tomorrow, high priority')
    const preview = await screen.findByRole('region', { name: 'Here’s what I understood' })
    expect(within(preview).getByLabelText('Title')).toHaveValue('Call mom')
    expect(within(preview).getByLabelText('Priority')).toHaveValue('high')
    expect(screen.queryByRole('checkbox', { name: 'Call mom' })).not.toBeInTheDocument()

    await user.click(within(preview).getByRole('button', { name: 'Add task' }))

    expect(await screen.findByRole('checkbox', { name: 'Call mom' })).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Here’s what I understood' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('New task')).toHaveValue('')
  })

  it('lets the user correct the suggestion before saving', async () => {
    const user = renderApp()
    await typeAndAdd(user, 'call mom')

    const title = await screen.findByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Call mom about Sunday')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(await screen.findByRole('checkbox', { name: 'Call mom about Sunday' })).toBeInTheDocument()
  })

  it('discards the suggestion without saving', async () => {
    const user = renderApp()
    await typeAndAdd(user, 'call mom')

    await user.click(await screen.findByRole('button', { name: 'Discard' }))

    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Call mom' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('New task')).toHaveValue('call mom')
  })

  it('adds the text as typed when Smart Add is switched off', async () => {
    const user = renderApp()
    await user.click(await screen.findByRole('button', { name: 'Smart Add: on' }))

    await typeAndAdd(user, 'buy milk')

    expect(await screen.findByRole('checkbox', { name: 'buy milk' })).toBeInTheDocument()
    expect(api.parseTask).not.toHaveBeenCalled()
  })

  it('offers Try again and Add as typed when the AI fails', async () => {
    api.parseTask.mockRejectedValueOnce(new ApiError(429, 'The AI service is busy right now.'))
    const user = renderApp()

    await typeAndAdd(user, 'call mom')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The AI service is busy right now.')
    expect(alert).toHaveTextContent('Your text is still in the box.')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Title')).toHaveValue('Call mom')
    expect(api.parseTask).toHaveBeenCalledTimes(2)
  })

  it('can add the text as typed after an AI failure', async () => {
    api.parseTask.mockRejectedValueOnce(new ApiError(502, "Couldn't reach the AI service."))
    const user = renderApp()

    await typeAndAdd(user, 'call mom')
    await user.click(await screen.findByRole('button', { name: 'Add as typed' }))

    expect(await screen.findByRole('checkbox', { name: 'call mom' })).toBeInTheDocument()
  })

  it('is unavailable when AI is off', async () => {
    api.health.mockResolvedValue({ status: 'ok', ai_enabled: false })
    renderApp([{ title: 'Plan party' }])

    expect(await screen.findByRole('button', { name: 'Smart Add unavailable' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Break down/ })).not.toBeInTheDocument()
  })
})

describe('Break it down', () => {
  beforeEach(() => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: true })
    vi.spyOn(api, 'breakdown').mockResolvedValue({
      subtasks: ['Pick a date and venue', 'Order the cake', 'Make a playlist'],
    })
  })

  it('adds the ticked suggestions as subtasks', async () => {
    const user = renderApp([{ title: 'Plan party' }])

    await user.click(await screen.findByRole('button', { name: 'Break down "Plan party" with AI' }))
    const dialog = await screen.findByRole('dialog', { name: 'Break down “Plan party”' })
    expect(api.breakdown).toHaveBeenCalledWith(1)

    await user.click(await within(dialog).findByRole('checkbox', { name: 'Make a playlist' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 subtasks' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const subtasks = await screen.findByRole('list', { name: 'Subtasks of Plan party' })
    expect(within(subtasks).getByRole('checkbox', { name: 'Pick a date and venue' })).toBeInTheDocument()
    expect(within(subtasks).getByRole('checkbox', { name: 'Order the cake' })).toBeInTheDocument()
    expect(within(subtasks).queryByRole('checkbox', { name: 'Make a playlist' })).not.toBeInTheDocument()
  })

  it('mentions the subtasks the task already has', async () => {
    const user = renderApp([{ title: 'Plan party' }, { title: 'Guest list', parent_id: 1 }])

    await user.click(await screen.findByRole('button', { name: 'Break down "Plan party" with AI' }))

    expect(await screen.findByText(/Already a subtask: Guest list/)).toBeInTheDocument()
  })

  it('shows the error and closes with Escape', async () => {
    api.breakdown.mockRejectedValue(new ApiError(503, 'AI features are off.'))
    const user = renderApp([{ title: 'Plan party' }])

    await user.click(await screen.findByRole('button', { name: 'Break down "Plan party" with AI' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('AI features are off.')
    expect(within(dialog).getByRole('button', { name: 'Add 0 subtasks' })).toBeDisabled()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is not offered on completed tasks or subtasks', async () => {
    renderApp([
      { title: 'Plan party' },
      { title: 'Guest list', parent_id: 1 },
      { title: 'Done task', completed: true },
    ])

    await screen.findByRole('checkbox', { name: 'Done task' })
    expect(screen.getAllByRole('button', { name: /Break down/ })).toHaveLength(1)
  })
})
