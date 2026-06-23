export const ROLES = {
  fondateur: { label: 'Fondateur', color: 'bg-purple-100 text-purple-700' },
  directeur_general: { label: 'Directeur Général', color: 'bg-indigo-100 text-indigo-700' },
  directeur_etudes: { label: 'Directeur des Études', color: 'bg-blue-100 text-blue-700' },
  coordinateur: { label: 'Coordinateur', color: 'bg-cyan-100 text-cyan-700' },
  surveillant_general: { label: 'Surveillant Général', color: 'bg-amber-100 text-amber-700' },
  comptable: { label: 'Comptable', color: 'bg-emerald-100 text-emerald-700' },
  professeur: { label: 'Professeur', color: 'bg-sky-100 text-sky-700' },
  eleve: { label: 'Élève', color: 'bg-slate-100 text-slate-700' },
}

export const ROLE_LIST = Object.keys(ROLES)
export const roleLabel = (r) => ROLES[r]?.label ?? r
export const roleColor = (r) => ROLES[r]?.color ?? 'bg-slate-100 text-slate-700'

export const isAdmin = (role) => ['fondateur', 'directeur_general'].includes(role)
export const isStaff = (role) => ['fondateur', 'directeur_general', 'directeur_etudes', 'coordinateur', 'surveillant_general', 'comptable'].includes(role)
export const isPedagogy = (role) => ['fondateur', 'directeur_general', 'directeur_etudes', 'coordinateur'].includes(role)
export const isTeacher = (role) => role === 'professeur'
export const isStudent = (role) => role === 'eleve'
export const canManageDiscipline = (role) => ['fondateur', 'directeur_general', 'surveillant_general'].includes(role)
