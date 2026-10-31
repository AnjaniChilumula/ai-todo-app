// Thin wrapper around fetch for the FastAPI backend.
// In development Vite proxies /api to http://localhost:8000 (see vite.config.js).

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
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
    throw new ApiError(response.status, message)
  }

  return response.status === 204 ? null : response.json()
}

export const api = {
  health: () => request('/api/health'),
  listTodos: () => request('/api/todos'),
  createTodo: (data) => request('/api/todos', { method: 'POST', body: data }),
  updateTodo: (id, changes) => request(`/api/todos/${id}`, { method: 'PATCH', body: changes }),
  deleteTodo: (id) => request(`/api/todos/${id}`, { method: 'DELETE' }),
  clearCompleted: () => request('/api/todos?completed=true', { method: 'DELETE' }),
}
