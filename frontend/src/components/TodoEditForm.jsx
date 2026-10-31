import { useState } from 'react'

import { fromLocalInputValue, toLocalInputValue } from '../utils/dates.js'

export default function TodoEditForm({ todo, onSave, onCancel }) {
  const [title, setTitle] = useState(todo.title)
  const [due, setDue] = useState(toLocalInputValue(todo.due_at))
  const [priority, setPriority] = useState(todo.priority)
  const [saving, setSaving] = useState(false)
  const id = (field) => `edit-${todo.id}-${field}`

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)
    const saved = await onSave({ title: trimmed, due_at: fromLocalInputValue(due), priority })
    setSaving(false)
    if (saved) onCancel()
  }

  return (
    <form
      className="edit-form"
      onSubmit={handleSubmit}
      onKeyDown={(event) => event.key === 'Escape' && onCancel()}
      aria-label={`Edit "${todo.title}"`}
    >
      <div className="field">
        <label htmlFor={id('title')} className="field-label">
          Title
        </label>
        <input
          id={id('title')}
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          autoFocus
        />
      </div>
      <div className="edit-form-row">
        <div className="field">
          <label htmlFor={id('due')} className="field-label">
            Due
          </label>
          <input
            id={id('due')}
            className="input"
            type="datetime-local"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={id('priority')} className="field-label">
            Priority
          </label>
          <select
            id={id('priority')}
            className="input"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="edit-form-actions">
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={saving || !title.trim()}>
            Save
          </button>
        </div>
      </div>
    </form>
  )
}
