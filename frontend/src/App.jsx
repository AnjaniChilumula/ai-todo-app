import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import AuthProvider from './auth/AuthProvider.jsx'
import { RequireAdmin, RequireAuth, SignedOutOnly } from './auth/guards.jsx'
import AppShell from './components/AppShell.jsx'
import { IS_DEMO } from './config.js'
import AdminPage from './pages/AdminPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import SignUpPage from './pages/SignUpPage.jsx'
import TasksPage from './pages/TasksPage.jsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<SignedOutOnly />}>
        <Route path="/login" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<TasksPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App({ demo = IS_DEMO }) {
  // BASE_URL is "/" locally and "/ai-todo-app/" on GitHub Pages.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider demo={demo}>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
