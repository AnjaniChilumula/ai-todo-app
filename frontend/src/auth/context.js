import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

// The demo (GitHub Pages) has no backend and so no accounts: everyone is this local guest.
export const GUEST = {
  id: 0,
  name: 'Guest',
  email: '',
  role: 'user',
  has_password: false,
  google_linked: false,
  guest: true,
}

/** { user, config, demo, signIn, signUp, signOut, setUser }. user is undefined while checking. */
export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}
