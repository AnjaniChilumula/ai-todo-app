import { useState } from 'react'

import { api } from '../api/client.js'
import { PlusIcon, SparkleIcon } from './icons.jsx'
import SmartAddPreview from './SmartAddPreview.jsx'

// phase: 'idle' → (Smart Add) 'reading' → 'preview' | 'error'
export default function AddTodoForm({ onAdd, aiStatus = 'off' }) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [smartOn, setSmartOn] = useState(true)
  const [phase, setPhase] = useState('idle')
  const [suggestion, setSuggestion] = useState(null)
  const [aiError, setAiError] = useState(null)

  const aiReady = aiStatus === 'on'
  const useSmart = aiReady && smartOn

  function reset() {
    setPhase('idle')
    setSuggestion(null)
    setAiError(null)
  }

  async function save(data) {
    setSaving(true)
    const saved = await onAdd(data)
    setSaving(false)
    if (saved) {
      setTitle('')
      reset()
    }
  }

  async function readWithAI(text) {
    setPhase('reading')
    setAiError(null)
    try {
      setSuggestion(await api.parseTask(text))
      setPhase('preview')
    } catch (err) {
      setAiError(err.message)
      setPhase('error')
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || phase === 'reading') return
    if (useSmart) readWithAI(trimmed)
    else save({ title: trimmed })
  }

  return (
    <form className={`card add-form ${useSmart ? 'add-form--smart' : ''}`} onSubmit={handleSubmit}>
      <label htmlFor="new-task" className="field-label">
        New task
      </label>
      <div className="add-form-row">
        <input
          id="new-task"
          className="input"
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            if (phase !== 'reading') reset()
          }}
          placeholder={
            useSmart ? 'Try: call mom tomorrow 6pm, high priority' : 'What do you need to do?'
          }
          maxLength={500}
          autoComplete="off"
        />
        {aiReady ? (
          <button
            type="button"
            className="button button--ai"
            aria-pressed={smartOn}
            onClick={() => {
              setSmartOn(!smartOn)
              reset()
            }}
          >
            <SparkleIcon size={16} />
            Smart Add: {smartOn ? 'on' : 'off'}
          </button>
        ) : (
          <button type="button" className="button button--unavailable" disabled>
            <SparkleIcon size={16} />
            Smart Add unavailable
          </button>
        )}
        <button
          type="submit"
          className="button button--primary"
          disabled={saving || phase === 'reading' || !title.trim()}
        >
          <PlusIcon size={16} />
          Add
        </button>
      </div>

      {phase === 'reading' && (
        <p className="reading" role="status">
          <span className="spinner" aria-hidden="true" />
          Reading your task…
        </p>
      )}

      {phase === 'error' && (
        <div className="alert" role="alert">
          <span>{aiError} Your text is still in the box.</span>
          <span className="alert-actions">
            <button type="button" className="button button--warn" onClick={() => readWithAI(title.trim())}>
              Try again
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => save({ title: title.trim() })}
            >
              Add as typed
            </button>
          </span>
        </div>
      )}

      {phase === 'preview' && suggestion && (
        <SmartAddPreview
          suggestion={suggestion}
          saving={saving}
          onConfirm={save}
          onDiscard={reset}
        />
      )}
    </form>
  )
}
