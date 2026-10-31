import { TrashIcon } from './icons.jsx'

export default function TodoItem({ todo, subtasks = [], onToggle, onDelete, isSubtask = false }) {
  const doneSubtasks = subtasks.filter((sub) => sub.completed).length

  return (
    <li className={`todo ${isSubtask ? 'todo--subtask' : ''} ${todo.completed ? 'todo--done' : ''}`}>
      <div className="todo-row">
        <span className="check-target">
          <input
            type="checkbox"
            className="checkbox"
            checked={todo.completed}
            onChange={() => onToggle(todo)}
            aria-label={todo.title}
          />
        </span>
        <div className="todo-text">
          <span className="todo-title">{todo.title}</span>
          {subtasks.length > 0 && (
            <span className="todo-meta">
              {doneSubtasks} of {subtasks.length} subtasks done
            </span>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(todo)}
          aria-label={`Delete "${todo.title}"`}
        >
          <TrashIcon />
        </button>
      </div>

      {subtasks.length > 0 && (
        <ul className="subtasks" aria-label={`Subtasks of ${todo.title}`}>
          {subtasks.map((sub) => (
            <TodoItem key={sub.id} todo={sub} onToggle={onToggle} onDelete={onDelete} isSubtask />
          ))}
        </ul>
      )}
    </li>
  )
}
