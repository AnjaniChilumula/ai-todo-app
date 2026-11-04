// Due dates travel as ISO strings in UTC ("2026-11-01T12:30:00Z") and are shown in local time.

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

/** "Today, 5:00 PM", "Tomorrow, 6:00 PM" or "Sat, 14 Nov, 10:00 AM" (time left out at midnight). */
export function formatDue(iso, now = new Date()) {
  const date = new Date(iso)
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  let day
  if (sameDay(date, now)) day = 'Today'
  else if (sameDay(date, tomorrow)) day = 'Tomorrow'
  else day = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  return hasTime ? `${day}, ${time}` : day
}

/** "Active now", "5 minutes ago", "2 days ago": for when sessions and accounts were last used. */
export function formatRelative(iso, now = new Date()) {
  const seconds = Math.round((now - new Date(iso)) / 1000)
  if (seconds < 120) return 'just now'
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const steps = [
    ['minute', 60],
    ['hour', 60 * 60],
    ['day', 60 * 60 * 24],
    ['month', 60 * 60 * 24 * 30],
    ['year', 60 * 60 * 24 * 365],
  ]
  let [unit, size] = steps[0]
  for (const step of steps) if (seconds >= step[1]) [unit, size] = step
  return rtf.format(-Math.floor(seconds / size), unit)
}

export function isOverdue(iso, now = new Date()) {
  return new Date(iso) < now
}

/** ISO string → value for <input type="datetime-local"> ("2026-11-01T18:00", local time). */
export function toLocalInputValue(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Value from <input type="datetime-local"> → ISO string in UTC, or null when empty. */
export function fromLocalInputValue(value) {
  return value ? new Date(value).toISOString() : null
}
