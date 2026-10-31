import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api/client.js'
import { CloseIcon, RefreshIcon, SparkleIcon } from './icons.jsx'

// Asks the AI for subtask ideas and lets the user tick the ones to add (wireframe 3).
export default function BreakdownDialog({ todo, existingSubtasks = [], onAdd, onClose }) {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const headingRef = useRef(null)

  // Only updates state once the answer arrives, so it is safe to start from an effect.
  const requestSuggestions = useCallback(
    () =>
      api.breakdown(todo.id).then(
        ({ subtasks }) => {
          setSuggestions(subtasks)
          setSelected(new Set(subtasks))
          setStatus('ready')
        },
        (err) => {
          setError(err.message)
          setStatus('error')
        },
      ),
    [todo.id],
  )

  useEffect(() => {
    headingRef.current?.focus()
    requestSuggestions()
  }, [requestSuggestions])

  function suggestAgain() {
    setStatus('loading')
    setError(null)
    requestSuggestions()
  }

  function toggle(item) {
    const next = new Set(selected)
    if (next.has(item)) next.delete(item)
    else next.add(item)
    setSelected(next)
  }

  async function handleAdd() {
    setAdding(true)
    const ok = await onAdd(suggestions.filter((item) => selected.has(item)))
    setAdding(false)
    if (ok) onClose()
  }

  const count = selected.size

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakdown-title"
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        <div className="dialog-header">
          <div className="dialog-title-block">
            <span className="ai-tag">
              <SparkleIcon size={16} />
              AI suggestions
            </span>
            <h2 id="breakdown-title" ref={headingRef} tabIndex={-1}>
              Break down “{todo.title}”
            </h2>
            <p>Tick the steps you want. They’ll be added as subtasks.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        {status === 'loading' && (
          <p className="reading" role="status">
            <span className="spinner" aria-hidden="true" />
            Thinking of steps…
          </p>
        )}

        {status === 'error' && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        {status === 'ready' && suggestions.length === 0 && (
          <p className="dialog-note">No new ideas this time. Try “Suggest again”.</p>
        )}

        {status === 'ready' && suggestions.length > 0 && (
          <fieldset className="suggestions">
            <legend className="visually-hidden">Suggested subtasks</legend>
            {suggestions.map((item) => (
              <label key={item} className="suggestion">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={selected.has(item)}
                  onChange={() => toggle(item)}
                />
                {item}
              </label>
            ))}
          </fieldset>
        )}

        {existingSubtasks.length > 0 && (
          <p className="dialog-note">
            Already a subtask: {existingSubtasks.map((sub) => sub.title).join(', ')}. The AI skips
            these.
          </p>
        )}

        <div className="dialog-footer">
          <button
            type="button"
            className="button button--ai"
            onClick={suggestAgain}
            disabled={status === 'loading' || adding}
          >
            <RefreshIcon size={16} />
            Suggest again
          </button>
          <div className="dialog-actions">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={handleAdd}
              disabled={status !== 'ready' || count === 0 || adding}
            >
              Add {count} {count === 1 ? 'subtask' : 'subtasks'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
