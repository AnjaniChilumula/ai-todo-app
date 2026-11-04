import { useId } from 'react'

// One card on the Settings page: a heading, a short explanation, then its controls.
export default function SettingsSection({ title, description, children }) {
  const id = useId()
  return (
    <section className="card settings-section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  )
}

// A one-line result under a form: polite for success, an alert for errors.
export function FormStatus({ status }) {
  if (!status) return null
  return status.kind === 'ok' ? (
    <p className="form-status form-status--ok" role="status">
      {status.text}
    </p>
  ) : (
    <p className="form-status form-status--error" role="alert">
      {status.text}
    </p>
  )
}
