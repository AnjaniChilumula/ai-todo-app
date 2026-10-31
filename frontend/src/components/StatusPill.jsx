import { SparkleIcon } from './icons.jsx'

// aiStatus: 'checking' | 'on' | 'off'
export default function StatusPill({ aiStatus }) {
  if (aiStatus === 'checking') return null

  const on = aiStatus === 'on'
  return (
    <span className={`status-pill ${on ? 'status-pill--on' : ''}`}>
      {on ? <SparkleIcon size={16} /> : <span className="status-dot" aria-hidden="true" />}
      {on ? 'AI ready' : 'AI off'}
    </span>
  )
}
