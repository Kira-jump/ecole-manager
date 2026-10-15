import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Table2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { isTeacher } from '../lib/roles'
import { useMyClasses } from '../lib/useMyClasses'
import { termsForLevel } from '../lib/terms'
import { getStudents, getSubjects, getTeacherByProfileId, getClassAssignments, getSheetGrades, saveGradeSheet } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'

const currentMonth = () => new Date().toISOString().slice(0, 7)
const cellKey = (studentId, subjectId) => `${studentId}|${subjectId}`

// Lit une case : vide, invalide (hors 0-20) ou valeur
const parseValue = (raw) => {
  const t = String(raw ?? '').trim().replace(',', '.')
  if (t === '') return { empty: true }
  const v = Number(t)
  return Number.isNaN(v) || v < 0 || v > 20 ? { invalid: true } : { value: v }
}

const average = (items) => {
  const total = items.reduce((n, i) => n + i.coef, 0)
  return total ? items.reduce((n, i) => n + i.v * i.coef, 0) / total : null
}

export default function GradeSheet() {
  const toast = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const role = profile?.role
  const teacher = isTeacher(role)

  const classes = useMyClasses()
  const [classId, setClassId] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [term, setTerm] = useState('')
  const [values, setValues] = useState({})   // cases modifiées : "élève|matière" -> texte saisi
  const [saving, setSaving] = useState(false)

  const myTeacher = useQuery({
    queryKey: ['my-teacher', profile?.id],
    enabled: teacher,
    queryFn: () => getTeacherByProfileId(profile.id),
  })
  const subjects = useQuery({ queryKey: ['subjects-list'], queryFn: getSubjects })

  // Première classe par défaut
  useEffect(() => {
    if (!classId && classes.data?.length > 0) setClassId(classes.data[0].id)
  }, [classes.data, classId])

  // Trimestre (maternelle / primaire) ou semestre (collège / lycée) selon le niveau de la classe
  const level = classes.data?.find(c => c.id === classId)?.level
  const termOptions = termsForLevel(level)
  useEffect(() => {
    const opts = termsForLevel(level)
    if (!opts.some(t => t.value === term)) setTerm(opts[0].value)
  }, [level, term])

  const assignments = useQuery({
    queryKey: ['class-assignments', classId],
    enabled: !!classId,
    queryFn: () => getClassAssignments(classId),
  })

  const students = useQuery({
    queryKey: ['sheet-students', classId],
    enabled: !!classId,
    queryFn: async () => {
      const list = await getStudents(classId)
      return list.sort((a, b) =>
        (a.last_name ?? '').localeCompare(b.last_name ?? '') || (a.first_name ?? '').localeCompare(b.first_name ?? ''))
    },
  })

  const existing = useQuery({
    queryKey: ['sheet-grades', classId, month],
    enabled: !!classId && !!month,
    queryFn: () => getSheetGrades(classId, month),
  })

  // Colonnes = matières affectées à la classe (un prof ne voit que les siennes)
  const columns = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const a of assignments.data ?? []) {
      if (teacher && a.teacher_id !== myTeacher.data?.id) continue
      if (seen.has(a.subject_id)) continue
      seen.add(a.subject_id)
      const s = subjects.data?.find(x => x.id === a.subject_id)
      if (s) list.push(s)
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [assignments.data, subjects.data, teacher, myTeacher.data?.id])

  const existingMap = useMemo(() => {
    const m = {}
    for (const g of existing.data ?? []) m[cellKey(g.student_id, g.subject_id)] = g
    return m
  }, [existing.data])

  const getCell = (sid, subId) => {
    const k = cellKey(sid, subId)
    if (k in values) return values[k]
    const g = existingMap[k]
    return g ? String(g.value) : ''
  }

  // Cases réellement modifiées par rapport à ce qui est déjà enregistré
  const changedKeys = Object.keys(values).filter(k => {
    const cur = String(values[k]).trim()
    const g = existingMap[k]
    return g ? cur !== String(g.value) : cur !== ''
  })
  const changedSet = new Set(changedKeys)

  const studentAvg = (sid) => average(
    columns
      .map(c => ({ p: parseValue(getCell(sid, c.id)), coef: Number(c.default_coefficient) || 1 }))
      .filter(i => i.p.value !== undefined)
      .map(i => ({ v: i.p.value, coef: i.coef }))
  )
  const subjectAvg = (c) => average(
    (students.data ?? [])
      .map(s => parseValue(getCell(s.id, c.id)))
      .filter(p => p.value !== undefined)
      .map(p => ({ v: p.value, coef: 1 }))
  )

  // Si des notes ne sont pas enregistrées, on demande avant de changer de fiche
  const guard = (fn) => {
    if (changedKeys.length && !confirm('Des notes non enregistrées seront perdues. Continuer ?')) return
    setValues({})
    fn()
  }

  const onCellKey = (e, r, c) => {
    const move = (dr) => { e.preventDefault(); document.querySelector(`[data-cell="${r + dr}-${c}"]`)?.focus() }
    if (e.key === 'Enter' || e.key === 'ArrowDown') move(1)
    else if (e.key === 'ArrowUp') move(-1)
  }

  const save = async () => {
    const sets = []
    const deletes = []
    for (const k of changedKeys) {
      const [sid, subId] = k.split('|')
      const p = parseValue(values[k])
      const student = students.data?.find(s => s.id === sid)
      const subject = subjects.data?.find(s => s.id === subId)
      if (p.invalid) {
        toast.error(`Note invalide : ${student?.first_name ?? ''} ${student?.last_name ?? ''} en ${subject?.name ?? ''} (entre 0 et 20)`)
        return
      }
      const id = existingMap[k]?.id ?? `${sid}_${subId}_${month}`
      if (p.empty) { if (existingMap[k]) deletes.push(id); continue }
      sets.push({
        id,
        data: {
          student_id: sid,
          first_name: student?.first_name ?? '',
          last_name: student?.last_name ?? '',
          class_id: classId,
          subject_id: subId,
          subject_name: subject?.name ?? '',
          teacher_id: assignments.data?.find(a => a.subject_id === subId)?.teacher_id ?? null,
          value: p.value,
          coefficient: 1,
          evaluation: 'mensuelle',
          month,
          term,
          date: new Date().toISOString().slice(0, 10),
          comment: null,
        },
      })
    }
    if (!sets.length && !deletes.length) return
    setSaving(true)
    try {
      await saveGradeSheet({ sets, deletes })
      toast.success('Fiche enregistrée')
      setValues({})
      qc.invalidateQueries({ queryKey: ['sheet-grades'] })
      qc.invalidateQueries({ queryKey: ['grades'] })
    } catch (err) {
      toast.error(err?.message ?? 'Échec')
    } finally {
      setSaving(false)
    }
  }

  const loading = classes.isLoading || assignments.isLoading || students.isLoading || existing.isLoading || subjects.isLoading
  const periodLabel = level ? (termOptions[0]?.value.startsWith('trimestre') ? 'Trimestre' : 'Semestre') : 'Période'

  return (
    <div>
      <PageHeader
        title="Fiche de notes"
        description="Une classe, un mois : toutes les matières sur une seule fiche"
        actions={
          <button onClick={save} disabled={saving || changedKeys.length === 0} className="btn-primary">
            <Save size={16} /> {saving ? 'Enregistrement…' : changedKeys.length ? `Enregistrer (${changedKeys.length})` : 'Enregistrer'}
          </button>
        }
      />

      <div className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className="label">Classe</label>
          <select className="input" value={classId} onChange={e => guard(() => setClassId(e.target.value))}>
            {classes.data?.length ? null : <option value="">—</option>}
            {classes.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="label">Mois</label>
          <input type="month" className="input" value={month} onChange={e => e.target.value && guard(() => setMonth(e.target.value))} /></div>
        <div><label className="label">{periodLabel}</label>
          <select className="input" value={term} onChange={e => setTerm(e.target.value)}>
            {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select></div>
      </div>

      {!classId ? (
        <div className="card"><EmptyState icon={Table2} title="Aucune classe" description={teacher ? "Tu n'as pas encore de classe assignée." : 'Crée une classe pour commencer.'} /></div>
      ) : loading ? (
        <div className="card p-12 flex justify-center"><Spinner /></div>
      ) : !columns.length ? (
        <div className="card"><EmptyState icon={Table2} title="Aucune matière" description="Aucune matière n'est affectée à cette classe (page Enseignants → Affectations)." /></div>
      ) : !students.data?.length ? (
        <div className="card"><EmptyState icon={Table2} title="Aucun élève" description="Cette classe n'a pas encore d'élèves." /></div>
      ) : (
        <>
          <div className="card overflow-auto max-h-[70vh]">
            <table className="border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-slate-50 text-left px-3 py-2 min-w-[9rem] border-b border-r border-slate-200 text-xs font-semibold text-slate-600">Élève</th>
                  {columns.map(c => (
                    <th key={c.id} className="sticky top-0 z-20 bg-slate-50 px-2 py-2 min-w-[5.5rem] border-b border-r border-slate-200 text-center">
                      <div className="text-xs font-semibold text-slate-700 truncate max-w-[6rem] mx-auto">{c.name}</div>
                      <div className="text-[10px] font-normal text-slate-400">coef {c.default_coefficient ?? 1}</div>
                    </th>
                  ))}
                  <th className="sticky top-0 z-20 bg-slate-100 px-2 py-2 min-w-[4.5rem] border-b border-slate-200 text-center text-xs font-semibold text-slate-700">Moy.</th>
                </tr>
              </thead>
              <tbody>
                {students.data.map((s, r) => {
                  const avg = studentAvg(s.id)
                  return (
                    <tr key={s.id}>
                      <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-1.5">
                        <p className="font-medium text-slate-900 leading-tight">{s.last_name} {s.first_name}</p>
                        <p className="text-[11px] text-slate-500">{s.matricule}</p>
                      </td>
                      {columns.map((c, ci) => {
                        const raw = getCell(s.id, c.id)
                        const p = parseValue(raw)
                        const changed = changedSet.has(cellKey(s.id, c.id))
                        return (
                          <td key={c.id} className="border-b border-r border-slate-100 p-0">
                            <input
                              data-cell={`${r}-${ci}`}
                              type="text"
                              inputMode="decimal"
                              enterKeyHint="next"
                              className={`w-full h-11 text-center outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 focus:bg-brand-50 ${p.invalid ? 'bg-red-50 text-red-700' : changed ? 'bg-amber-50' : 'bg-transparent'}`}
                              value={raw}
                              onChange={e => { const val = e.target.value; setValues(v => ({ ...v, [cellKey(s.id, c.id)]: val })) }}
                              onKeyDown={e => onCellKey(e, r, ci)}
                              onFocus={e => e.target.select()}
                            />
                          </td>
                        )
                      })}
                      <td className="border-b border-slate-100 bg-slate-50 text-center font-semibold text-slate-800 px-2">
                        {avg == null ? '—' : avg.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky left-0 bottom-0 z-20 bg-slate-100 px-3 py-2 border-t border-r border-slate-200 text-xs font-semibold text-slate-700">Moyenne de la classe</td>
                  {columns.map(c => {
                    const a = subjectAvg(c)
                    return (
                      <td key={c.id} className="sticky bottom-0 z-10 bg-slate-100 border-t border-r border-slate-200 text-center text-xs font-semibold text-slate-700 py-2">
                        {a == null ? '—' : a.toFixed(2)}
                      </td>
                    )
                  })}
                  <td className="sticky bottom-0 z-10 bg-slate-100 border-t border-slate-200" />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Une case vide = pas de note. Entrée ou flèche bas pour passer à l'élève suivant. Les moyennes affichées sont indicatives.
          </p>
        </>
      )}
    </div>
  )
}
