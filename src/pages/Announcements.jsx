import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Megaphone, Pin, Trash2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { isStaff, ROLES, ROLE_LIST, roleLabel } from '../lib/roles'
import { getAnnouncements, addAnnouncement, deleteAnnouncement, togglePinned } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

export default function Announcements() {
  const toast = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const canManage = isStaff(profile?.role)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', pinned: false, audience: ['eleve', 'professeur'] })

  const announcements = useQuery({ queryKey: ['announcements-list'], queryFn: getAnnouncements })

  const toggleAudience = (role) => {
    setForm(f => ({
      ...f,
      audience: f.audience.includes(role) ? f.audience.filter(r => r !== role) : [...f.audience, role],
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      await addAnnouncement({ title: form.title, content: form.content, author_id: profile.id, author_name: `${profile.first_name} ${profile.last_name}`, audience: form.audience, pinned: form.pinned })
      toast.success('Annonce publiée')
      setOpen(false)
      setForm({ title: '', content: '', pinned: false, audience: ['eleve', 'professeur'] })
      qc.invalidateQueries({ queryKey: ['announcements-list'] })
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  const remove = async (id) => {
    if (!confirm('Supprimer cette annonce ?')) return
    try {
      await deleteAnnouncement(id)
      toast.success('Supprimée')
      qc.invalidateQueries({ queryKey: ['announcements-list'] })
    } catch (err) { toast.error(err.message) }
  }

  const pin = async (a) => {
    try {
      await togglePinned(a.id, !a.pinned)
      qc.invalidateQueries({ queryKey: ['announcements-list'] })
    } catch (err) { toast.error(err.message) }
  }

  const sorted = [...(announcements.data ?? [])].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0)
  })

  return (
    <div>
      <PageHeader title="Annonces" description="Communications officielles de l'école"
        actions={canManage && <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> Nouvelle annonce</button>}
      />

      {announcements.isLoading ? (
        <div className="card p-12 flex justify-center"><Spinner /></div>
      ) : sorted.length === 0 ? (
        <div className="card"><EmptyState icon={Megaphone} title="Aucune annonce" /></div>
      ) : (
        <div className="space-y-3">
          {sorted.map(a => (
            <article key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
                    <Megaphone className="text-brand-700" size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{a.title}</h3>
                      {a.pinned && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">ÉPINGLÉE</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {a.author_name} • {a.created_at?.toDate ? a.created_at.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => pin(a)} className={`p-1.5 rounded hover:bg-slate-100 ${a.pinned ? 'text-amber-600' : 'text-slate-400'}`}><Pin size={14} /></button>
                    <button onClick={() => remove(a.id)} className="p-1.5 rounded text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.content}</p>
              {a.audience?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
                  {a.audience.map(r => <span key={r} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{roleLabel(r)}</span>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle annonce" size="lg"
        footer={<><button onClick={() => setOpen(false)} className="btn-secondary">Annuler</button><button form="ann-form" type="submit" className="btn-primary">Publier</button></>}
      >
        <form id="ann-form" onSubmit={submit} className="space-y-4">
          <div><label className="label">Titre *</label>
            <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Contenu *</label>
            <textarea className="input" rows="5" required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>
          <div><label className="label">Destinataires</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_LIST.map(r => (
                <button key={r} type="button" onClick={() => toggleAudience(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.audience.includes(r) ? 'bg-brand-700 text-white border-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {ROLES[r].label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} className="rounded" />
            Épingler cette annonce
          </label>
        </form>
      </Modal>
    </div>
  )
}
