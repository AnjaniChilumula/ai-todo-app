// An in-memory store for tests. Behaves like the API: returns copies and assigns ids.

const defaults = {
  notes: null,
  due_at: null,
  priority: 'medium',
  completed: false,
  parent_id: null,
}

export function createMemoryStore(initial = []) {
  let todos = initial.map((todo, index) => ({ ...defaults, id: index + 1, ...todo }))
  let nextId = Math.max(0, ...todos.map((todo) => todo.id)) + 1

  return {
    list: async () => todos.map((todo) => ({ ...todo })),
    create: async (data) => {
      const todo = { ...defaults, ...data, id: nextId++ }
      todos.push(todo)
      return { ...todo }
    },
    update: async (id, changes) => {
      todos = todos.map((todo) => (todo.id === id ? { ...todo, ...changes } : todo))
      return { ...todos.find((todo) => todo.id === id) }
    },
    remove: async (id) => {
      todos = todos.filter((todo) => todo.id !== id && todo.parent_id !== id)
      return null
    },
    clearCompleted: async () => {
      const doneIds = new Set(todos.filter((todo) => todo.completed).map((todo) => todo.id))
      const before = todos.length
      todos = todos.filter((todo) => !doneIds.has(todo.id) && !doneIds.has(todo.parent_id))
      return { deleted: before - todos.length }
    },
  }
}
