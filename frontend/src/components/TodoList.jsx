import TodoItem from './TodoItem.jsx'

// Shows top-level tasks, each followed by its own subtasks.
export default function TodoList({ todos, onToggle, onDelete }) {
  const subtasksByParent = new Map()
  for (const todo of todos) {
    if (todo.parent_id != null) {
      subtasksByParent.set(todo.parent_id, [...(subtasksByParent.get(todo.parent_id) ?? []), todo])
    }
  }
  const topLevel = todos.filter((todo) => todo.parent_id == null)

  return (
    <ul className="card todo-list" aria-label="Tasks">
      {topLevel.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          subtasks={subtasksByParent.get(todo.id)}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
