import { useCallback, useEffect, useState } from 'react'

import { api } from '../../api/client.js'
import { formatRelative } from '../../utils/dates.js'
import { MonitorIcon, PhoneIcon } from '../icons.jsx'
import SettingsSection, { FormStatus } from './SettingsSection.jsx'

const MOBILE = /iPhone|iPad|Android/

export default function SessionsSection() {
  const [sessions, setSessions] = useState(null) // null while loading
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  // Only sets state when the answer arrives, so it can start from an effect.
  const load = useCallback(
    () =>
      api.listSessions().then(setSessions, (err) => setStatus({ kind: 'error', text: err.message })),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  async function run(action, success) {
    setBusy(true)
    setStatus(null)
    try {
      const result = await action()
      setStatus({ kind: 'ok', text: success(result) })
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  function signOutOne(session) {
    run(
      async () => {
        await api.endSession(session.id)
        setSessions((current) => current.filter((s) => s.id !== session.id))
      },
      () => `Signed out ${session.device}.`,
    )
  }

  function signOutOthers() {
    run(
      async () => {
        const { ended } = await api.endOtherSessions()
        setSessions((current) => current.filter((s) => s.current))
        return ended
      },
      (ended) => `Signed out ${ended} other ${ended === 1 ? 'device' : 'devices'}.`,
    )
  }

  const others = sessions?.filter((s) => !s.current).length ?? 0

  return (
    <SettingsSection
      title="Where you’re signed in"
      description="Sign out of any device you don’t recognise."
    >
      {sessions === null ? (
        <p className="loading" role="status">
          Loading your devices…
        </p>
      ) : (
        <ul className="session-list" aria-label="Signed-in devices">
          {sessions.map((session) => (
            <li key={session.id} className="session">
              {MOBILE.test(session.device) ? <PhoneIcon size={22} /> : <MonitorIcon size={22} />}
              <div className="session-text">
                <span className="session-device">
                  {session.device}
                  {session.current && <span className="chip chip--ok">This device</span>}
                </span>
                <span className="session-when">
                  {session.current
                    ? 'Active now'
                    : `Last active ${formatRelative(session.last_seen_at)}`}
                </span>
              </div>
              {!session.current && (
                <button
                  type="button"
                  className="button"
                  onClick={() => signOutOne(session)}
                  disabled={busy}
                  aria-label={`Sign out ${session.device}`}
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="settings-actions">
        <FormStatus status={status} />
        <button
          type="button"
          className="button button--warn"
          onClick={signOutOthers}
          disabled={busy || others === 0}
        >
          Sign out everywhere else
        </button>
      </div>
    </SettingsSection>
  )
}
