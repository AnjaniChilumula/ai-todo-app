// Build-time settings. Vite replaces import.meta.env.VITE_* when the app is built.
//
//   VITE_STORAGE=local  → demo mode: tasks saved in the browser, no backend, AI off
//                         (used for the GitHub Pages build)
//   anything else       → normal mode: tasks saved by the FastAPI backend
export const IS_DEMO = import.meta.env.VITE_STORAGE === 'local'
