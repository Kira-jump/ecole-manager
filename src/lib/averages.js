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

// Moyennes par matière + moyenne générale (pondérée par le coefficient de chaque matière)
export const computeAverages = (grades, subjects) => {
  const bySubject = new Map()
  for (const g of grades) {
    if (!bySubject.has(g.subject_id)) bySubject.set(g.subject_id, [])
    bySubject.get(g.subject_id).push(g)
  }
  const rows = [...bySubject.entries()]
    .map(([subject_id, list]) => {
      const subj = subjects?.find(s => s.id === subject_id)
      return {
        subject_id,
        name: subj?.name ?? list[0]?.subject_name ?? '—',
        coef: Number(subj?.default_coefficient) || 1,
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
