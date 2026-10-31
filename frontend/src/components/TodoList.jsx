import TodoItem from './TodoItem.jsx'

// Shows top-level tasks, each followed by its own subtasks.
export default function TodoList({ todos, subtasksByParent, onToggle, onUpdate, onDelete }) {
  return (
    <ul className="card todo-list" aria-label="Tasks">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          subtasks={subtasksByParent.get(todo.id)}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
