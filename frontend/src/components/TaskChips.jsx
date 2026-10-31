import { formatDue, isOverdue } from '../utils/dates.js'
import { CalendarIcon } from './icons.jsx'

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' }

export default function TaskChips({ todo }) {
  const overdue = todo.due_at && !todo.completed && isOverdue(todo.due_at)

  return (
    <div className="chips">
      {todo.due_at && (
        <span className={`chip chip--due ${overdue ? 'chip--overdue' : ''}`}>
          <CalendarIcon size={13} />
          <span className="visually-hidden">{overdue ? 'Overdue, was due' : 'Due'}</span>
          {formatDue(todo.due_at)}
        </span>
      )}
      <span className={`chip chip--${todo.priority}`}>
        <span className="visually-hidden">Priority:</span> {PRIORITY_LABELS[todo.priority]}
      </span>
    </div>
  )
}
