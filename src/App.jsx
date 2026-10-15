import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Classes from './pages/Classes'
import ClassDetail from './pages/ClassDetail'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import Subjects from './pages/Subjects'
import Grades from './pages/Grades'
import GradeSheet from './pages/GradeSheet'
import { ACCESS } from './lib/access'
import Attendance from './pages/Attendance'
import Announcements from './pages/Announcements'
import Settings from './pages/Settings'
import ChangePassword from './pages/ChangePassword'

function FullScreenLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-700 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Chargement…</p>
      </div>
    </div>
  )
}

export default function App() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) return <FullScreenLoader />

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-slate-900">Profil introuvable</h2>
          <p className="text-sm text-slate-600 mt-2">Contacte l'administrateur.</p>
        </div>
      </div>
    )
  }

  // Compte désactivé par l'administration : accès bloqué
  if (profile.active === false) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-slate-900">Compte désactivé</h2>
          <p className="text-sm text-slate-600 mt-2">Ton accès a été suspendu. Contacte l'administration de l'école.</p>
          <button onClick={signOut} className="btn-secondary mt-5">Se déconnecter</button>
        </div>
      </div>
    )
  }

  if (profile.must_change_password) {
    return (
      <Routes>
        <Route path="*" element={<ChangePassword forced />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route element={<ProtectedRoute allow={ACCESS.users} />}>
          <Route path="/users" element={<Users />} />
        </Route>

        <Route element={<ProtectedRoute allow={ACCESS.classes} />}>
          <Route path="/classes" element={<Classes />} />
          <Route path="/classes/:id" element={<ClassDetail />} />
        </Route>

        <Route element={<ProtectedRoute allow={ACCESS.gradeSheet} />}>
          <Route path="/grade-sheet" element={<GradeSheet />} />
        </Route>

        <Route element={<ProtectedRoute allow={ACCESS.subjects} />}>
          <Route path="/subjects" element={<Subjects />} />
        </Route>

        <Route element={<ProtectedRoute allow={ACCESS.students} />}>
          <Route path="/students" element={<Students />} />
        </Route>

        <Route element={<ProtectedRoute allow={ACCESS.teachers} />}>
          <Route path="/teachers" element={<Teachers />} />
        </Route>

        <Route element={<ProtectedRoute allow={ACCESS.grades} />}>
          <Route path="/grades" element={<Grades />} />
        </Route>

        <Route element={<ProtectedRoute allow={ACCESS.attendance} />}>
          <Route path="/attendance" element={<Attendance />} />
        </Route>

        <Route path="/announcements" element={<Announcements />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
