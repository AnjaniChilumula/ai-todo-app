// Thin wrapper around fetch for the FastAPI backend.
// In development Vite proxies /api to http://localhost:8000 (see vite.config.js), so requests are
// same-origin and the browser sends the HttpOnly session cookie automatically.

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Called when a request comes back 401 (signed out or session expired), so the app can show the
// sign-in page. Calls that are *expected* to 401 (checking who is signed in, a wrong password)
// pass quiet401 and don't trigger it.
let onSignedOut = null

export function setSignedOutHandler(handler) {
  onSignedOut = handler
}

async function request(path, { method = 'GET', body, quiet401 = false } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = await response.json()
      if (typeof data.detail === 'string') message = data.detail
    } catch {
      // Error body was not JSON; keep the generic message.
    }
    if (response.status === 401 && !quiet401) onSignedOut?.()
    throw new ApiError(response.status, message)
  }

  return response.status === 204 ? null : response.json()
}

export const api = {
  health: () => request('/api/health'),

  // Accounts
  authConfig: () => request('/api/auth/config'),
  me: () => request('/api/auth/me', { quiet401: true }),
  signUp: (data) => request('/api/auth/signup', { method: 'POST', body: data }),
  signIn: (data) => request('/api/auth/login', { method: 'POST', body: data, quiet401: true }),
  signOut: () => request('/api/auth/logout', { method: 'POST' }),

  // Your account
  updateAccount: (changes) => request('/api/account', { method: 'PATCH', body: changes }),
  changePassword: (data) => request('/api/account/password', { method: 'POST', body: data }),
  listSessions: () => request('/api/account/sessions'),
  endSession: (id) => request(`/api/account/sessions/${id}`, { method: 'DELETE' }),
  endOtherSessions: () => request('/api/account/sessions?others=true', { method: 'DELETE' }),

  // Admin only
  adminUsers: () => request('/api/admin/users'),
  adminUpdateUser: (id, changes) =>
    request(`/api/admin/users/${id}`, { method: 'PATCH', body: changes }),

  // Tasks
  listTodos: () => request('/api/todos'),
  createTodo: (data) => request('/api/todos', { method: 'POST', body: data }),
  updateTodo: (id, changes) => request(`/api/todos/${id}`, { method: 'PATCH', body: changes }),
  deleteTodo: (id) => request(`/api/todos/${id}`, { method: 'DELETE' }),
  clearCompleted: () => request('/api/todos?completed=true', { method: 'DELETE' }),

  // AI suggestions: nothing is saved until the user confirms.
  parseTask: (text, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) =>
    request('/api/ai/parse', { method: 'POST', body: { text, timezone } }),
  breakdown: (todoId) => request('/api/ai/breakdown', { method: 'POST', body: { todo_id: todoId } }),
}

// Full-page navigation (not fetch): the backend redirects the browser to Google and back.
export const GOOGLE_SIGN_IN_URL = '/api/auth/google/start'
