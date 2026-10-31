import { useEffect, useState } from 'react'

import { api } from './api/client.js'
import AddTodoForm from './components/AddTodoForm.jsx'
import EmptyState from './components/EmptyState.jsx'
import ErrorAlert from './components/ErrorAlert.jsx'
import FilterTabs from './components/FilterTabs.jsx'
import Header from './components/Header.jsx'
import StatusPill from './components/StatusPill.jsx'
import TodoList from './components/TodoList.jsx'
import { useTodos } from './hooks/useTodos.js'
import { defaultStore } from './storage/index.js'
import { countTasks, filterTasks, groupTasks } from './utils/tasks.js'

const EMPTY_FILTER_MESSAGES = {
  active: 'Nothing left to do. Nice work!',
  completed: 'No completed tasks yet.',
}

export default function App({ store = defaultStore }) {
  const [aiStatus, setAiStatus] = useState('checking')
  const [filter, setFilter] = useState('all')
  const { todos, loading, error, dismissError, addTodo, updateTodo, deleteTodo } = useTodos(store)
  const { topLevel, subtasksByParent } = groupTasks(todos)
  const visible = filterTasks(topLevel, filter)
  const counts = countTasks(topLevel)

  useEffect(() => {
    let cancelled = false
    api
      .health()
      .then((health) => !cancelled && setAiStatus(health.ai_enabled ? 'on' : 'off'))
      .catch(() => !cancelled && setAiStatus('off'))
    return () => {
      cancelled = true
    }
  }, [])

  let content
  if (loading) {
    content = (
      <p className="loading" role="status">
        Loading tasks…
      </p>
    )
  } else if (topLevel.length === 0) {
    content = <EmptyState />
  } else if (visible.length === 0) {
    content = <p className="card filter-empty">{EMPTY_FILTER_MESSAGES[filter]}</p>
  } else {
    content = (
      <TodoList
        todos={visible}
        subtasksByParent={subtasksByParent}
        onToggle={(todo) => updateTodo(todo.id, { completed: !todo.completed })}
        onUpdate={updateTodo}
        onDelete={(todo) => deleteTodo(todo.id)}
      />
    )
  }

  return (
    <main className="page">
      <Header>
        <StatusPill aiStatus={aiStatus} />
      </Header>
      {error && <ErrorAlert message={error} onDismiss={dismissError} />}
      <AddTodoForm onAdd={addTodo} />
      {!loading && topLevel.length > 0 && (
        <FilterTabs filter={filter} counts={counts} onChange={setFilter} />
      )}
      {content}
    </main>
  )
}
