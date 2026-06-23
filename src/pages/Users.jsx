import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Copy, Check, Power, Search } from 'lucide-react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { useToast } from '../contexts/ToastContext'
import { getProfiles, toggleProfileActive, createUserRecord, getClasses } from '../lib/db'
import { ROLES, ROLE_LIST, roleLabel, roleColor } from '../lib/roles'
import { auth } from '../lib/firebase'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

// Génère un faux email interne pour les élèves
function matriculeToEmail(matricule) {
  return `${matricule.toLowerCase().replace(/[^a-z0-9]/g, '-')}@ecole-manager.local`
}

const blank = {
  email: '', first_name: '', last_name: '', role: 'professeur',
  phone: '', matricule: '', class_id: '', specialization: '',
  birth_date: '', gender: '', parent_name: '', parent_phone: '',
}

export default function Users() {
  const toast = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [submitting, setSubmitting] = useState(false)
  const [createdUser, setCreatedUser] = useState(null)
  const [copied, setCopied] = useState(false)

  const profiles = useQuery({
    queryKey: ['profiles', search],
    queryFn: () => getProfiles(search),
  })

  const classes = useQuery({
    queryKey: ['classes-all'],
    queryFn: getClasses,
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const tempPassword = generatePassword()
      const isStudent = form.role === 'eleve'
      const isTeacher = form.role === 'professeur'
      const needsMatricule = isStudent || isTeacher

      const matricule = form.matricule ||
        (isStudent ? 'EL' : 'PR') + '-' + Date.now().toString().slice(-6)

      // Pour les élèves : faux email interne, pour le staff : vrai email
      const authEmail = isStudent ? matriculeToEmail(matricule) : form.email

      // Créer le compte Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, authEmail, tempPassword)
      const uid = cred.user.uid

      // Créer le profil + sous-table Firestore
      await createUserRecord(
        uid,
        {
          email: isStudent ? null : form.email,
          auth_email: authEmail, // email interne utilisé pour auth
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone || null,
        },
        form.role,
        isStudent ? {
          matricule,
          class_id: form.class_id || null,
          birth_date: form.birth_date || null,
          gender: form.gender || null,
          parent_name: form.parent_name || null,
          parent_phone: form.parent_phone || null,
        } : isTeacher ? {
          matricule,
          specialization: form.specialization || null,
        } : {}
      )

      setCreatedUser({
        email: isStudent ? null : form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
        matricule: needsMatricule ? matricule : null,
        temporary_password: tempPassword,
      })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    } catch (err) {
      toast.error(err?.message ?? 'Création échouée')
    } finally {
      setSubmitting(false)
    }
  }

  const closeAll = () => {
    setOpen(false)
    setCreatedUser(null)
    setForm(blank)
    setCopied(false)
  }

  const copyCreds = () => {
    if (!createdUser) return
    const isStudent = createdUser.role === 'eleve'
    const lines = [
      'Identifiants École Manager',
      '─────────────────────────',
      `Nom : ${createdUser.first_name} ${createdUser.last_name}`,
      isStudent
        ? `Matricule : ${createdUser.matricule}`
        : `Email : ${createdUser.email}`,
      `Mot de passe : ${createdUser.temporary_password}`,
      '',
      '⚠️ À changer dès la première connexion.',
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const toggleActive = async (p) => {
    try {
      await toggleProfileActive(p.id, !p.active)
      toast.success(p.active ? 'Compte désactivé' : 'Compte réactivé')
      qc.invalidateQueries({ queryKey: ['profiles'] })
    } catch (err) { toast.error(err.message) }
  }

  const isStudentRole = form.role === 'eleve'
  const isTeacherRole = form.role === 'professeur'

  return (
    <div>
      <PageHeader
        title="Comptes & accès"
        description="Crée et gère les comptes utilisateurs"
        actions={
          <button onClick={() => setOpen(true)} className="btn-primary">
            <UserPlus size={16} /> Créer un compte
          </button>
        }
      />

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {profiles.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : profiles.data?.length === 0 ? (
          <EmptyState title="Aucun utilisateur" description="Crée le premier compte." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Utilisateur</th>
                  <th className="table-th">Contact</th>
                  <th className="table-th">Rôle</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.data.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
                          {(p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{p.first_name} {p.last_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-slate-600 text-sm">
                      {p.email ?? <span className="text-slate-400 italic">Sans email</span>}
                    </td>
                    <td className="table-td">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleColor(p.role)}`}>
                        {roleLabel(p.role)}
                      </span>
                    </td>
                    <td className="table-td">
                      {p.active
                        ? <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Actif</span>
                        : <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">Désactivé</span>}
                    </td>
                    <td className="table-td text-right">
                      <button onClick={() => toggleActive(p)} className="btn-ghost text-xs" title={p.active ? 'Désactiver' : 'Réactiver'}>
                        <Power size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={closeAll} title={createdUser ? '✅ Compte créé' : 'Créer un compte'} size="lg"
        footer={createdUser ? (
          <button onClick={closeAll} className="btn-primary">Terminé</button>
        ) : (
          <>
            <button onClick={closeAll} className="btn-secondary">Annuler</button>
            <button type="submit" form="user-form" className="btn-primary" disabled={submitting}>
              {submitting ? <Spinner size="sm" className="border-white border-t-transparent" /> : <UserPlus size={16} />}
              Créer
            </button>
          </>
        )}
      >
        {createdUser ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900 font-medium">⚠️ Transmets ces identifiants — ils ne seront plus visibles ensuite.</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Nom</p>
                <p className="font-medium">{createdUser.first_name} {createdUser.last_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Rôle</p>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${roleColor(createdUser.role)}`}>{roleLabel(createdUser.role)}</span>
              </div>
              {createdUser.role === 'eleve' ? (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Matricule (identifiant)</p>
                  <p className="font-mono text-sm bg-slate-50 px-3 py-2 rounded">{createdUser.matricule}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Email</p>
                  <p className="font-mono text-sm bg-slate-50 px-3 py-2 rounded">{createdUser.email}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Mot de passe temporaire</p>
                <p className="font-mono text-sm bg-slate-50 px-3 py-2 rounded">{createdUser.temporary_password}</p>
              </div>
            </div>
            <button onClick={copyCreds} className="btn-secondary w-full">
              {copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier les identifiants</>}
            </button>
          </div>
        ) : (
          <form id="user-form" onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Prénom *</label>
                <input className="input" required value={form.first_name} onChange={e => setField('first_name', e.target.value)} /></div>
              <div><label className="label">Nom *</label>
                <input className="input" required value={form.last_name} onChange={e => setField('last_name', e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Rôle *</label>
                <select className="input" value={form.role} onChange={e => setField('role', e.target.value)}>
                  {ROLE_LIST.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
                </select></div>
              <div><label className="label">Téléphone</label>
                <input className="input" value={form.phone} onChange={e => setField('phone', e.target.value)} /></div>
            </div>

            {/* Email seulement pour le staff */}
            {!isStudentRole && (
              <div><label className="label">Email *</label>
                <input className="input" type="email" required={!isStudentRole} value={form.email} onChange={e => setField('email', e.target.value)}
                  placeholder="nom@ecole.com" /></div>
            )}

            {/* Matricule pour élève et prof */}
            {(isStudentRole || isTeacherRole) && (
              <div><label className="label">Matricule</label>
                <input className="input" value={form.matricule} onChange={e => setField('matricule', e.target.value)}
                  placeholder="Laisser vide pour auto-génération" /></div>
            )}

            {isStudentRole && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase">Détails élève</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="label">Classe</label>
                    <select className="input" value={form.class_id} onChange={e => setField('class_id', e.target.value)}>
                      <option value="">— Aucune —</option>
                      {classes.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></div>
                  <div><label className="label">Sexe</label>
                    <select className="input" value={form.gender} onChange={e => setField('gender', e.target.value)}>
                      <option value="">—</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select></div>
                </div>
                <div><label className="label">Date de naissance</label>
                  <input type="date" className="input" value={form.birth_date} onChange={e => setField('birth_date', e.target.value)} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="label">Nom du parent</label>
                    <input className="input" value={form.parent_name} onChange={e => setField('parent_name', e.target.value)} /></div>
                  <div><label className="label">Tél. parent</label>
                    <input className="input" value={form.parent_phone} onChange={e => setField('parent_phone', e.target.value)} /></div>
                </div>
              </div>
            )}

            {isTeacherRole && (
              <div className="pt-2 border-t border-slate-100">
                <label className="label">Spécialisation</label>
                <input className="input" value={form.specialization} onChange={e => setField('specialization', e.target.value)}
                  placeholder="Ex : Mathématiques, Français…" />
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  )
}
