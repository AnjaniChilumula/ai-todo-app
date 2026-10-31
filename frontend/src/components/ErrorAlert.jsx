export default function ErrorAlert({ message, onDismiss }) {
  return (
    <div className="alert" role="alert">
      <span>{message}</span>
      <button type="button" className="button button--warn" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
