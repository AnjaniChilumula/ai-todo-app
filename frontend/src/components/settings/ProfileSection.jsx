import { useState } from 'react'

import { api } from '../../api/client.js'
import { useAuth } from '../../auth/context.js'
import SettingsSection, { FormStatus } from './SettingsSection.jsx'

export default function ProfileSection() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user.name)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setStatus(null)
    try {
      setUser(await api.updateAccount({ name: trimmed }))
      setStatus({ kind: 'ok', text: 'Saved.' })
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection title="Profile">
      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="profile-name" className="field-label">
            Name
          </label>
          <input
            id="profile-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={80}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-email" className="field-label">
            Email
          </label>
          <input
            id="profile-email"
            className="input"
            value={user.email}
            readOnly
            aria-describedby="profile-email-note"
          />
          <span id="profile-email-note" className="field-hint">
            {user.google_linked && <span className="chip chip--linked">Google linked</span>}{' '}
            {user.google_linked
              ? 'You can sign in with Google or with your password.'
              : 'Your email can’t be changed yet.'}
          </span>
        </div>
        <div className="settings-actions">
          <FormStatus status={status} />
          <button
            type="submit"
            className="button button--primary"
            disabled={saving || !trimmed || trimmed === user.name}
          >
            Save
          </button>
        </div>
      </form>
    </SettingsSection>
  )
}
