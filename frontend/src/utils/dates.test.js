import { describe, expect, it } from 'vitest'

import { formatDue, fromLocalInputValue, isOverdue, toLocalInputValue } from './dates.js'

// Built from local-time parts so the tests pass in any timezone.
const now = new Date(2026, 9, 31, 9, 0) // Sat 31 Oct 2026, 09:00 local

describe('formatDue', () => {
  it('says "Today" with the time for later today', () => {
    const due = new Date(2026, 9, 31, 17, 0).toISOString()
    expect(formatDue(due, now)).toMatch(/^Today, 5:00\s?PM$/i)
  })

  it('says "Tomorrow" for the next day', () => {
    const due = new Date(2026, 10, 1, 18, 0).toISOString()
    expect(formatDue(due, now)).toMatch(/^Tomorrow, 6:00\s?PM$/i)
  })

  it('leaves the time out at midnight', () => {
    const due = new Date(2026, 10, 14).toISOString()
    expect(formatDue(due, now)).not.toContain(':')
  })
})

describe('isOverdue', () => {
  it('is true only for times before now', () => {
    expect(isOverdue(new Date(2026, 9, 30).toISOString(), now)).toBe(true)
    expect(isOverdue(new Date(2026, 10, 1).toISOString(), now)).toBe(false)
  })
})

describe('datetime-local conversion', () => {
  it('round-trips through the input format', () => {
    const iso = new Date(2026, 10, 1, 18, 30).toISOString()

    expect(toLocalInputValue(iso)).toBe('2026-11-01T18:30')
    expect(fromLocalInputValue('2026-11-01T18:30')).toBe(iso)
  })

  it('treats empty values as no due date', () => {
    expect(toLocalInputValue(null)).toBe('')
    expect(fromLocalInputValue('')).toBeNull()
  })
})
