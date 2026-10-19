import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { GraduationCap, Users, School, BookOpen, CalendarCheck, Megaphone, TrendingUp, Table2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isStaff, isStudent, isTeacher, roleLabel, canSeeAnnouncement } from '../lib/roles'
import { canAccess, canTakeAttendance } from '../lib/access'
import { getDashboardStats, getAnnouncements, getStudentByProfileId, getGrades, getMyAttendance, getClasses, getTeacherByProfileId, getAssignments, countStudentsInClasses, getSubjects, getClassSubjects } from '../lib/db'
import { useMyClasses } from '../lib/useMyClasses'
import { computeAverages, buildCoefMap } from '../lib/averages'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}><Icon size={22} /></div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value ?? '–'}</p>
        </div>
      </div>
    </div>
  )
}

// Raccourcis : chaque rôle ne voit que ceux des pages auxquelles il a accès
const SHORTCUTS = [
  { to: '/grade-sheet', page: 'gradeSheet', icon: Table2, color: 'text-brand-700', label: () => 'Fiche de notes' },
  { to: '/grades', page: 'grades', icon: BookOpen, color: 'text-amber-600', label: (r) => (isStudent(r) ? 'Mes notes' : 'Notes') },
  { to: '/attendance', page: 'attendance', icon: CalendarCheck, color: 'text-emerald-600',
    label: (r) => (isStudent(r) ? 'Mes présences' : canTakeAttendance(r) ? "Faire l'appel" : 'Présences') },
  { to: '/students', page: 'students', icon: GraduationCap, color: 'text-blue-600', label: () => 'Liste des élèves' },
  { to: '/classes', page: 'classes', icon: School, color: 'text-emerald-700', label: (r) => (isTeacher(r) ? 'Mes classes' : 'Classes') },
  { to: '/announcements', page: 'announcements', icon: Megaphone, color: 'text-brand-700', label: () => 'Annonces' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const role = profile?.role

  const stats = useQuery({ queryKey: ['dashboard-stats'], queryFn: getDashboardStats, enabled: isStaff(role) })
  // Stats du prof : limitées à ses propres classes
  const myClasses = useMyClasses({ enabled: isTeacher(role) })
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
  const teacherClassIds = (myClasses.data ?? []).map(c => c.id)
  const teacherStudents = useQuery({
    queryKey: ['teacher-student-count', teacherClassIds.join(',')],
    enabled: isTeacher(role) && !!myClasses.data,
    queryFn: () => countStudentsInClasses(teacherClassIds),
  })
  const teacherSubjectCount = myAssignments.data
    ? new Set(myAssignments.data.map(a => a.subject_id)).size
    : undefined

  const announcements = useQuery({
    queryKey: ['recent-announcements', role],
    queryFn: async () => {
      const all = await getAnnouncements()
      return all.filter(a => canSeeAnnouncement(a, role)).slice(0, 3)
    },
  })

  const myStudent = useQuery({
    queryKey: ['my-student', profile?.id],
    enabled: isStudent(role),
    queryFn: () => getStudentByProfileId(profile.id),
  })

  const myClass = useQuery({
    queryKey: ['classes-list'],
    enabled: isStudent(role) && !!myStudent.data?.class_id,
    queryFn: getClasses,
  })
  const myClassName = myClass.data?.find(c => c.id === myStudent.data?.class_id)?.name

  const myGrades = useQuery({
    queryKey: ['my-grades-dash', myStudent.data?.id],
    enabled: !!myStudent.data?.id,
    queryFn: () => getGrades({ studentId: myStudent.data.id }),
  })

  const myAtt = useQuery({
    queryKey: ['my-att-dash', myStudent.data?.id],
    enabled: !!myStudent.data?.id,
    queryFn: () => getMyAttendance(myStudent.data.id),
  })

  const mySubjects = useQuery({ queryKey: ['subjects-list'], enabled: isStudent(role), queryFn: getSubjects })
  const myClassCoefs = useQuery({
    queryKey: ['class-coefs', myStudent.data?.class_id],
    enabled: isStudent(role) && !!myStudent.data?.class_id,
    queryFn: () => getClassSubjects(myStudent.data.class_id),
  })
  const myGeneral = computeAverages(myGrades.data ?? [], mySubjects.data, buildCoefMap(myClassCoefs.data)).general

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  })()

  return (
    <div>
      <PageHeader title={`${greeting}, ${profile?.first_name} 👋`} description={`Bienvenue dans ton espace ${roleLabel(role)}`} />

      {isStaff(role) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {canAccess(role, 'students') && <StatCard icon={GraduationCap} label="Élèves" value={stats.data?.students} color="bg-blue-100 text-blue-700" />}
          {canAccess(role, 'teachers') && <StatCard icon={Users} label="Enseignants" value={stats.data?.teachers} color="bg-purple-100 text-purple-700" />}
          {canAccess(role, 'classes') && <StatCard icon={School} label="Classes" value={stats.data?.classes} color="bg-emerald-100 text-emerald-700" />}
          {canAccess(role, 'subjects') && <StatCard icon={BookOpen} label="Matières" value={stats.data?.subjects} color="bg-amber-100 text-amber-700" />}
        </div>
      )}

      {isTeacher(role) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={School} label="Mes classes" value={myClasses.data?.length} color="bg-emerald-100 text-emerald-700" />
          <StatCard icon={GraduationCap} label="Mes élèves" value={teacherStudents.data} color="bg-blue-100 text-blue-700" />
          <StatCard icon={BookOpen} label="Mes matières" value={teacherSubjectCount} color="bg-amber-100 text-amber-700" />
        </div>
      )}

      {isStudent(role) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ma classe</p>
            <p className="text-xl font-semibold text-slate-900">{myClassName ?? 'Non assigné'}</p>
            <p className="text-xs text-slate-400 mt-1">Matricule : {myStudent.data?.matricule}</p>
          </div>
          <StatCard icon={BookOpen} label="Moyenne générale" value={myGeneral != null ? `${myGeneral.toFixed(2)}/20` : '—'} color="bg-amber-100 text-amber-700" />
          <StatCard icon={CalendarCheck} label="Absences" value={myAtt.data?.filter(a => a.status === 'absent').length ?? 0} color="bg-red-100 text-red-700" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Megaphone size={18} className="text-brand-700" /> Annonces récentes</h2>
            <Link to="/announcements" className="text-sm text-brand-700 hover:underline">Voir tout</Link>
          </div>
          {announcements.isLoading ? <div className="flex justify-center py-8"><Spinner /></div> :
            announcements.data?.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">Aucune annonce</p> :
            <div className="space-y-3">
              {announcements.data.map(a => (
                <div key={a.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-slate-900 text-sm">{a.title}</h3>
                    {a.pinned && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Épinglée</span>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{a.content}</p>
                </div>
              ))}
            </div>
          }
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-brand-700" /> Raccourcis</h2>
          <div className="space-y-2">
            {SHORTCUTS.filter(s => canAccess(role, s.page)).map(s => {
              const Icon = s.icon
              return (
                <Link key={s.to} to={s.to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                  <Icon size={18} className={s.color} />
                  <span className="text-sm font-medium text-slate-700">{s.label(role)}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
