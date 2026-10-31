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

const MATCHES = {
  all: () => true,
  active: (todo) => !todo.completed,
  completed: (todo) => todo.completed,
}

/** Filters top-level tasks by status; subtasks always stay with their parent. */
export function filterTasks(topLevel, filter) {
  return topLevel.filter(MATCHES[filter])
}

/** How many top-level tasks each filter shows. */
export function countTasks(topLevel) {
  const completed = topLevel.filter(MATCHES.completed).length
  return { all: topLevel.length, active: topLevel.length - completed, completed }
}
