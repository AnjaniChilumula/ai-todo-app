// A store that keeps tasks in the browser's localStorage. Used by the GitHub Pages demo, where
// there is no backend. It follows the same rules as the API so the UI behaves the same way.

const KEY = 'ai-todo-app:todos:v1'

class LocalStoreError extends Error {}

function readAll(storage) {
  try {
    const saved = JSON.parse(storage.getItem(KEY))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function writeAll(storage, todos) {
  try {
    storage.setItem(KEY, JSON.stringify(todos))
  } catch {
    throw new LocalStoreError('Your browser did not allow saving (storage may be full or blocked).')
  }
}

function cleanTitle(title) {
  const trimmed = typeof title === 'string' ? title.trim() : ''
  if (!trimmed) throw new LocalStoreError('Title cannot be empty.')
  return trimmed.slice(0, 200)
}

export function createLocalStore(storage = window.localStorage) {
  return {
    async list() {
      return readAll(storage)
    },

    async create(data) {
      const todos = readAll(storage)
      if (data.parent_id != null) {
        const parent = todos.find((todo) => todo.id === data.parent_id)
        if (!parent) throw new LocalStoreError('Parent task not found.')
        if (parent.parent_id != null) throw new LocalStoreError('Subtasks cannot have subtasks.')
      }
      const now = new Date().toISOString()
      const todo = {
        id: Math.max(0, ...todos.map((t) => t.id)) + 1,
        title: cleanTitle(data.title),
        notes: data.notes ?? null,
        due_at: data.due_at ?? null,
        priority: data.priority ?? 'medium',
        completed: false,
        parent_id: data.parent_id ?? null,
        created_at: now,
        updated_at: now,
      }
      writeAll(storage, [...todos, todo])
      return todo
    },

    async update(id, changes) {
      const todos = readAll(storage)
      const existing = todos.find((todo) => todo.id === id)
      if (!existing) throw new LocalStoreError('Task not found.')
      const updated = { ...existing, ...changes, updated_at: new Date().toISOString() }
      if ('title' in changes) updated.title = cleanTitle(changes.title)
      writeAll(
        storage,
        todos.map((todo) => (todo.id === id ? updated : todo)),
      )
      return updated
    },

    async remove(id) {
      const todos = readAll(storage)
      if (!todos.some((todo) => todo.id === id)) throw new LocalStoreError('Task not found.')
      writeAll(
        storage,
        todos.filter((todo) => todo.id !== id && todo.parent_id !== id),
      )
      return null
    },

    async clearCompleted() {
      const todos = readAll(storage)
      const doneIds = new Set(todos.filter((todo) => todo.completed).map((todo) => todo.id))
      const kept = todos.filter((todo) => !doneIds.has(todo.id) && !doneIds.has(todo.parent_id))
      writeAll(storage, kept)
      return { deleted: todos.length - kept.length }
    },
  }
}
