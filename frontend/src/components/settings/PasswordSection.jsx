import { useState } from 'react'

import { api } from '../../api/client.js'
import { useAuth } from '../../auth/context.js'
import PasswordField from '../auth/PasswordField.jsx'
import SettingsSection, { FormStatus } from './SettingsSection.jsx'

// Change your password, or set a first one if you signed up with Google.
export default function PasswordSection({ onChanged }) {
  const { user, setUser } = useAuth()
  const hasPassword = user.has_password
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (next.length < 8) {
      setStatus({ kind: 'error', text: 'Your new password needs at least 8 characters.' })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      await api.changePassword({
        current_password: hasPassword ? current : undefined,
        new_password: next,
      })
      setUser({ ...user, has_password: true })
      setCurrent('')
      setNext('')
      setStatus({
        kind: 'ok',
        text: hasPassword
          ? 'Password changed. Your other devices have been signed out.'
          : 'Password set. You can now also sign in with your email.',
      })
      onChanged?.()
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      title={hasPassword ? 'Password' : 'Set a password'}
      description={
        hasPassword
          ? 'Changing your password signs you out on your other devices.'
          : 'You signed up with Google. Set a password to also sign in with your email.'
      }
    >
      <form className="settings-form" onSubmit={handleSubmit}>
        {hasPassword && (
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
          />
        )}
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={next}
          onChange={setNext}
        />
        <div className="settings-actions">
          <FormStatus status={status} />
          <button type="submit" className="button button--primary" disabled={saving}>
            {hasPassword ? 'Change password' : 'Set password'}
          </button>
        </div>
      </form>
    </SettingsSection>
  )
}
