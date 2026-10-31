import { useState } from 'react'

import { PencilIcon, SparkleIcon, TrashIcon } from './icons.jsx'
import TaskChips from './TaskChips.jsx'
import TodoEditForm from './TodoEditForm.jsx'

export default function TodoItem({
  todo,
  subtasks = [],
  onToggle,
  onUpdate,
  onDelete,
  onBreakdown,
  aiReady = false,
  isSubtask = false,
}) {
  const [editing, setEditing] = useState(false)
  const doneSubtasks = subtasks.filter((sub) => sub.completed).length
  const showDetails = !isSubtask && !todo.completed

  return (
    <li
      className={`todo ${isSubtask ? 'todo--subtask' : ''} ${todo.completed ? 'todo--done' : ''} ${editing ? 'todo--editing' : ''}`}
    >
      {editing ? (
        <TodoEditForm
          todo={todo}
          onSave={(changes) => onUpdate(todo.id, changes)}
          onCancel={() => setEditing(false)}
        />
      ) : (
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
            {(showDetails || subtasks.length > 0) && (
              <div className="todo-details">
                {showDetails && <TaskChips todo={todo} />}
                {subtasks.length > 0 && (
                  <span className="todo-meta">
                    {doneSubtasks} of {subtasks.length} subtasks done
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="todo-actions">
            {aiReady && !isSubtask && !todo.completed && (
              <button
                type="button"
                className="icon-button icon-button--ai"
                onClick={() => onBreakdown(todo)}
                aria-label={`Break down "${todo.title}" with AI`}
              >
                <SparkleIcon />
              </button>
            )}
            {!todo.completed && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(true)}
                aria-label={`Edit "${todo.title}"`}
              >
                <PencilIcon />
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              onClick={() => onDelete(todo)}
              aria-label={`Delete "${todo.title}"`}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      )}

      {subtasks.length > 0 && (
        <ul className="subtasks" aria-label={`Subtasks of ${todo.title}`}>
          {subtasks.map((sub) => (
            <TodoItem
              key={sub.id}
              todo={sub}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isSubtask
            />
          ))}
        </ul>
      )}
    </li>
  )
}
