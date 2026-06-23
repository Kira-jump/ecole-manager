import { useState } from 'react'
import { ClipboardList, Eye, EyeOff, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/ui/Spinner'

export default function Login() {
  const { signIn, signInWithMatricule } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const value = identifier.trim()
      const isEmail = value.includes('@')
      if (isEmail) {
        await signIn(value, password)
      } else {
        await signInWithMatricule(value.toUpperCase(), password)
      }
    } catch (err) {
      const msg = err?.message ?? ''
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setError('Identifiants incorrects')
      } else if (msg.includes('Matricule')) {
        setError(msg)
      } else {
        setError('Connexion impossible. Vérifie tes identifiants.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gold-500 items-center justify-center mb-3">
            <ClipboardList className="text-brand-900" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">École Manager</h1>
          <p className="text-brand-200 text-sm mt-1">Connexion</p>
        </div>

        <div className="card p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email ou identifiant</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input pl-9"
                  placeholder="Mail ou identifiant"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-9"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner size="sm" className="border-white border-t-transparent" /> : 'Se connecter'}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-5">
            Pas de compte ? Contacte l'administration.
          </p>
        </div>
      </div>
    </div>
  )
}
