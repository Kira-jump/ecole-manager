// Qui peut ouvrir quelle page : une seule source de vérité
// (menu latéral, routes protégées et raccourcis du tableau de bord).
// Pour modifier un accès, il suffit de changer la liste ci-dessous.
const FOUNDERS = ['fondateur', 'directeur_general']
const PEDAGOGY = [...FOUNDERS, 'directeur_etudes', 'coordinateur']
const EVERYONE = [...PEDAGOGY, 'surveillant_general', 'comptable', 'professeur', 'eleve']

export const ACCESS = {
  dashboard: EVERYONE,
  users: FOUNDERS,
  classes: [...PEDAGOGY, 'professeur'],
  gradeSheet: [...PEDAGOGY, 'professeur'],
  subjects: PEDAGOGY,
  students: [...PEDAGOGY, 'surveillant_general', 'comptable', 'professeur'],
  teachers: PEDAGOGY,
  grades: [...PEDAGOGY, 'professeur', 'eleve'],
  attendance: [...PEDAGOGY, 'surveillant_general', 'professeur', 'eleve'],
  announcements: EVERYONE,
  settings: EVERYONE,
}

export const canAccess = (role, page) => ACCESS[page]?.includes(role) ?? false

// Qui peut faire l'appel (le comptable et l'élève consultent seulement)
export const canTakeAttendance = (role) => [...PEDAGOGY, 'surveillant_general', 'professeur'].includes(role)
