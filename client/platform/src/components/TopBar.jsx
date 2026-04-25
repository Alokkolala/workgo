import { NavLink } from 'react-router-dom'

import { getTopBarLinks } from './topBar.helpers.js'

export default function TopBar({ context }) {
  return (
    <div className="topbar">
      <NavLink to="/" className="topbar-logo">
        WorkGo
      </NavLink>

      {context ? <span className="topbar-context">{context}</span> : null}

      <nav className="topbar-nav">
        {getTopBarLinks().map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <span className="flex-1" />

      <NavLink to="/onboarding" className="btn ghost sm">
        Регистрация
      </NavLink>
    </div>
  )
}
