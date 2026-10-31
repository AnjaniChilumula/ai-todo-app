import { useEffect, useState } from 'react'

import { api } from './api/client.js'
import AddTodoForm from './components/AddTodoForm.jsx'
import AiOffBanner from './components/AiOffBanner.jsx'
import BreakdownDialog from './components/BreakdownDialog.jsx'
import EmptyState from './components/EmptyState.jsx'
import ErrorAlert from './components/ErrorAlert.jsx'
import FilterTabs from './components/FilterTabs.jsx'
import Header from './components/Header.jsx'
import ListFooter from './components/ListFooter.jsx'
import StatusPill from './components/StatusPill.jsx'
import TodoList from './components/TodoList.jsx'
import { IS_DEMO } from './config.js'
import { useTodos } from './hooks/useTodos.js'
import { defaultStore } from './storage/index.js'
import { countTasks, filterTasks, groupTasks } from './utils/tasks.js'

const EMPTY_FILTER_MESSAGES = {
  active: 'Nothing left to do. Nice work!',
  completed: 'No completed tasks yet.',
}

export default function App({ store = defaultStore, demo = IS_DEMO }) {
  // The demo has no backend, so AI is off without asking.
  const [aiStatus, setAiStatus] = useState(demo ? 'off' : 'checking')
  const [filter, setFilter] = useState('all')
  const [breakdownTodo, setBreakdownTodo] = useState(null)
  const { todos, loading, error, dismissError, addTodo, updateTodo, deleteTodo, clearCompleted } =
    useTodos(store)
  const { topLevel, subtasksByParent } = groupTasks(todos)
  const visible = filterTasks(topLevel, filter)
  const counts = countTasks(topLevel)

  useEffect(() => {
    if (demo) return
    let cancelled = false
    api
      .health()
      .then((health) => !cancelled && setAiStatus(health.ai_enabled ? 'on' : 'off'))
      .catch(() => !cancelled && setAiStatus('off'))
    return () => {
      cancelled = true
    }
  }, [demo])

  // Adds the chosen suggestions one by one; stops at the first failure.
  async function addSubtasks(parent, titles) {
    for (const title of titles) {
      if (!(await addTodo({ title, parent_id: parent.id }))) return false
    }
    return true
  }

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
        onBreakdown={setBreakdownTodo}
        aiReady={aiStatus === 'on'}
      />
    )
  }

  return (
    <main className="page">
      <Header>
        <StatusPill aiStatus={aiStatus} />
      </Header>
      {aiStatus === 'off' && <AiOffBanner demo={demo} />}
      {error && <ErrorAlert message={error} onDismiss={dismissError} />}
      <AddTodoForm onAdd={addTodo} aiStatus={aiStatus} />
      {!loading && topLevel.length > 0 && (
        <FilterTabs filter={filter} counts={counts} onChange={setFilter} />
      )}
      {content}
      {!loading && topLevel.length > 0 && (
        <ListFooter
          remaining={counts.active}
          completed={todos.filter((todo) => todo.completed).length}
          onClearCompleted={clearCompleted}
        />
      )}
      {breakdownTodo && (
        <BreakdownDialog
          todo={breakdownTodo}
          existingSubtasks={subtasksByParent.get(breakdownTodo.id) ?? []}
          onAdd={(titles) => addSubtasks(breakdownTodo, titles)}
          onClose={() => setBreakdownTodo(null)}
        />
      )}
    </main>
  )
}
