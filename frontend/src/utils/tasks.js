/** Splits a flat list into top-level tasks and a Map of parent id → its subtasks. */
export function groupTasks(todos) {
  const topLevel = []
  const subtasksByParent = new Map()
  for (const todo of todos) {
    if (todo.parent_id == null) {
      topLevel.push(todo)
    } else {
      subtasksByParent.set(todo.parent_id, [...(subtasksByParent.get(todo.parent_id) ?? []), todo])
    }
  }
  return { topLevel, subtasksByParent }
}
