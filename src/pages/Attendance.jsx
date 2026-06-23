import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Check, X, Clock, FileCheck } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { isStudent, isTeacher, isStaff, canManageDiscipline } from '../lib/roles'
import { getClasses, getAttendanceForClass, setAttendance, justifyAbsence, getMyAttendance, getStudentByProfileId } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

const STATUS = {
  present:   { label: 'Présent',   color: 'bg-emerald-100 text-emerald-700', icon: Check },
  absent:    { label: 'Absent',    color: 'bg-red-100 text-red-700',         icon: X },
  retard:    { label: 'Retard',    color: 'bg-amber-100 text-amber-700',     icon: Clock },
  justified: { label: 'Justifié', color: 'bg-blue-100 text-blue-700',       icon: FileCheck },
}

export default function Attendance() {
  const toast = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const role = profile?.role
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [classId, setClassId] = useState('')

  const classes = useQuery({ queryKey: ['classes-list'], queryFn: getClasses })

  useEffect(() => {
    if (!classId && classes.data?.length > 0 && !isStudent(role)) {
      setClassId(classes.data[0].id)
    }
  }, [classes.data, classId, role])

  // Vue élève
  const myStudent = useQuery({
    queryKey: ['my-student', profile?.id],
    enabled: isStudent(role),
    queryFn: () => getStudentByProfileId(profile.id),
  })

  const myAttendance = useQuery({
    queryKey: ['my-attendance', myStudent.data?.id],
    enabled: !!myStudent.data?.id,
    queryFn: () => getMyAttendance(myStudent.data.id),
  })

  // Vue staff/prof
  const students = useQuery({
    queryKey: ['attendance-students', classId, date],
    enabled: !!classId && !isStudent(role),
    queryFn: () => getAttendanceForClass(classId, date),
  })

  const markStatus = async (studentId, status) => {
    if (!isTeacher(role) && !isStaff(role)) return
    try {
      await setAttendance(studentId, date, status, profile.id)
      qc.invalidateQueries({ queryKey: ['attendance-students', classId, date] })
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  const markAllPresent = async () => {
    if (!students.data?.length) return
    if (!confirm(`Marquer les ${students.data.length} élèves comme présents ?`)) return
    try {
      await Promise.all(students.data.map(s => setAttendance(s.id, date, 'present', profile.id)))
      qc.invalidateQueries({ queryKey: ['attendance-students', classId, date] })
      toast.success('Tous marqués présents')
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  const justify = async (studentId) => {
    const reason = prompt('Motif de justification :')
    if (!reason) return
    try {
      await justifyAbsence(studentId, date, reason, profile.id)
      qc.invalidateQueries({ queryKey: ['attendance-students', classId, date] })
      toast.success('Absence justifiée')
    } catch (err) { toast.error(err?.message ?? 'Échec') }
  }

  // ── Vue élève ──
  if (isStudent(role)) {
    return (
      <div>
        <PageHeader title="Mes présences" description="Historique de mes présences et absences" />
        <div className="card overflow-hidden">
          {myAttendance.isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : myAttendance.data?.length === 0 ? (
            <EmptyState icon={Calendar} title="Aucune donnée" description="Aucune présence enregistrée pour le moment." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Justification</th>
                </tr>
              </thead>
              <tbody>
                {myAttendance.data.map(a => {
                  const st = STATUS[a.status]
                  const Icon = st.icon
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="table-td">{new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</td>
                      <td className="table-td">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                          <Icon size={12} /> {st.label}
                        </span>
                      </td>
                      <td className="table-td text-sm text-slate-600">{a.justification ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ── Vue staff/prof ──
  return (
    <div>
      <PageHeader
        title="Présences"
        description="Faire l'appel et suivre les présences"
        actions={
          students.data?.length > 0 && (
            <button onClick={markAllPresent} className="btn-secondary">
              <Check size={16} /> Tous présents
            </button>
          )
        }
      />

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="label">Classe</label>
            <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">— Choisir —</option>
              {classes.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!classId ? (
          <EmptyState icon={Calendar} title="Choisis une classe" description="Sélectionne une classe pour faire l'appel." />
        ) : students.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : students.data?.length === 0 ? (
          <EmptyState icon={Calendar} title="Aucun élève dans cette classe" />
        ) : (
          <div className="divide-y divide-slate-100">
            {students.data.map(s => {
              const status = s.attendance?.status ?? null
              return (
                <div key={s.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
                      {(s.first_name?.[0] ?? '') + (s.last_name?.[0] ?? '')}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-500">{s.matricule}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['present', 'absent', 'retard'].map(k => {
                      const st = STATUS[k]
                      const Icon = st.icon
                      const active = status === k
                      return (
                        <button key={k} onClick={() => markStatus(s.id, k)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            active ? `${st.color} border-transparent` : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}>
                          <Icon size={12} /> {st.label}
                        </button>
                      )
                    })}
                    {canManageDiscipline(role) && status === 'absent' && (
                      <button onClick={() => justify(s.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-blue-200 text-blue-700 hover:bg-blue-50">
                        <FileCheck size={12} /> Justifier
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
