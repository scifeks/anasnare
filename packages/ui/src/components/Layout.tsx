import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/settings', label: 'Settings' },
];

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <nav className="w-56 shrink-0 border-r border-gray-800 bg-gray-900 p-4">
        <h1 className="mb-6 text-lg font-bold text-white">Anasnare</h1>
        <ul className="space-y-1">
          {links.map(l => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.to === '/'} className={({ isActive }) => `block rounded px-3 py-2 text-sm ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 overflow-auto p-6"><Outlet /></main>
    </div>
  );
}
