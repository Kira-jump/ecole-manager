// Niveaux scolaires et sections de maternelle
export const LEVELS = [
  { value: 'maternelle', label: 'Maternelle' },
  { value: 'primaire', label: 'Primaire' },
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' },
]

export const SECTIONS = [
  { value: 'petite', label: 'Petite section' },
  { value: 'moyenne', label: 'Moyenne section' },
  { value: 'grande', label: 'Grande section' },
]

// Ex : "Maternelle – Petite section" ou "Collège"
export const levelLabel = (cls) => {
  const lvl = LEVELS.find(l => l.value === cls?.level)?.label ?? ''
  const sec = SECTIONS.find(s => s.value === cls?.section)?.label
  return sec ? `${lvl} – ${sec}` : lvl
}
