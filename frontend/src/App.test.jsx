import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { api } from './api/client.js'
import App from './App.jsx'

describe('App', () => {
  it('shows the page title', async () => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: false })

    render(<App />)

    expect(screen.getByRole('heading', { name: 'My Tasks' })).toBeInTheDocument()
    expect(await screen.findByText('AI off')).toBeInTheDocument()
  })

  it('shows "AI ready" when the backend has AI enabled', async () => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok', ai_enabled: true })

    render(<App />)

    expect(await screen.findByText('AI ready')).toBeInTheDocument()
  })

  it('treats an unreachable backend as AI off', async () => {
    vi.spyOn(api, 'health').mockRejectedValue(new Error('Network error'))

    render(<App />)

    expect(await screen.findByText('AI off')).toBeInTheDocument()
  })
})
