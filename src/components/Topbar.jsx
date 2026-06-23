import { useState, useRef, useEffect } from 'react'
import { Menu, ChevronDown, LogOut, User, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { roleLabel, roleColor } from '../lib/roles'

export default function Topbar({ onMenuClick }) {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = profile
    ? (profile.first_name?.[0] ?? '') + (profile.last_name?.[0] ?? '')
    : '?'

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 sticky top-0 z-20">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
      >
        <Menu size={22} />
      </button>

      <div className="flex-1" />

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-100"
        >
          <div className="w-9 h-9 rounded-full bg-brand-700 text-white flex items-center justify-center text-sm font-semibold">
            {initials.toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-slate-900 leading-tight">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-slate-500 leading-tight">{roleLabel(profile?.role)}</p>
          </div>
          <ChevronDown size={16} className="text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="font-medium text-slate-900 text-sm">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{profile?.email}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-semibold ${roleColor(profile?.role)}`}>
                {roleLabel(profile?.role)}
              </span>
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/settings') }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <User size={16} /> Mon profil
            </button>
            <button
              onClick={() => { setOpen(false); navigate('/change-password') }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <KeyRound size={16} /> Changer le mot de passe
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={async () => { setOpen(false); await signOut() }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
