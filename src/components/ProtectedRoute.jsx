import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Garde-fou de route basé sur le rôle.
 * - allow:    liste de rôles autorisés (whitelist)
 * - denyOnly: liste de rôles refusés (blacklist)
 *
 * La sécurité réelle reste dans la RLS Supabase ; ce composant
 * sert uniquement à éviter d'afficher des écrans inutiles.
 */
export default function ProtectedRoute({ allow, denyOnly }) {
  const { profile } = useAuth()
  if (!profile) return <Navigate to="/login" replace />

  if (allow && !allow.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }
  if (denyOnly && denyOnly.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
