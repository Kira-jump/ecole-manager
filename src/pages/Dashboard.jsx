import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { GraduationCap, Users, School, BookOpen, CalendarCheck, Megaphone, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isStaff, isStudent, isTeacher, roleLabel } from '../lib/roles'
import { getDashboardStats, getAnnouncements, getStudentByProfileId, getGrades, getMyAttendance } from '../lib/db'
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

export default function Dashboard() {
  const { profile } = useAuth()
  const role = profile?.role

  const stats = useQuery({ queryKey: ['dashboard-stats'], queryFn: getDashboardStats, enabled: isStaff(role) || isTeacher(role) })
  const announcements = useQuery({
    queryKey: ['recent-announcements'],
    queryFn: async () => {
      const all = await getAnnouncements()
      return all.slice(0, 3)
    },
  })

  const myStudent = useQuery({
    queryKey: ['my-student', profile?.id],
    enabled: isStudent(role),
    queryFn: () => getStudentByProfileId(profile.id),
  })

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

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  })()

  return (
    <div>
      <PageHeader title={`${greeting}, ${profile?.first_name} 👋`} description={`Bienvenue dans ton espace ${roleLabel(role)}`} />

      {(isStaff(role) || isTeacher(role)) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={GraduationCap} label="Élèves" value={stats.data?.students} color="bg-blue-100 text-blue-700" />
          <StatCard icon={Users} label="Enseignants" value={stats.data?.teachers} color="bg-purple-100 text-purple-700" />
          <StatCard icon={School} label="Classes" value={stats.data?.classes} color="bg-emerald-100 text-emerald-700" />
          <StatCard icon={BookOpen} label="Matières" value={stats.data?.subjects} color="bg-amber-100 text-amber-700" />
        </div>
      )}

      {isStudent(role) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ma classe</p>
            <p className="text-xl font-semibold text-slate-900">{myStudent.data?.class_name ?? 'Non assigné'}</p>
            <p className="text-xs text-slate-400 mt-1">Matricule : {myStudent.data?.matricule}</p>
          </div>
          <StatCard icon={BookOpen} label="Notes enregistrées" value={myGrades.data?.length ?? 0} color="bg-amber-100 text-amber-700" />
          <StatCard icon={CalendarCheck} label="Présences enregistrées" value={myAtt.data?.length ?? 0} color="bg-emerald-100 text-emerald-700" />
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
            <Link to="/grades" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
              <BookOpen size={18} className="text-amber-600" />
              <span className="text-sm font-medium text-slate-700">{isStudent(role) ? 'Mes notes' : 'Saisir / consulter notes'}</span>
            </Link>
            <Link to="/attendance" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
              <CalendarCheck size={18} className="text-emerald-600" />
              <span className="text-sm font-medium text-slate-700">{isStudent(role) ? 'Mes présences' : "Faire l'appel"}</span>
            </Link>
            <Link to="/announcements" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
              <Megaphone size={18} className="text-brand-700" />
              <span className="text-sm font-medium text-slate-700">Annonces</span>
            </Link>
            {isStaff(role) && (
              <Link to="/students" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                <GraduationCap size={18} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Liste des élèves</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
