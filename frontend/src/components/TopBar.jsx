import { Link } from 'react-router'

import Brand from './Brand.jsx'
import UserMenu from './UserMenu.jsx'

// The bar across the top of every signed-in page (wireframes v2, screen 3).
export default function TopBar() {
  return (
    <header className="top-bar">
      <Link to="/" className="top-bar-home" aria-label="AI Todo, my tasks">
        <Brand />
      </Link>
      <div className="top-bar-end">
        <UserMenu />
      </div>
    </header>
  )
}
