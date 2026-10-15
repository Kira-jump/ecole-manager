// Périodes d'évaluation : trimestres (primaire) ou semestres (collège / lycée)
export const TERMS = [
  { value: 'trimestre_1', label: 'Trimestre 1' },
  { value: 'trimestre_2', label: 'Trimestre 2' },
  { value: 'trimestre_3', label: 'Trimestre 3' },
  { value: 'semestre_1', label: 'Semestre 1' },
  { value: 'semestre_2', label: 'Semestre 2' },
]

export const termsForLevel = (level) => {
  if (level === 'maternelle' || level === 'primaire') return TERMS.filter(t => t.value.startsWith('trimestre'))
  if (level) return TERMS.filter(t => t.value.startsWith('semestre'))
  return TERMS
}
