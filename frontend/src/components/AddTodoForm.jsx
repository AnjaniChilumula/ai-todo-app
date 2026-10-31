import { useState } from 'react'

import { PlusIcon } from './icons.jsx'

export default function AddTodoForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)
    const saved = await onAdd({ title: trimmed })
    setSaving(false)
    if (saved) setTitle('')
  }

  return (
    <form className="card add-form" onSubmit={handleSubmit}>
      <label htmlFor="new-task" className="field-label">
        New task
      </label>
      <div className="add-form-row">
        <input
          id="new-task"
          className="input"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What do you need to do?"
          maxLength={200}
          autoComplete="off"
        />
        <button type="submit" className="button button--primary" disabled={saving || !title.trim()}>
          <PlusIcon size={16} />
          Add
        </button>
      </div>
    </form>
  )
}
