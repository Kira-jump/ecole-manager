import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, ClipboardList } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Spinner from '../components/ui/Spinner'

export default function ChangePassword({ forced = false }) {
  const { changePassword, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (pwd.length < 8) { setError('8 caractères minimum'); return }
    if (pwd !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true)
    try {
      await changePassword(pwd)
      toast.success('Mot de passe mis à jour')
      navigate('/dashboard')
    } catch (err) {
      setError(err?.message ?? 'Échec')
    } finally {
      setLoading(false)
    }
  }

  const formContent = (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Nouveau mot de passe</label>
        <input type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)} className="input" placeholder="8 caractères minimum" autoComplete="new-password" />
      </div>
      <div>
        <label className="label">Confirmer</label>
        <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" autoComplete="new-password" />
      </div>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? <Spinner size="sm" className="border-white border-t-transparent" /> : 'Enregistrer'}
      </button>
      {forced && <button type="button" onClick={signOut} className="btn-ghost w-full text-sm">Se déconnecter</button>}
    </form>
  )

  if (forced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gold-500 items-center justify-center mb-3">
              <ClipboardList className="text-brand-900" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">Premier accès</h1>
            <p className="text-brand-200 text-sm mt-1">Choisis un nouveau mot de passe avant de continuer</p>
          </div>
          <div className="card p-6">{formContent}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center">
            <KeyRound className="text-brand-700" size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Changer le mot de passe</h2>
            <p className="text-sm text-slate-500">Choisis un nouveau mot de passe sécurisé</p>
          </div>
        </div>
        {formContent}
      </div>
    </div>
  )
}
