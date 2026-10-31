import { useEffect, useState } from 'react'

import { api } from './api/client.js'
import AddTodoForm from './components/AddTodoForm.jsx'
import Header from './components/Header.jsx'
import StatusPill from './components/StatusPill.jsx'
import TodoList from './components/TodoList.jsx'
import { useTodos } from './hooks/useTodos.js'
import { defaultStore } from './storage/index.js'

export default function App({ store = defaultStore }) {
  const [aiStatus, setAiStatus] = useState('checking')
  const { todos, addTodo, updateTodo, deleteTodo } = useTodos(store)

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

  return (
    <main className="page">
      <Header>
        <StatusPill aiStatus={aiStatus} />
      </Header>
      <AddTodoForm onAdd={addTodo} />
      {todos.length > 0 && (
        <TodoList
          todos={todos}
          onToggle={(todo) => updateTodo(todo.id, { completed: !todo.completed })}
          onDelete={(todo) => deleteTodo(todo.id)}
        />
      )}
    </main>
  )
}
