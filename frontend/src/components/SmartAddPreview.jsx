import { useState } from 'react'

import { fromLocalInputValue, toLocalInputValue } from '../utils/dates.js'
import { SparkleIcon } from './icons.jsx'

// Shows what the AI understood as editable fields. Nothing is saved until "Add task".
export default function SmartAddPreview({ suggestion, saving, onConfirm, onDiscard }) {
  const [title, setTitle] = useState(suggestion.title)
  const [due, setDue] = useState(toLocalInputValue(suggestion.due_at))
  const [priority, setPriority] = useState(suggestion.priority)

  function handleConfirm() {
    const trimmed = title.trim()
    if (!trimmed) return
    onConfirm({
      title: trimmed,
      notes: suggestion.notes,
      due_at: fromLocalInputValue(due),
      priority,
    })
  }

  return (
    <section className="smart-preview" aria-labelledby="smart-preview-title">
      <div className="smart-preview-header">
        <h2 id="smart-preview-title">
          <SparkleIcon size={16} />
          Here’s what I understood
        </h2>
        <span className="smart-preview-note">Nothing is saved until you click Add task</span>
      </div>

      <div className="field">
        <label htmlFor="smart-title" className="field-label">
          Title
        </label>
        <input
          id="smart-title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
        />
      </div>
      <div className="smart-preview-row">
        <div className="field">
          <label htmlFor="smart-due" className="field-label">
            Due
          </label>
          <input
            id="smart-due"
            className="input"
            type="datetime-local"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="smart-priority" className="field-label">
            Priority
          </label>
          <select
            id="smart-priority"
            className="input"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      {suggestion.notes && <p className="smart-preview-notes">Notes: {suggestion.notes}</p>}

      <div className="smart-preview-actions">
        <button type="button" className="button" onClick={onDiscard}>
          Discard
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={handleConfirm}
          disabled={saving || !title.trim()}
        >
          Add task
        </button>
      </div>
    </section>
  )
}
