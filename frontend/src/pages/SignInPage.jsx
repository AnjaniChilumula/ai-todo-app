import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useAuth } from '../auth/context.js'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import GoogleButton from '../components/auth/GoogleButton.jsx'
import PasswordField from '../components/auth/PasswordField.jsx'

// Reasons the backend gives when Google sign-in sends the browser back here (/login?error=...).
const REDIRECT_ERRORS = {
  google_failed: 'Google sign-in didn’t complete. Please try again.',
  google_unverified: 'Your Google account’s email address isn’t verified.',
  google_conflict: 'This email is already linked to a different Google account.',
  disabled: 'This account has been disabled.',
}

export default function SignInPage() {
  const { signIn, config } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(REDIRECT_ERRORS[params.get('error')] ?? null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password) // the router then leaves this page
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see your tasks."
      footer={
        <>
          New here? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      {config.google && <GoogleButton label="Continue with Google" />}
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="signin-email" className="field-label">
            Email
          </label>
          <input
            id="signin-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <PasswordField autoComplete="current-password" value={password} onChange={setPassword} />
        <button type="submit" className="button button--primary auth-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  )
}
