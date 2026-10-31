const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export default function FilterTabs({ filter, counts, onChange }) {
  return (
    <div className="filter-tabs" role="group" aria-label="Filter tasks">
      {FILTERS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className="filter-tab"
          aria-pressed={filter === value}
          onClick={() => onChange(value)}
        >
          {label} · {counts[value]}
        </button>
      ))}
    </div>
  )
}
