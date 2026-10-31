import { api } from '../api/client.js'

// A "store" is where tasks live. Every store has the same five methods, so the UI does not care
// whether tasks are saved by the FastAPI backend (this file) or somewhere else.
export const apiStore = {
  list: () => api.listTodos(),
  create: (data) => api.createTodo(data),
  update: (id, changes) => api.updateTodo(id, changes),
  remove: (id) => api.deleteTodo(id),
  clearCompleted: () => api.clearCompleted(),
}
