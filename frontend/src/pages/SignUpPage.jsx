import { useState } from 'react'
import { Link } from 'react-router'

import { useAuth } from '../auth/context.js'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import GoogleButton from '../components/auth/GoogleButton.jsx'
import PasswordField from '../components/auth/PasswordField.jsx'

export default function SignUpPage() {
  const { signUp, config } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Your password needs at least 8 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await signUp({ name: name.trim(), email: email.trim(), password })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Your tasks stay private to you."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {config.google && <GoogleButton label="Sign up with Google" />}
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="signup-name" className="field-label">
            Name
          </label>
          <input
            id="signup-name"
            className="input"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-email" className="field-label">
            Email
          </label>
          <input
            id="signup-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <PasswordField
          autoComplete="new-password"
          hint="At least 8 characters. A short sentence works well."
          value={password}
          onChange={setPassword}
        />
        <button type="submit" className="button button--primary auth-submit" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
