import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { updateProfile } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import { roleLabel, roleColor } from '../lib/roles'

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? '')
      setLastName(profile.last_name ?? '')
      setPhone(profile.phone ?? '')
    }
  }, [profile])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(profile.id, { first_name: firstName, last_name: lastName, phone })
      await refreshProfile()
      toast.success('Profil mis à jour')
    } catch (err) { toast.error(err?.message ?? 'Échec') }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Mon profil" description="Mes informations personnelles" />
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-full bg-brand-700 text-white flex items-center justify-center text-xl font-semibold">
            {(profile?.first_name?.[0] ?? '') + (profile?.last_name?.[0] ?? '')}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{profile?.first_name} {profile?.last_name}</p>
            <p className="text-sm text-slate-500">{profile?.email}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold ${roleColor(profile?.role)}`}>{roleLabel(profile?.role)}</span>
          </div>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Prénom</label><input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
            <div><label className="label">Nom</label><input className="input" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
          </div>
          <div><label className="label">Téléphone</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input bg-slate-50" value={profile?.email ?? ''} disabled /><p className="text-xs text-slate-400 mt-1">L'email ne peut pas être modifié.</p></div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner size="sm" className="border-white border-t-transparent" /> : <Save size={16} />} Enregistrer
          </button>
        </form>
      </div>
    </div>
  )
}
