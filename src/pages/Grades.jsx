import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, BookOpen, Trash2, ClipboardList, Table2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { isStudent, isTeacher, isPedagogy } from '../lib/roles'
import { getGrades, addGrade, addGradesBulk, deleteGrade, getSubjects, getStudents, getStudentByProfileId, getTeacherByProfileId, getAssignments, getClassSubjects } from '../lib/db'
import { useMyClasses } from '../lib/useMyClasses'
import { computeAverages, buildCoefMap } from '../lib/averages'
import { TERMS, termsForLevel } from '../lib/terms'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

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
  // Saisie rapide par classe
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkValues, setBulkValues] = useState({})
  const [bulk, setBulk] = useState({
    class_id: '', subject_id: '', coefficient: 1,
    evaluation: 'devoir', term: 'trimestre_1',
    date: new Date().toISOString().slice(0, 10),
  })
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

  // Fiche élève de l'utilisateur connecté (les notes utilisent l'id students, pas l'id profil)
  const myStudent = useQuery({
    queryKey: ['my-student', profile?.id],
    enabled: isStudent(role),
    queryFn: () => getStudentByProfileId(profile.id),
  })

  const subjects = useQuery({ queryKey: ['subjects-list'], queryFn: getSubjects })
  const myClassCoefs = useQuery({
    queryKey: ['class-coefs', myStudent.data?.class_id],
    enabled: isStudent(role) && !!myStudent.data?.class_id,
    queryFn: () => getClassSubjects(myStudent.data.class_id),
  })
  const classes = useMyClasses()

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

  // Un prof voit les notes de ses couples classe + matière (ses affectations)
  const assignKey = (myAssignments.data ?? []).map(a => `${a.class_id}:${a.subject_id}`).sort().join('|')

  const grades = useQuery({
    queryKey: ['grades', classFilter, subjectFilter, termFilter, role, assignKey, myStudent.data?.id],
    // On attend les affectations du prof / la fiche de l'élève avant de lancer la requête (sinon aucun filtre)
    enabled: isTeacher(role) ? !!myAssignments.data : isStudent(role) ? !!myStudent.data?.id : true,
    queryFn: async () => {
      const list = await getGrades({
        classFilter,
        subjectFilter,
        termFilter,
        studentId: isStudent(role) ? myStudent.data?.id : undefined,
      })
      if (isTeacher(role)) {
        return list.filter(g => (myAssignments.data ?? []).some(a => a.class_id === g.class_id && a.subject_id === g.subject_id))
      }
      return list
    },
  })

  const getSubjectName = (id) => subjects.data?.find(s => s.id === id)?.name ?? '—'
  const getClassName = (id) => classes.data?.find(c => c.id === id)?.name ?? '—'

  // ── Saisie rapide par classe ──
  const bulkSubjects = useMemo(() => {
    if (isTeacher(role)) {
      const ids = new Set((myAssignments.data ?? []).filter(a => a.class_id === bulk.class_id).map(a => a.subject_id))
      return (subjects.data ?? []).filter(s => ids.has(s.id))
    }
    return subjects.data ?? []
  }, [role, subjects.data, myAssignments.data, bulk.class_id])

  // S'il n'y a qu'une seule matière possible, elle est choisie automatiquement
  const bulkSubjectId = bulk.subject_id || (bulkSubjects.length === 1 ? bulkSubjects[0].id : '')

  const bulkStudents = useQuery({
    queryKey: ['students-bulk', bulk.class_id],
    enabled: bulkOpen && !!bulk.class_id,
    queryFn: async () => {
      const list = await getStudents(bulk.class_id)
      return list.sort((a, b) =>
        (a.last_name ?? '').localeCompare(b.last_name ?? '') || (a.first_name ?? '').localeCompare(b.first_name ?? ''))
    },
  })

  const filledCount = Object.values(bulkValues).filter(v => String(v).trim() !== '').length

  const openBulk = () => {
    setBulkValues({})
    setBulk(b => ({ ...b, class_id: b.class_id || classes.data?.[0]?.id || '', subject_id: '' }))
    setBulkOpen(true)
  }

  const changeBulkClass = (class_id) => {
    setBulkValues({})
    setBulk(b => ({ ...b, class_id, subject_id: '' }))
  }

  // Touche Entrée = passer à l'élève suivant
  const focusNext = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const inputs = Array.from(document.querySelectorAll('[data-bulk-input]'))
    inputs[inputs.indexOf(e.target) + 1]?.focus()
  }

  const saveBulk = async () => {
    if (!bulk.class_id || !bulkSubjectId) { toast.error('Choisis la classe et la matière'); return }
    const rows = []
    for (const s of bulkStudents.data ?? []) {
      const raw = String(bulkValues[s.id] ?? '').trim().replace(',', '.')
      if (raw === '') continue
      const v = Number(raw)
      if (Number.isNaN(v) || v < 0 || v > 20) {
        toast.error(`Note invalide pour ${s.first_name} ${s.last_name} (entre 0 et 20)`)
        return
      }
      rows.push({ student: s, value: v })
    }
    if (!rows.length) { toast.error('Saisis au moins une note'); return }
    setBulkSaving(true)
    try {
      await addGradesBulk(rows.map(({ student, value }) => ({
        student_id: student.id,
        first_name: student.first_name ?? '',
        last_name: student.last_name ?? '',
        subject_id: bulkSubjectId,
        subject_name: getSubjectName(bulkSubjectId),
        teacher_id: myTeacher.data?.id ?? null,
        class_id: bulk.class_id,
        value,
        coefficient: Number(bulk.coefficient) || 1,
        evaluation: bulk.evaluation,
        term: bulk.term,
        date: bulk.date,
        comment: null,
      })))
      toast.success(`${rows.length} note${rows.length > 1 ? 's' : ''} enregistrée${rows.length > 1 ? 's' : ''}`)
      setBulkOpen(false)
      setBulkValues({})
      qc.invalidateQueries({ queryKey: ['grades'] })
    } catch (err) { toast.error(err?.message ?? 'Échec') }
    finally { setBulkSaving(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const student = studentsForForm.data?.find(s => s.id === form.student_id)
      await addGrade({
        student_id: form.student_id,
        first_name: student?.first_name ?? '',
        last_name: student?.last_name ?? '',
        subject_id: form.subject_id,
        subject_name: getSubjectName(form.subject_id),
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

  // Élève : onglets Trimestres (primaire) ou Semestres (collège / lycée)
  const myLevel = classes.data?.find(c => c.id === myStudent.data?.class_id)?.level
  const studentTerms = termsForLevel(myLevel)
  const averages = computeAverages(grades.data ?? [], subjects.data, buildCoefMap(myClassCoefs.data))
  const canAdd = isTeacher(role) || isPedagogy(role)

  return (
    <div>
      <PageHeader
        title="Notes"
        description={isStudent(role) ? 'Mes notes' : 'Saisie et consultation des notes'}
        actions={canAdd && (
          <>
            <Link to="/grade-sheet" className="btn-primary">
              <Table2 size={16} /> Fiche de notes
            </Link>
            <button onClick={openBulk} className="btn-secondary">
              <ClipboardList size={16} /> Saisie par classe
            </button>
            <button onClick={() => setOpen(true)} className="btn-secondary">
              <Plus size={16} /> Une note
            </button>
          </>
        )}
      />

      {isStudent(role) && (
        <div className="card p-5 mb-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {[{ value: '', label: 'Année' }, ...studentTerms.map(t => ({ value: t.value, label: t.label.replace('Trimestre ', 'T').replace('Semestre ', 'S') }))].map(t => (
              <button key={t.value} onClick={() => setTermFilter(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${termFilter === t.value ? 'bg-brand-700 text-white border-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {averages.rows.length === 0 ? (
            <p className="text-sm text-slate-500">Pas encore de moyenne pour cette période.</p>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Moyenne générale</p>
                <p className="text-3xl font-bold text-slate-900">{averages.general.toFixed(2)}<span className="text-base font-medium text-slate-400"> /20</span></p>
              </div>
              <div className="divide-y divide-slate-100">
                {averages.rows.map(r => (
                  <div key={r.subject_id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.count} note{r.count > 1 ? 's' : ''} · coef {r.coef}</p>
                    </div>
                    <GradeBadge value={r.average} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">Moyennes indicatives, calculées à partir des notes saisies.</p>
            </>
          )}
        </div>
      )}

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
        ) : !grades.data?.length ? (
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
                        {EVAL_TYPES.find(e => e.value === g.evaluation)?.label ?? (g.evaluation === 'mensuelle' ? 'Mensuelle' : '')}
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
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.matricule} ({getClassName(s.class_id)})</option>
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

      {/* Saisie rapide : une évaluation, toute la classe */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Saisie par classe" size="lg"
        footer={
          <>
            <span className="mr-auto self-center text-xs text-slate-500">
              {filledCount} note{filledCount > 1 ? 's' : ''} à enregistrer
            </span>
            <button onClick={() => setBulkOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={saveBulk} disabled={bulkSaving || filledCount === 0} className="btn-primary">
              {bulkSaving ? 'Enregistrement…' : 'Enregistrer tout'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Classe *</label>
              <select className="input" value={bulk.class_id} onChange={e => changeBulkClass(e.target.value)}>
                <option value="">— Choisir —</option>
                {classes.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="label">Matière *</label>
              <select className="input" value={bulkSubjectId} onChange={e => setBulk({ ...bulk, subject_id: e.target.value })}>
                <option value="">— Choisir —</option>
                {bulkSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className="label">Type</label>
              <select className="input" value={bulk.evaluation} onChange={e => setBulk({ ...bulk, evaluation: e.target.value })}>
                {EVAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div><label className="label">Trimestre</label>
              <select className="input" value={bulk.term} onChange={e => setBulk({ ...bulk, term: e.target.value })}>
                {TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div><label className="label">Date</label>
              <input type="date" className="input" value={bulk.date} onChange={e => setBulk({ ...bulk, date: e.target.value })} /></div>
            <div><label className="label">Coef.</label>
              <input type="number" step="0.5" min="0.5" className="input" value={bulk.coefficient} onChange={e => setBulk({ ...bulk, coefficient: e.target.value })} /></div>
          </div>

          {!bulk.class_id ? (
            <p className="text-sm text-slate-400 text-center py-6">Choisis une classe pour afficher les élèves.</p>
          ) : bulkStudents.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !bulkStudents.data?.length ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun élève dans cette classe.</p>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-2">Laisse vide les élèves sans note (absents, par exemple).</p>
              <div className="border border-slate-100 rounded-xl divide-y divide-slate-100">
                {bulkStudents.data.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-xs text-slate-400 w-6 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{s.last_name} {s.first_name}</p>
                      <p className="text-xs text-slate-500">{s.matricule}</p>
                    </div>
                    <input
                      data-bulk-input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="next"
                      placeholder="/20"
                      className="input w-20 text-center shrink-0"
                      value={bulkValues[s.id] ?? ''}
                      onChange={e => { const val = e.target.value; setBulkValues(v => ({ ...v, [s.id]: val })) }}
                      onKeyDown={focusNext}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
