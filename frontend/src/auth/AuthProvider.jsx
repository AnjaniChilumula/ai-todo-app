import { useCallback, useEffect, useMemo, useState } from 'react'

import { api, setSignedOutHandler } from '../api/client.js'
import { AuthContext, GUEST } from './context.js'

// Knows who is signed in. On start it asks the backend (/api/auth/me); any later 401 from the API
// means the session ended, which flips the user to signed out and lets the router show /login.
export default function AuthProvider({ demo = false, children }) {
  const [user, setUser] = useState(demo ? GUEST : undefined) // undefined = still checking
  const [config, setConfig] = useState({ password: !demo, google: false })

  useEffect(() => {
    if (demo) return
    let cancelled = false
    api.me().then(
      (me) => !cancelled && setUser(me),
      () => !cancelled && setUser(null),
    )
    api.authConfig().then(
      (loaded) => !cancelled && setConfig(loaded),
      () => {}, // keep the defaults: password sign-in only
    )
    setSignedOutHandler(() => setUser(null))
    return () => {
      cancelled = true
      setSignedOutHandler(null)
    }
  }, [demo])

  const signIn = useCallback(async (email, password) => {
    const me = await api.signIn({ email, password })
    setUser(me)
    return me
  }, [])

  const signUp = useCallback(async (details) => {
    const me = await api.signUp(details)
    setUser(me)
    return me
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.signOut()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, config, demo, signIn, signUp, signOut, setUser }),
    [user, config, demo, signIn, signUp, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
