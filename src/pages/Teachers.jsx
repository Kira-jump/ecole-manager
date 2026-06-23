import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Users, Plus, X } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { isPedagogy } from '../lib/roles'
import { getTeachers, getSubjects, getClasses, getAssignments, addAssignment, deleteAssignment } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

export default function Teachers() {
  const toast = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const canManage = isPedagogy(profile?.role)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [assignForm, setAssignForm] = useState({ subject_id: '', class_id: '' })

  const teachers = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const subjects = useQuery({ queryKey: ['subjects-list'], queryFn: getSubjects })
  const classes = useQuery({ queryKey: ['classes-list'], queryFn: getClasses })
  const assignments = useQuery({
    queryKey: ['assignments', selected?.id],
    enabled: !!selected,
    queryFn: () => getAssignments(selected.id),
  })

  const filtered = (teachers.data ?? []).filter(t => {
    if (!search) return true
    const s = search.toLowerCase()
    return t.matricule?.toLowerCase().includes(s) ||
      t.first_name?.toLowerCase().includes(s) ||
      t.last_name?.toLowerCase().includes(s)
  })

  const addAss = async (e) => {
    e.preventDefault()
    if (!assignForm.subject_id || !assignForm.class_id) return
    try {
      await addAssignment({ teacher_id: selected.id, subject_id: assignForm.subject_id, class_id: assignForm.class_id })
      toast.success('Affectation ajoutée')
      setAssignForm({ subject_id: '', class_id: '' })
      qc.invalidateQueries({ queryKey: ['assignments', selected.id] })
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  const removeAss = async (id) => {
    try {
      await deleteAssignment(id)
      toast.success('Retirée')
      qc.invalidateQueries({ queryKey: ['assignments', selected.id] })
    } catch (err) { toast.error(err.message) }
  }

  const getSubjectName = (id) => subjects.data?.find(s => s.id === id)?.name ?? id
  const getClassName = (id) => classes.data?.find(c => c.id === id)?.name ?? id

  return (
    <div>
      <PageHeader title="Enseignants" description="Corps enseignant et affectations" />

      <div className="card">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {teachers.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="Aucun enseignant" description="Crée des comptes enseignant depuis Comptes & accès." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Matricule</th>
                  <th className="table-th">Nom</th>
                  <th className="table-th">Spécialisation</th>
                  <th className="table-th">Contact</th>
                  {canManage && <th className="table-th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="table-td"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{t.matricule}</code></td>
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-semibold">
                          {(t.first_name?.[0] ?? '') + (t.last_name?.[0] ?? '')}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{t.first_name} {t.last_name}</p>
                          <p className="text-xs text-slate-500">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td">{t.specialization ?? <span className="text-slate-400">—</span>}</td>
                    <td className="table-td text-sm">{t.phone ?? '—'}</td>
                    {canManage && (
                      <td className="table-td text-right">
                        <button onClick={() => setSelected(t)} className="btn-secondary text-xs">Affectations</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)}
        title={`Affectations — ${selected?.first_name} ${selected?.last_name}`} size="lg">
        {selected && (
          <div className="space-y-5">
            <form onSubmit={addAss} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div><label className="label">Matière</label>
                <select className="input" value={assignForm.subject_id} onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })} required>
                  <option value="">— Choisir —</option>
                  {subjects.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div><label className="label">Classe</label>
                <select className="input" value={assignForm.class_id} onChange={e => setAssignForm({ ...assignForm, class_id: e.target.value })} required>
                  <option value="">— Choisir —</option>
                  {classes.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <button type="submit" className="btn-primary"><Plus size={16} /> Ajouter</button>
            </form>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Affectations actuelles</h4>
              {assignments.isLoading ? <Spinner size="sm" /> :
                assignments.data?.length === 0 ? <p className="text-sm text-slate-500 italic">Aucune affectation.</p> :
                  <div className="space-y-2">
                    {assignments.data.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded border border-slate-100">
                        <span className="text-sm">
                          <span className="font-medium">{getSubjectName(a.subject_id)}</span>
                          <span className="text-slate-400 mx-2">→</span>
                          <span>{getClassName(a.class_id)}</span>
                        </span>
                        <button onClick={() => removeAss(a.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
