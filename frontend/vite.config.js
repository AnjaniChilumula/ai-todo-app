import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  // The demo is served by GitHub Pages from /ai-todo-app/, so its asset URLs need that prefix.
  base: mode === 'demo' ? '/ai-todo-app/' : '/',
  plugins: [react()],
  server: {
    // Forward API calls to FastAPI so the browser sees a single origin.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    restoreMocks: true,
  },
}))
