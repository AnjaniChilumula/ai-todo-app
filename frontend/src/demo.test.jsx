import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from './api/client.js'
import App from './App.jsx'
import { createMemoryStore } from './test/memoryStore.js'

describe('AI off banner and demo mode', () => {
  beforeEach(() => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })
  })

  it('explains how to turn AI on when the backend has no key', async () => {
    render(<App store={createMemoryStore()} />)

    const banner = await screen.findByRole('region', { name: 'AI features are off' })
    expect(banner).toHaveTextContent('ANTHROPIC_API_KEY')
    expect(screen.getByRole('link', { name: 'How to set it up' })).toHaveAttribute(
      'href',
      expect.stringContaining('#run-the-backend'),
    )
  })

  it('hides the banner when AI is ready', async () => {
    api.health.mockResolvedValue({ status: 'ok', ai_enabled: true })
    render(<App store={createMemoryStore()} />)

    await screen.findByText('AI ready')
    expect(screen.queryByRole('region', { name: 'AI features are off' })).not.toBeInTheDocument()
  })

  it('in demo mode, never calls the backend and explains the demo', async () => {
    render(<App store={createMemoryStore()} demo />)

    expect(screen.getByText('AI off')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'AI features are off' })).toHaveTextContent(
      'online demo',
    )
    expect(screen.getByRole('link', { name: 'How to run it' })).toBeInTheDocument()
    expect(api.health).not.toHaveBeenCalled()
  })

  it('in demo mode, tasks can still be added', async () => {
    const user = userEvent.setup()
    render(<App store={createMemoryStore()} demo />)

    await user.type(await screen.findByLabelText('New task'), 'Try the demo')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('checkbox', { name: 'Try the demo' })).toBeInTheDocument()
  })
})
