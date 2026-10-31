import { useEffect, useState } from 'react'

import { api } from './api/client.js'
import Header from './components/Header.jsx'
import StatusPill from './components/StatusPill.jsx'

export default function App() {
  const [aiStatus, setAiStatus] = useState('checking')

  useEffect(() => {
    let cancelled = false
    api
      .health()
      .then((health) => !cancelled && setAiStatus(health.ai_enabled ? 'on' : 'off'))
      .catch(() => !cancelled && setAiStatus('off'))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="page">
      <Header>
        <StatusPill aiStatus={aiStatus} />
      </Header>
    </main>
  )
}
