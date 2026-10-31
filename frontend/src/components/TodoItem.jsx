import { useEffect, useRef, useState } from 'react'

import ActionsSheet from './ActionsSheet.jsx'
import { MoreIcon, PencilIcon, SparkleIcon, TrashIcon } from './icons.jsx'
import TaskChips from './TaskChips.jsx'
import TodoEditForm from './TodoEditForm.jsx'

// Matches the phone breakpoint in styles.css, where row actions move into a sheet.
const isPhone = () => window.matchMedia?.('(max-width: 600px)').matches ?? false

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
  const [sheetOpen, setSheetOpen] = useState(false)
  const editButtonRef = useRef(null)
  const moreButtonRef = useRef(null)
  const wasEditing = useRef(false)
  const doneSubtasks = subtasks.filter((sub) => sub.completed).length
  const showDetails = !isSubtask && !todo.completed

  // When the edit form closes, put keyboard focus back where the user started.
  useEffect(() => {
    if (wasEditing.current && !editing) {
      ;(isPhone() ? moreButtonRef : editButtonRef).current?.focus()
    }
    wasEditing.current = editing
  }, [editing])

  const actions = []
  if (aiReady && !isSubtask && !todo.completed) {
    actions.push({
      key: 'breakdown',
      label: 'Break it down',
      ariaLabel: `Break down "${todo.title}" with AI`,
      icon: <SparkleIcon />,
      onSelect: () => onBreakdown(todo),
      ai: true,
    })
  }
  if (!todo.completed) {
    actions.push({
      key: 'edit',
      label: 'Edit',
      ariaLabel: `Edit "${todo.title}"`,
      icon: <PencilIcon />,
      onSelect: () => setEditing(true),
    })
  }
  actions.push({
    key: 'delete',
    label: 'Delete',
    ariaLabel: `Delete "${todo.title}"`,
    icon: <TrashIcon />,
    onSelect: () => onDelete(todo),
  })

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

          {/* Desktop: one icon button per action. */}
          <div className="todo-actions">
            {actions.map((action) => (
              <button
                key={action.key}
                ref={action.key === 'edit' ? editButtonRef : undefined}
                type="button"
                className={`icon-button ${action.ai ? 'icon-button--ai' : ''}`}
                onClick={action.onSelect}
                aria-label={action.ariaLabel}
              >
                {action.icon}
              </button>
            ))}
          </div>

          {/* Phones: a single "more" button that opens the actions sheet. */}
          <button
            ref={moreButtonRef}
            type="button"
            className="icon-button todo-more"
            onClick={() => setSheetOpen(true)}
            aria-label={`More actions for "${todo.title}"`}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
          >
            <MoreIcon />
          </button>
        </div>
      )}

      {sheetOpen && (
        <ActionsSheet
          title={todo.title}
          actions={actions}
          onClose={() => {
            setSheetOpen(false)
            moreButtonRef.current?.focus()
          }}
        />
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
