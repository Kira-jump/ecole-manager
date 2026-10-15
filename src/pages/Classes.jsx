import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, School } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { isTeacher } from '../lib/roles'
import { getClasses, getClassesForTeacher, createClass, updateClass, deleteClass, getActiveYear, getTeacherByProfileId } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

import { LEVELS, SECTIONS } from '../lib/levels'

export default function Classes() {
  const toast = useToast()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', level: 'college', section: '', capacity: 50 })

  const myTeacher = useQuery({
    queryKey: ['my-teacher-cls', profile?.id],
    enabled: isTeacher(profile?.role),
    queryFn: () => getTeacherByProfileId(profile.id),
  })

  const classes = useQuery({
    queryKey: ['classes', profile?.role, myTeacher.data?.id],
    enabled: !isTeacher(profile?.role) || !!myTeacher.data?.id,
    queryFn: () => isTeacher(profile?.role)
      ? getClassesForTeacher(myTeacher.data.id)
      : getClasses(),
  })

  const counts = useQuery({
    queryKey: ['student-counts'],
    queryFn: async () => {
      const { getDocs, collection, query } = await import('firebase/firestore')
      const { db } = await import('../lib/firebase')
      const snap = await getDocs(collection(db, 'students'))
      const map = {}
      snap.docs.forEach(d => {
        const cid = d.data().class_id
        if (cid) map[cid] = (map[cid] ?? 0) + 1
      })
      return map
    },
  })

  const openCreate = () => { setEditing(null); setForm({ name: '', level: 'college', section: '', capacity: 50 }); setOpen(true) }
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, level: c.level, section: c.section ?? '', capacity: c.capacity ?? 50 }); setOpen(true) }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const year = await getActiveYear()
      if (editing) {
        await updateClass(editing.id, { name: form.name, level: form.level, section: form.level === 'maternelle' ? form.section : null, capacity: Number(form.capacity) || 50 })
        toast.success('Classe mise à jour')
      } else {
        await createClass({ name: form.name, level: form.level, section: form.level === 'maternelle' ? form.section : null, capacity: Number(form.capacity) || 50, school_year_id: year?.id ?? null, school_year_label: year?.label ?? '' })
        toast.success('Classe créée')
      }
      qc.invalidateQueries({ queryKey: ['classes'] })
      setOpen(false)
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  const remove = async (c) => {
    if (!confirm(`Supprimer "${c.name}" ?`)) return
    try {
      await deleteClass(c.id)
      toast.success('Classe supprimée')
      qc.invalidateQueries({ queryKey: ['classes'] })
    } catch (err) { toast.error(err.message) }
  }

  const grouped = (classes.data ?? []).reduce((acc, c) => {
    (acc[c.level] = acc[c.level] || []).push(c)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Organisation des classes par niveau"
        actions={!isTeacher(profile?.role) && <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nouvelle classe</button>}
      />

      {classes.isLoading ? (
        <div className="card p-12 flex justify-center"><Spinner /></div>
      ) : classes.data?.length === 0 ? (
        <div className="card">
          <EmptyState icon={School}
            title={isTeacher(profile?.role) ? 'Aucune classe assignée' : 'Aucune classe'}
            description={isTeacher(profile?.role) ? "Demande à l'administration de t'affecter à une classe." : 'Crée tes premières classes.'}
            action={!isTeacher(profile?.role) && <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nouvelle classe</button>} />
        </div>
      ) : (
        <div className="space-y-6">
          {LEVELS.map(lvl => {
            const list = grouped[lvl.value] ?? []
            if (!list.length) return null
            return (
              <div key={lvl.value}>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{lvl.label}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map(c => (
                    <div key={c.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/classes/${c.id}`)}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
                            <School size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{c.name}</p>
                            <p className="text-xs text-slate-500">{c.school_year_label}</p>
                          </div>
                        </div>
                        {!isTeacher(profile?.role) && (
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); openEdit(c) }} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); remove(c) }} className="btn-ghost p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Effectif</span>
                        <span className="font-medium text-slate-900">{counts.data?.[c.id] ?? 0} / {c.capacity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Modifier la classe' : 'Nouvelle classe'}
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
            <button form="class-form" type="submit" className="btn-primary">{editing ? 'Mettre à jour' : 'Créer'}</button>
          </>
        }
      >
        <form id="class-form" onSubmit={submit} className="space-y-4">
          <div><label className="label">Nom de la classe *</label>
            <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex : Petite section A, CE2 B, 6ème A" /></div>
          <div><label className="label">Niveau *</label>
            <select className="input" value={form.level}
              onChange={e => setForm({ ...form, level: e.target.value, section: e.target.value === 'maternelle' ? form.section : '' })}>
              {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select></div>
          {form.level === 'maternelle' && (
            <div><label className="label">Section *</label>
              <select className="input" required value={form.section}
                onChange={e => {
                  const label = SECTIONS.find(s => s.value === e.target.value)?.label ?? ''
                  // Pré-remplit le nom (ex : "Petite section") sans écraser un nom déjà personnalisé
                  const autoName = !form.name || SECTIONS.some(s => s.label === form.name)
                  setForm({ ...form, section: e.target.value, name: autoName ? label : form.name })
                }}>
                <option value="">— Choisir —</option>
                {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
          )}
          <div><label className="label">Capacité maximale</label>
            <input type="number" min="1" className="input" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} /></div>
        </form>
      </Modal>
    </div>
  )
}
