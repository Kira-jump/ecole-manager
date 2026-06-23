import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, UserCog, BookOpen,
  ClipboardList, CalendarCheck, Megaphone, Settings as SettingsIcon,
  School, X, BookMarked,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin, isPedagogy, isStudent } from '../lib/roles'

function buildNav(role) {
  const items = [
    { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  ]
  if (isAdmin(role)) {
    items.push({ to: '/users', label: 'Comptes & accès', icon: UserCog })
  }
  if (isPedagogy(role)) {
    items.push({ to: '/classes', label: 'Classes', icon: School })
    items.push({ to: '/subjects', label: 'Matières', icon: BookMarked })
  }
  if (!isStudent(role)) {
    items.push({ to: '/students', label: 'Élèves', icon: GraduationCap })
    items.push({ to: '/teachers', label: 'Enseignants', icon: Users })
  }
  items.push({ to: '/grades', label: 'Notes', icon: BookOpen })
  items.push({ to: '/attendance', label: 'Présences', icon: CalendarCheck })
  items.push({ to: '/announcements', label: 'Annonces', icon: Megaphone })
  items.push({ to: '/settings', label: 'Paramètres', icon: SettingsIcon })
  return items
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { profile } = useAuth()
  const items = buildNav(profile?.role)

  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-brand-900 text-white flex flex-col transform transition-transform md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-brand-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gold-500 flex items-center justify-center">
              <ClipboardList className="text-brand-900" size={20} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">École Manager</p>
              <p className="text-[10px] text-brand-200 uppercase tracking-wider">v0.1</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-brand-200 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-700 text-white'
                      : 'text-brand-100 hover:bg-brand-800 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-brand-800 text-xs text-brand-300">
          © {new Date().getFullYear()} École Manager
        </div>
      </aside>
    </>
  )
}
