import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin, isPedagogy } from '../lib/roles'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, BookOpen, Info, GraduationCap, Phone, Calendar, User } from 'lucide-react'
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getStudents, getSubjects, getAssignments, getGrades, getMyAttendance } from '../lib/db'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { roleColor, roleLabel } from '../lib/roles'

// ── Hooks ──────────────────────────────────────────────────────────────

function useClass(id) {
  return useQuery({
    queryKey: ['class', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'classes', id))
      return snap.exists() ? { id: snap.id, ...snap.data() } : null
    },
  })
}

function useClassStudents(classId) {
  return useQuery({
    queryKey: ['students', classId],
    enabled: !!classId,
    queryFn: () => getStudents(classId),
  })
}

function useClassSubjects(classId) {
  return useQuery({
    queryKey: ['class-subjects', classId],
    enabled: !!classId,
    queryFn: async () => {
      // Récupère toutes les affectations de cette classe
      const q = query(collection(db, 'teaching_assignments'), where('class_id', '==', classId))
      const snap = await getDocs(q)
      const assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      if (!assignments.length) return []

      // Récupère les matières uniques
      const subjectIds = [...new Set(assignments.map(a => a.subject_id))]
      const allSubjects = await getSubjects()
      const subjects = allSubjects.filter(s => subjectIds.includes(s.id))

      // Pour chaque matière, trouve le prof
      const result = await Promise.all(subjects.map(async (s) => {
        const ass = assignments.find(a => a.subject_id === s.id)
        let teacher = null
        if (ass?.teacher_id) {
          const tSnap = await getDoc(doc(db, 'teachers', ass.teacher_id))
          if (tSnap.exists()) teacher = tSnap.data()
        }
        return { ...s, teacher }
      }))

      return result
    },
  })
}

// ── Composant détail élève ──────────────────────────────────────────────

function StudentDetail({ student, onClose }) {
  const grades = useQuery({
    queryKey: ['student-grades', student.id],
    queryFn: () => getGrades({ studentId: student.id }),
  })

  const attendance = useQuery({
    queryKey: ['student-attendance', student.id],
    queryFn: () => getMyAttendance(student.id),
  })

  // Calcul moyenne générale
  const moyenne = (() => {
    if (!grades.data?.length) return null
    const total = grades.data.reduce((sum, g) => sum + (Number(g.value) * Number(g.coefficient)), 0)
    const totalCoef = grades.data.reduce((sum, g) => sum + Number(g.coefficient), 0)
    return totalCoef > 0 ? (total / totalCoef).toFixed(2) : null
  })()

  const absences = attendance.data?.filter(a => a.status === 'absent').length ?? 0
  const retards = attendance.data?.filter(a => a.status === 'retard').length ?? 0

  return (
    <Modal open={!!student} onClose={onClose} title="Fiche élève" size="lg">
      <div className="space-y-5">

        {/* Identité */}
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-brand-700 text-white flex items-center justify-center text-xl font-bold">
            {(student.first_name?.[0] ?? '') + (student.last_name?.[0] ?? '')}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{student.first_name} {student.last_name}</h3>
            <p className="text-sm text-slate-500">Matricule : <span className="font-mono font-medium">{student.matricule}</span></p>
            <p className="text-sm text-slate-500">Genre : {student.gender === 'M' ? 'Masculin' : student.gender === 'F' ? 'Féminin' : '—'}</p>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-brand-700">{moyenne ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-1">Moyenne /20</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{absences}</p>
            <p className="text-xs text-slate-500 mt-1">Absences</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{retards}</p>
            <p className="text-xs text-slate-500 mt-1">Retards</p>
          </div>
        </div>

        {/* Infos personnelles */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Informations personnelles</h4>
          <div className="space-y-2">
            {student.birth_date && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-slate-600">Né(e) le {new Date(student.birth_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
            {student.email && (
              <div className="flex items-center gap-3 text-sm">
                <User size={16} className="text-slate-400" />
                <span className="text-slate-600">{student.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Parent */}
        {(student.parent_name || student.parent_phone) && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Parent / Tuteur</h4>
            <div className="card p-3 space-y-2">
              {student.parent_name && (
                <div className="flex items-center gap-3 text-sm">
                  <User size={16} className="text-slate-400" />
                  <span className="text-slate-700 font-medium">{student.parent_name}</span>
                </div>
              )}
              {student.parent_phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={16} className="text-slate-400" />
                  <a href={`tel:${student.parent_phone}`} className="text-brand-700 font-medium">{student.parent_phone}</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes récentes */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
            Notes récentes {grades.data?.length ? `(${grades.data.length})` : ''}
          </h4>
          {grades.isLoading ? <Spinner size="sm" /> :
            grades.data?.length === 0 ? <p className="text-sm text-slate-400 italic">Aucune note enregistrée.</p> :
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {grades.data.slice(0, 10).map(g => (
                <div key={g.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{g.subject_name ?? '—'}</p>
                    <p className="text-xs text-slate-500">{new Date(g.date).toLocaleDateString('fr-FR')} • Coef. {g.coefficient}</p>
                  </div>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-sm ${
                    Number(g.value) >= 14 ? 'bg-emerald-100 text-emerald-700'
                    : Number(g.value) >= 10 ? 'bg-blue-100 text-blue-700'
                    : 'bg-red-100 text-red-700'
                  }`}>{Number(g.value).toFixed(2)}/20</span>
                </div>
              ))}
            </div>
          }
        </div>

      </div>
    </Modal>
  )
}

// ── Page principale ─────────────────────────────────────────────────────

const TABS = [
  { id: 'eleves', label: 'Élèves', icon: Users },
  { id: 'matieres', label: 'Matières', icon: BookOpen },
  { id: 'infos', label: 'Infos', icon: Info },
]

const LEVELS = { primaire: 'Primaire', college: 'Collège', lycee: 'Lycée' }

export default function ClassDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = isPedagogy(profile?.role)
  const [tab, setTab] = useState('eleves')
  const [selectedStudent, setSelectedStudent] = useState(null)

  const classQuery = useClass(id)
  const students = useClassStudents(id)
  const subjects = useClassSubjects(id)

  const cls = classQuery.data

  if (classQuery.isLoading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  if (!cls) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-500">Classe introuvable.</p>
        <button onClick={() => navigate('/classes')} className="btn-secondary mt-4">Retour</button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/classes')} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{cls.name}</h1>
          <p className="text-sm text-slate-500">{LEVELS[cls.level]} • {cls.school_year_label}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}>
              <Icon size={16} /> {t.label}
              {t.id === 'eleves' && students.data?.length > 0 && (
                <span className="bg-brand-100 text-brand-700 text-xs px-1.5 py-0.5 rounded-full">{students.data.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Élèves */}
      {tab === 'eleves' && (
        <div className="card overflow-hidden">
          {students.isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : students.data?.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Aucun élève" description="Aucun élève assigné à cette classe." />
          ) : (
            <div className="divide-y divide-slate-100">
              {students.data.map(s => (
                <button key={s.id} onClick={() => setSelectedStudent(s)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {(s.first_name?.[0] ?? '') + (s.last_name?.[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-slate-500">Matricule : {s.matricule}</p>
                  </div>
                  <div className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {s.gender === 'M' ? 'M' : s.gender === 'F' ? 'F' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Matières */}
      {tab === 'matieres' && (
        <div className="card overflow-hidden">
          {subjects.isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : subjects.data?.length === 0 ? (
            <EmptyState icon={BookOpen} title="Aucune matière" description="Affecte des enseignants à cette classe depuis la page Enseignants." />
          ) : (
            <div className="divide-y divide-slate-100">
              {subjects.data.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{s.name}</p>
                      {s.code && <code className="text-xs text-slate-400">{s.code}</code>}
                    </div>
                  </div>
                  <div className="text-right">
                    {s.teacher ? (
                      <p className="text-sm text-slate-700">{s.teacher.first_name} {s.teacher.last_name}</p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Pas de prof assigné</p>
                    )}
                    <p className="text-xs text-slate-400">Coef. {s.default_coefficient}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Infos */}
      {tab === 'infos' && (
        <div className="card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-brand-700">{students.data?.length ?? '—'}</p>
              <p className="text-sm text-slate-500 mt-1">Élèves inscrits</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-brand-700">{cls.capacity ?? 50}</p>
              <p className="text-sm text-slate-500 mt-1">Capacité max</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Niveau</span>
              <span className="text-sm font-medium text-slate-900">{LEVELS[cls.level]}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Année scolaire</span>
              <span className="text-sm font-medium text-slate-900">{cls.school_year_label ?? '—'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Matières enseignées</span>
              <span className="text-sm font-medium text-slate-900">{subjects.data?.length ?? '—'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-slate-500">Taux de remplissage</span>
              <span className="text-sm font-medium text-slate-900">
                {students.data && cls.capacity
                  ? Math.round((students.data.length / cls.capacity) * 100) + '%'
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal détail élève */}
      {selectedStudent && (
        <StudentDetail student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  )
}
