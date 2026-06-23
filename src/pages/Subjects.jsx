import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, BookMarked } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { getSubjects, createSubject, updateSubject, deleteSubject } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

export default function Subjects() {
  const toast = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', code: '', default_coefficient: 1 })

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: getSubjects })

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', default_coefficient: 1 }); setOpen(true) }
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, code: s.code ?? '', default_coefficient: s.default_coefficient ?? 1 }); setOpen(true) }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const payload = { name: form.name, code: form.code || null, default_coefficient: Number(form.default_coefficient) || 1 }
      if (editing) {
        await updateSubject(editing.id, payload)
        toast.success('Matière mise à jour')
      } else {
        await createSubject(payload)
        toast.success('Matière créée')
      }
      qc.invalidateQueries({ queryKey: ['subjects'] })
      setOpen(false)
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  const remove = async (s) => {
    if (!confirm(`Supprimer "${s.name}" ?`)) return
    try {
      await deleteSubject(s.id)
      toast.success('Supprimée')
      qc.invalidateQueries({ queryKey: ['subjects'] })
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div>
      <PageHeader
        title="Matières"
        description="Catalogue des matières enseignées"
        actions={<button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nouvelle matière</button>}
      />

      <div className="card overflow-hidden">
        {subjects.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : subjects.data?.length === 0 ? (
          <EmptyState icon={BookMarked} title="Aucune matière" description="Ajoute les matières enseignées." />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Nom</th>
                <th className="table-th">Code</th>
                <th className="table-th">Coefficient par défaut</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.data.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <BookMarked size={16} className="text-brand-700" />
                      <span className="font-medium text-slate-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="table-td"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{s.code ?? '—'}</code></td>
                  <td className="table-td">{s.default_coefficient}</td>
                  <td className="table-td text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(s)} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                      <button onClick={() => remove(s)} className="btn-ghost p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Modifier la matière' : 'Nouvelle matière'}
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
            <button form="subject-form" type="submit" className="btn-primary">{editing ? 'Mettre à jour' : 'Créer'}</button>
          </>
        }
      >
        <form id="subject-form" onSubmit={submit} className="space-y-4">
          <div><label className="label">Nom *</label>
            <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Code</label>
            <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex : MATH, FR" /></div>
          <div><label className="label">Coefficient par défaut</label>
            <input type="number" step="0.5" min="0.5" className="input" value={form.default_coefficient} onChange={e => setForm({ ...form, default_coefficient: e.target.value })} /></div>
        </form>
      </Modal>
    </div>
  )
}
