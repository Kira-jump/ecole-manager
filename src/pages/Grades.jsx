import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, BookOpen, Trash2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { isStudent, isTeacher, isPedagogy } from '../lib/roles'
import { getGrades, addGrade, deleteGrade, getSubjects, getClasses, getStudents, getTeacherByProfileId, getAssignments } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

const TERMS = [
  { value: 'trimestre_1', label: 'Trimestre 1' },
  { value: 'trimestre_2', label: 'Trimestre 2' },
  { value: 'trimestre_3', label: 'Trimestre 3' },
]

const EVAL_TYPES = [
  { value: 'devoir', label: 'Devoir' },
  { value: 'composition', label: 'Composition' },
  { value: 'interrogation', label: 'Interrogation' },
  { value: 'tp', label: 'TP' },
]

function GradeBadge({ value }) {
  const v = Number(value)
  const color = v >= 14 ? 'bg-emerald-100 text-emerald-700'
    : v >= 10 ? 'bg-blue-100 text-blue-700'
    : v >= 8 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'
  return <span className={`font-mono font-semibold px-2 py-0.5 rounded ${color}`}>{v.toFixed(2)}/20</span>
}

export default function Grades() {
  const toast = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const role = profile?.role
  const [classFilter, setClassFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    student_id: '', subject_id: '', value: '', coefficient: 1,
    evaluation: 'devoir', term: 'trimestre_1',
    date: new Date().toISOString().slice(0, 10), comment: '',
  })

  // Teacher's own data
  const myTeacher = useQuery({
    queryKey: ['my-teacher', profile?.id],
    enabled: isTeacher(role),
    queryFn: () => getTeacherByProfileId(profile.id),
  })

  const myAssignments = useQuery({
    queryKey: ['my-assignments', myTeacher.data?.id],
    enabled: !!myTeacher.data?.id,
    queryFn: () => getAssignments(myTeacher.data.id),
  })

  const subjects = useQuery({ queryKey: ['subjects-list'], queryFn: getSubjects })
  const classes = useQuery({ queryKey: ['classes-list'], queryFn: getClasses })

  const availableSubjects = useMemo(() => {
    if (isTeacher(role) && myAssignments.data) {
      const ids = new Set(myAssignments.data.map(a => a.subject_id))
      return (subjects.data ?? []).filter(s => ids.has(s.id))
    }
    return subjects.data ?? []
  }, [role, subjects.data, myAssignments.data])

  const studentsForForm = useQuery({
    queryKey: ['students-for-grade', form.subject_id, myTeacher.data?.id],
    enabled: open && !!form.subject_id,
    queryFn: async () => {
      if (isTeacher(role) && myAssignments.data) {
        const classIds = myAssignments.data
          .filter(a => a.subject_id === form.subject_id)
          .map(a => a.class_id)
        if (!classIds.length) return []
        const all = await getStudents()
        return all.filter(s => classIds.includes(s.class_id))
      }
      return getStudents(form.subject_id ? classFilter : '')
    },
  })

  const grades = useQuery({
    queryKey: ['grades', classFilter, subjectFilter, termFilter, role],
    queryFn: () => getGrades({
      classFilter,
      subjectFilter,
      termFilter,
      teacherId: isTeacher(role) ? myTeacher.data?.id : undefined,
      studentId: isStudent(role) ? profile?.id : undefined,
    }),
  })

  const getSubjectName = (id) => subjects.data?.find(s => s.id === id)?.name ?? '—'
  const getClassName = (id) => classes.data?.find(c => c.id === id)?.name ?? '—'

  const submit = async (e) => {
    e.preventDefault()
    try {
      const student = studentsForForm.data?.find(s => s.id === form.student_id)
      await addGrade({
        student_id: form.student_id,
        subject_id: form.subject_id,
        teacher_id: myTeacher.data?.id ?? null,
        class_id: student?.class_id ?? null,
        value: Number(form.value),
        coefficient: Number(form.coefficient) || 1,
        evaluation: form.evaluation,
        term: form.term,
        date: form.date,
        comment: form.comment || null,
      })
      toast.success('Note enregistrée')
      setOpen(false)
      setForm({ ...form, student_id: '', value: '', comment: '' })
      qc.invalidateQueries({ queryKey: ['grades'] })
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  const remove = async (id) => {
    if (!confirm('Supprimer cette note ?')) return
    try {
      await deleteGrade(id)
      toast.success('Supprimée')
      qc.invalidateQueries({ queryKey: ['grades'] })
    } catch (err) { toast.error(err.message) }
  }

  const canAdd = isTeacher(role) || isPedagogy(role)

  return (
    <div>
      <PageHeader
        title="Notes"
        description={isStudent(role) ? 'Mes notes' : 'Saisie et consultation des notes'}
        actions={canAdd && (
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus size={16} /> Nouvelle note
          </button>
        )}
      />

      {!isStudent(role) && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select className="input" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="">Toutes les classes</option>
              {classes.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="">Toutes les matières</option>
              {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input" value={termFilter} onChange={e => setTermFilter(e.target.value)}>
              <option value="">Tous les trimestres</option>
              {TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {grades.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : grades.data?.length === 0 ? (
          <EmptyState icon={BookOpen} title="Aucune note" description="Les notes apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  {!isStudent(role) && <th className="table-th">Élève</th>}
                  <th className="table-th">Matière</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Trimestre</th>
                  <th className="table-th">Note</th>
                  <th className="table-th">Coef</th>
                  {canAdd && <th className="table-th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {grades.data.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="table-td text-sm">{new Date(g.date).toLocaleDateString('fr-FR')}</td>
                    {!isStudent(role) && (
                      <td className="table-td">
                        <p className="font-medium text-sm">{g.first_name} {g.last_name}</p>
                        <p className="text-xs text-slate-500">{getClassName(g.class_id)}</p>
                      </td>
                    )}
                    <td className="table-td">{getSubjectName(g.subject_id)}</td>
                    <td className="table-td text-sm">
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                        {EVAL_TYPES.find(e => e.value === g.evaluation)?.label}
                      </span>
                    </td>
                    <td className="table-td text-sm">{TERMS.find(t => t.value === g.term)?.label}</td>
                    <td className="table-td"><GradeBadge value={g.value} /></td>
                    <td className="table-td text-sm">{g.coefficient}</td>
                    {canAdd && (
                      <td className="table-td text-right">
                        <button onClick={() => remove(g.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle note" size="lg"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
            <button form="grade-form" type="submit" className="btn-primary">Enregistrer</button>
          </>
        }
      >
        <form id="grade-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Matière *</label>
              <select className="input" required value={form.subject_id}
                onChange={e => setForm({ ...form, subject_id: e.target.value, student_id: '' })}>
                <option value="">— Choisir —</option>
                {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
            <div><label className="label">Date *</label>
              <input type="date" className="input" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div><label className="label">Élève *</label>
            <select className="input" required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}>
              <option value="">— Choisir —</option>
              {studentsForForm.data?.map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({getClassName(s.class_id)})</option>
              ))}
            </select>
            {isTeacher(role) && !form.subject_id && <p className="text-xs text-slate-400 mt-1">Choisis d'abord une matière.</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className="label">Note /20 *</label>
              <input type="number" step="0.25" min="0" max="20" className="input" required value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>
            <div><label className="label">Coef.</label>
              <input type="number" step="0.5" min="0.5" className="input" value={form.coefficient} onChange={e => setForm({ ...form, coefficient: e.target.value })} /></div>
            <div><label className="label">Type</label>
              <select className="input" value={form.evaluation} onChange={e => setForm({ ...form, evaluation: e.target.value })}>
                {EVAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div><label className="label">Trimestre</label>
              <select className="input" value={form.term} onChange={e => setForm({ ...form, term: e.target.value })}>
                {TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
          </div>
          <div><label className="label">Commentaire</label>
            <textarea className="input" rows="2" value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} /></div>
        </form>
      </Modal>
    </div>
  )
}
