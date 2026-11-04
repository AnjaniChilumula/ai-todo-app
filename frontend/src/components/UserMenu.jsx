import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { useAuth } from '../auth/context.js'
import { ChevronDownIcon, ShieldIcon, SignOutIcon, SlidersIcon } from './icons.jsx'

function initials(name) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
  return (letters.length > 1 ? letters[0] + letters.at(-1) : letters[0] ?? '?').toUpperCase()
}

// The avatar button in the top bar and the small panel it opens (a disclosure: a button that
// shows and hides a group of links and buttons).
export default function UserMenu() {
  const { user, demo, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)

  // Close when clicking anywhere outside the menu.
  useEffect(() => {
    if (!open) return
    function handlePointer(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [open])

  function closeAndRefocus() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div
      className="user-menu"
      ref={wrapperRef}
      onKeyDown={(event) => open && event.key === 'Escape' && closeAndRefocus()}
    >
      <button
        ref={buttonRef}
        type="button"
        className="avatar-button"
        aria-expanded={open}
        aria-controls="user-menu-panel"
        onClick={() => setOpen(!open)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.name)}
        </span>
        <ChevronDownIcon size={16} />
        <span className="visually-hidden">Account menu for {user.name}</span>
      </button>

      {open && (
        <div id="user-menu-panel" className="user-menu-panel">
          <div className="user-menu-who">
            <strong>{user.name}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          <div className="user-menu-divider" />
          {!demo && (
            <>
              <Link to="/settings" className="user-menu-item" onClick={() => setOpen(false)}>
                <SlidersIcon size={18} />
                Settings
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="user-menu-item" onClick={() => setOpen(false)}>
                  <ShieldIcon size={18} />
                  Admin
                </Link>
              )}
              <div className="user-menu-divider" />
            </>
          )}
          {demo ? (
            <p className="user-menu-note">Demo: no accounts. Tasks stay in this browser.</p>
          ) : (
            <button
              type="button"
              className="user-menu-item"
              onClick={() => {
                setOpen(false)
                signOut()
              }}
            >
              <SignOutIcon size={18} />
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  )
}
