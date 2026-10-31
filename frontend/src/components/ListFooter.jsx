export default function ListFooter({ remaining, completed, onClearCompleted }) {
  return (
    <footer className="list-footer">
      <span aria-live="polite">
        {remaining} {remaining === 1 ? 'task' : 'tasks'} left
      </span>
      {completed > 0 && (
        <button type="button" className="button" onClick={onClearCompleted}>
          Clear completed ({completed})
        </button>
      )}
    </footer>
  )
}
