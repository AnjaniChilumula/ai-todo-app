import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from './context.js'

function Checking() {
  return (
    <p className="loading" role="status">
      Checking your session…
    </p>
  )
}

/** Pages for signed-in people. Signed-out visitors go to /login and come back afterwards. */
export function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (user === undefined) return <Checking />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Admin-only pages. The server enforces this too; this just keeps others from seeing them. */
export function RequireAdmin() {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

/** Sign-in and sign-up pages: pointless when already signed in, or in the demo. */
export function SignedOutOnly() {
  const { user, demo } = useAuth()
  if (user === undefined) return <Checking />
  if (user || demo) return <Navigate to="/" replace />
  return <Outlet />
}
