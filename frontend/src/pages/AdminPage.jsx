import { useEffect, useState } from 'react'

import { api } from '../api/client.js'
import { useAuth } from '../auth/context.js'
import { formatRelative } from '../utils/dates.js'

// Wireframes v2, screen 6. The server allows this page's calls for admins only.
export default function AdminPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null) // null while loading
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    api.adminUsers().then(setUsers, (err) => setError(err.message))
  }, [])

  async function change(account, changes) {
    setBusyId(account.id)
    setError(null)
    try {
      const updated = await api.adminUpdateUser(account.id, changes)
      setUsers((current) => current.map((u) => (u.id === account.id ? updated : u)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="page page--wide">
      <div>
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">
          {users ? `${users.length} ${users.length === 1 ? 'account' : 'accounts'} · ` : ''}
          Admins see task counts, never task contents.
        </p>
      </div>

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      {users === null ? (
        !error && (
          <p className="loading" role="status">
            Loading accounts…
          </p>
        )
      ) : (
        <div className="card table-wrap">
          <table className="users-table">
            <caption className="visually-hidden">All accounts</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Tasks</th>
                <th scope="col">Last active</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id}>
                  <th scope="row">{account.name}</th>
                  <td className="muted-cell">{account.email}</td>
                  <td>
                    <span className={`chip ${account.role === 'admin' ? 'chip--linked' : 'chip--low'}`}>
                      {account.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span className={`chip ${account.is_active ? 'chip--ok' : 'chip--overdue'}`}>
                      {account.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>{account.task_count}</td>
                  <td className="muted-cell">
                    {account.last_active_at ? formatRelative(account.last_active_at) : 'Never'}
                  </td>
                  <td>
                    {account.id === me.id ? (
                      <span className="muted-cell">This is you</span>
                    ) : (
                      <div className="row-actions">
                        <button
                          type="button"
                          className="button"
                          disabled={busyId === account.id}
                          onClick={() =>
                            change(account, { role: account.role === 'admin' ? 'user' : 'admin' })
                          }
                        >
                          {account.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          <span className="visually-hidden"> {account.name}</span>
                        </button>
                        <button
                          type="button"
                          className={`button ${account.is_active ? 'button--warn' : ''}`}
                          disabled={busyId === account.id}
                          onClick={() => change(account, { is_active: !account.is_active })}
                        >
                          {account.is_active ? 'Disable' : 'Enable'}
                          <span className="visually-hidden"> {account.name}</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
