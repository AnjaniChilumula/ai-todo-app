import { useId, useState } from 'react'

import { EyeIcon } from '../icons.jsx'

export default function PasswordField({ label = 'Password', hint, autoComplete, value, onChange }) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="password-input">
        <input
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-describedby={hint ? hintId : undefined}
          required
          maxLength={128}
        />
        <button
          type="button"
          className="password-toggle"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible(!visible)}
        >
          <EyeIcon size={16} />
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  )
}
