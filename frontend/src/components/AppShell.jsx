import { Outlet } from 'react-router'

import TopBar from './TopBar.jsx'

// Layout for signed-in pages: the top bar, then whichever page the URL points to.
export default function AppShell() {
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  )
}
