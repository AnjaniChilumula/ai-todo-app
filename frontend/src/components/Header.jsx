const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export default function Header({ today = new Date(), children }) {
  return (
    <header className="header">
      <div>
        <h1>My Tasks</h1>
        <p className="header-date">{dateFormat.format(today)}</p>
      </div>
      {children}
    </header>
  )
}
