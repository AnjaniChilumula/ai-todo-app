import { ChecklistIcon } from './icons.jsx'

export default function EmptyState() {
  return (
    <section className="card empty-state" aria-labelledby="empty-title">
      <ChecklistIcon size={56} strokeWidth={1.5} />
      <h2 id="empty-title">No tasks yet</h2>
      <p>Add your first task above.</p>
    </section>
  )
}
