import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from './api/client.js'
import App from './App.jsx'
import { createMemoryStore } from './test/memoryStore.js'

function renderApp(initialTodos = []) {
  const store = createMemoryStore(initialTodos)
  render(<App store={store} />)
  return { store, user: userEvent.setup() }
}

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })
  })

  describe('AI status pill', () => {
    it('shows "AI off" when the backend has no key', async () => {
      renderApp()

      expect(screen.getByRole('heading', { name: 'My Tasks' })).toBeInTheDocument()
      expect(await screen.findByText('AI off')).toBeInTheDocument()
    })

    it('shows "AI ready" when the backend has AI enabled', async () => {
      api.health.mockResolvedValue({ status: 'ok', ai_enabled: true })
      renderApp()

      expect(await screen.findByText('AI ready')).toBeInTheDocument()
    })

    it('treats an unreachable backend as AI off', async () => {
      api.health.mockRejectedValue(new Error('Network error'))
      renderApp()

      expect(await screen.findByText('AI off')).toBeInTheDocument()
    })
  })

  describe('task list', () => {
    it('shows the empty state when there are no tasks', async () => {
      renderApp()

      expect(screen.getByRole('status')).toHaveTextContent('Loading tasks')
      expect(await screen.findByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    })

    it('adds a task and clears the input', async () => {
      const { user } = renderApp()
      const input = await screen.findByLabelText('New task')

      await user.type(input, 'Buy groceries')
      await user.click(screen.getByRole('button', { name: 'Add' }))

      expect(await screen.findByRole('checkbox', { name: 'Buy groceries' })).toBeInTheDocument()
      expect(input).toHaveValue('')
    })

    it('does not allow adding an empty task', async () => {
      const { user } = renderApp()

      await user.type(await screen.findByLabelText('New task'), '   ')

      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    })

    it('marks a task as done and back', async () => {
      const { user } = renderApp([{ title: 'Call the bank' }])
      const checkbox = await screen.findByRole('checkbox', { name: 'Call the bank' })

      await user.click(checkbox)
      expect(checkbox).toBeChecked()

      await user.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })

    it('deletes a task', async () => {
      const { user } = renderApp([{ title: 'Call the bank' }, { title: 'Read docs' }])

      await user.click(await screen.findByRole('button', { name: 'Delete "Call the bank"' }))

      expect(screen.queryByRole('checkbox', { name: 'Call the bank' })).not.toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Read docs' })).toBeInTheDocument()
    })

    it('shows subtasks under their parent with a progress count', async () => {
      renderApp([
        { title: 'Plan birthday party' },
        { title: 'Make the guest list', parent_id: 1, completed: true },
        { title: 'Order the cake', parent_id: 1 },
      ])

      const subtasks = await screen.findByRole('list', { name: 'Subtasks of Plan birthday party' })
      expect(within(subtasks).getAllByRole('checkbox')).toHaveLength(2)
      expect(screen.getByText('1 of 2 subtasks done')).toBeInTheDocument()
    })

    it('shows an error and keeps the text when saving fails', async () => {
      const { store, user } = renderApp()
      vi.spyOn(store, 'create').mockRejectedValue(new Error('Server is down.'))
      const input = await screen.findByLabelText('New task')

      await user.type(input, 'Buy groceries')
      await user.click(screen.getByRole('button', { name: 'Add' }))

      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't add the task.")
      expect(input).toHaveValue('Buy groceries')

      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
