import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Filter, Pencil } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { isPedagogy } from '../lib/roles'
import { getStudents, getClasses, updateStudent } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

export default function Students() {
  const toast = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const canEdit = isPedagogy(profile?.role)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  const classes = useQuery({ queryKey: ['classes-list'], queryFn: getClasses })
  const students = useQuery({
    queryKey: ['students', classFilter],
    queryFn: () => getStudents(classFilter),
  })

  const filtered = (students.data ?? []).filter(s => {
    if (!search) return true
    const t = search.toLowerCase()
    return s.matricule?.toLowerCase().includes(t) ||
      s.first_name?.toLowerCase().includes(t) ||
      s.last_name?.toLowerCase().includes(t)
  })

  const openEdit = (s) => {
    setEditing(s)
    setForm({ class_id: s.class_id ?? '', parent_name: s.parent_name ?? '', parent_phone: s.parent_phone ?? '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      await updateStudent(editing.id, {
        class_id: form.class_id || null,
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
      })
      toast.success('Élève mis à jour')
      qc.invalidateQueries({ queryKey: ['students'] })
      setEditing(null)
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  const getClassName = (id) => classes.data?.find(c => c.id === id)?.name

  return (
    <div>
      <PageHeader title="Élèves" description="Liste de tous les élèves inscrits" />

      <div className="card">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input className="input pl-9" placeholder="Rechercher par nom ou matricule…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative sm:w-64">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select className="input pl-9" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="">Toutes les classes</option>
              {classes.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {students.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Aucun élève" description="Crée des comptes élève depuis Comptes & accès." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Matricule</th>
                  <th className="table-th">Nom complet</th>
                  <th className="table-th">Classe</th>
                  <th className="table-th">Parent</th>
                  {canEdit && <th className="table-th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="table-td"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{s.matricule}</code></td>
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
                          {(s.first_name?.[0] ?? '') + (s.last_name?.[0] ?? '')}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td">{getClassName(s.class_id) ?? <span className="text-slate-400">—</span>}</td>
                    <td className="table-td">
                      {s.parent_name ? (
                        <div>
                          <p className="text-sm">{s.parent_name}</p>
                          <p className="text-xs text-slate-500">{s.parent_phone}</p>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    {canEdit && (
                      <td className="table-td text-right">
                        <button onClick={() => openEdit(s)} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'élève"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-secondary">Annuler</button>
            <button form="edit-student" type="submit" className="btn-primary">Enregistrer</button>
          </>
        }
      >
        {editing && (
          <form id="edit-student" onSubmit={submit} className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Élève</p>
              <p className="font-medium">{editing.first_name} {editing.last_name}</p>
              <p className="text-xs text-slate-400">{editing.matricule}</p>
            </div>
            <div><label className="label">Classe</label>
              <select className="input" value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}>
                <option value="">— Aucune —</option>
                {classes.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Nom du parent</label>
                <input className="input" value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} /></div>
              <div><label className="label">Téléphone</label>
                <input className="input" value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })} /></div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
