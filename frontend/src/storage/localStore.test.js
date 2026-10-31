import { beforeEach, describe, expect, it } from 'vitest'

import { createLocalStore } from './localStore.js'

function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

describe('createLocalStore', () => {
  let storage
  let store

  beforeEach(() => {
    storage = fakeStorage()
    store = createLocalStore(storage)
  })

  it('starts empty and creates tasks with defaults', async () => {
    expect(await store.list()).toEqual([])

    const todo = await store.create({ title: '  Buy groceries  ' })

    expect(todo).toMatchObject({
      id: 1,
      title: 'Buy groceries',
      priority: 'medium',
      completed: false,
      parent_id: null,
    })
    expect(await store.list()).toHaveLength(1)
  })

  it('keeps tasks across store instances (i.e. page reloads)', async () => {
    await store.create({ title: 'Survives reload' })

    const reloaded = createLocalStore(storage)

    expect((await reloaded.list())[0].title).toBe('Survives reload')
  })

  it('rejects an empty title', async () => {
    await expect(store.create({ title: '   ' })).rejects.toThrow('Title cannot be empty.')
  })

  it('follows the subtask rules of the API', async () => {
    const parent = await store.create({ title: 'Plan party' })
    const sub = await store.create({ title: 'Order cake', parent_id: parent.id })

    await expect(store.create({ title: 'x', parent_id: 99 })).rejects.toThrow('Parent task not found.')
    await expect(store.create({ title: 'x', parent_id: sub.id })).rejects.toThrow(
      'Subtasks cannot have subtasks.',
    )
  })

  it('updates only the given fields', async () => {
    const todo = await store.create({ title: 'Call mom', priority: 'high' })

    const updated = await store.update(todo.id, { completed: true })

    expect(updated).toMatchObject({ title: 'Call mom', priority: 'high', completed: true })
  })

  it('deletes a task with its subtasks', async () => {
    const parent = await store.create({ title: 'Plan party' })
    await store.create({ title: 'Order cake', parent_id: parent.id })
    await store.create({ title: 'Keep me' })

    await store.remove(parent.id)

    expect((await store.list()).map((t) => t.title)).toEqual(['Keep me'])
  })

  it('clears completed tasks and their subtasks', async () => {
    const done = await store.create({ title: 'Done' })
    await store.create({ title: 'Its subtask', parent_id: done.id })
    await store.create({ title: 'Active' })
    await store.update(done.id, { completed: true })

    expect(await store.clearCompleted()).toEqual({ deleted: 2 })
    expect((await store.list()).map((t) => t.title)).toEqual(['Active'])
  })

  it('treats corrupted saved data as an empty list', async () => {
    storage.setItem('ai-todo-app:todos:v1', '{not json')

    expect(await store.list()).toEqual([])
  })
})
