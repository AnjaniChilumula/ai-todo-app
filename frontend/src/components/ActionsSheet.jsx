import { useEffect, useRef } from 'react'

// Bottom sheet with a task's actions, used on phones instead of a row of icon buttons
// (wireframe 5). `actions` is a list of { label, icon, onSelect, ai }.
export default function ActionsSheet({ title, actions, onClose }) {
  const firstButtonRef = useRef(null)

  useEffect(() => {
    firstButtonRef.current?.focus()
  }, [])

  return (
    <div
      className="modal-overlay modal-overlay--sheet"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for "${title}"`}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        <p className="sheet-title">More actions · {title}</p>
        {actions.map(({ label, icon, onSelect, ai }, index) => (
          <button
            key={label}
            ref={index === 0 ? firstButtonRef : undefined}
            type="button"
            className={`sheet-item ${ai ? 'sheet-item--ai' : ''}`}
            onClick={() => {
              onClose()
              onSelect()
            }}
          >
            {icon}
            {label}
          </button>
        ))}
        <button type="button" className="sheet-item" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
