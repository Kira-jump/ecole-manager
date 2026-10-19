// Moyenne pondérée par le coefficient de chaque évaluation
export const weightedAverage = (grades) => {
  let sum = 0
  let coefs = 0
  for (const g of grades) {
    const v = Number(g.value)
    const c = Number(g.coefficient) || 1
    if (Number.isNaN(v)) continue
    sum += v * c
    coefs += c
  }
  return coefs ? sum / coefs : null
}

// Table « matière → coefficient » pour une classe, à partir de ses lignes class_subjects
export const buildCoefMap = (rows) =>
  new Map((rows ?? []).map(r => [r.subject_id ?? r.id, Number(r.coefficient)]))

// Moyennes par matière + moyenne générale.
// Coefficient d'une matière : celui de la classe (classCoefs) s'il existe, sinon le défaut de la matière.
export const computeAverages = (grades, subjects, classCoefs = null) => {
  const bySubject = new Map()
  for (const g of grades) {
    if (!bySubject.has(g.subject_id)) bySubject.set(g.subject_id, [])
    bySubject.get(g.subject_id).push(g)
  }
  const rows = [...bySubject.entries()]
    .map(([subject_id, list]) => {
      const subj = subjects?.find(s => s.id === subject_id)
      const fromClass = classCoefs instanceof Map ? classCoefs.get(subject_id) : classCoefs?.[subject_id]
      return {
        subject_id,
        name: subj?.name ?? list[0]?.subject_name ?? '—',
        coef: Number(fromClass) || Number(subj?.default_coefficient) || 1,
        count: list.length,
        average: weightedAverage(list),
      }
    })
    .filter(r => r.average !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
  const totalCoef = rows.reduce((n, r) => n + r.coef, 0)
  const general = totalCoef ? rows.reduce((n, r) => n + r.average * r.coef, 0) / totalCoef : null
  return { rows, general }
}
