import { useCallback, useEffect, useState } from 'react'

/**
 * Loads tasks from a store and keeps them in React state.
 *
 * Every action waits for the store to succeed before updating the list, so the screen never shows
 * a change that was not saved. Failures are reported through `error` instead of being thrown.
 */
export function useTodos(store) {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    store
      .list()
      .then((loaded) => !cancelled && setTodos(loaded))
      .catch((err) => !cancelled && setError(`Couldn't load your tasks. ${err.message}`))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [store])

  // Runs an action and turns a failure into an error message. Returns true on success.
  const attempt = useCallback(async (action, failure) => {
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(`${failure} ${err.message}`)
      return false
    }
  }, [])

  const addTodo = useCallback(
    (data) =>
      attempt(async () => {
        const created = await store.create(data)
        setTodos((current) => [...current, created])
      }, "Couldn't add the task."),
    [attempt, store],
  )

  const updateTodo = useCallback(
    (id, changes) =>
      attempt(async () => {
        const updated = await store.update(id, changes)
        setTodos((current) => current.map((todo) => (todo.id === id ? updated : todo)))
      }, "Couldn't save the change."),
    [attempt, store],
  )

  const deleteTodo = useCallback(
    (id) =>
      attempt(async () => {
        await store.remove(id)
        setTodos((current) => current.filter((todo) => todo.id !== id && todo.parent_id !== id))
      }, "Couldn't delete the task."),
    [attempt, store],
  )

  const clearCompleted = useCallback(
    () =>
      attempt(async () => {
        await store.clearCompleted()
        setTodos((current) => {
          const doneIds = new Set(current.filter((todo) => todo.completed).map((todo) => todo.id))
          return current.filter((todo) => !doneIds.has(todo.id) && !doneIds.has(todo.parent_id))
        })
      }, "Couldn't clear completed tasks."),
    [attempt, store],
  )

  return {
    todos,
    loading,
    error,
    dismissError: () => setError(null),
    addTodo,
    updateTodo,
    deleteTodo,
    clearCompleted,
  }
}
