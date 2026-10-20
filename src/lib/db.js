import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit, setDoc,
  serverTimestamp, getCountFromServer, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

// ─── PROFILES ───────────────────────────────────────────
export const getProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'profiles', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const getProfiles = async (search = '') => {
  const snap = await getDocs(collection(db, 'profiles'))
  let data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (search) {
    const s = search.toLowerCase()
    data = data.filter(p =>
      p.first_name?.toLowerCase().includes(s) ||
      p.last_name?.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s)
    )
  }
  return data.sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
}

export const updateProfile = async (uid, data) => {
  await updateDoc(doc(db, 'profiles', uid), { ...data, updated_at: serverTimestamp() })
}

export const toggleProfileActive = async (uid, active) => {
  await updateDoc(doc(db, 'profiles', uid), { active, updated_at: serverTimestamp() })
}

// ─── SCHOOL YEARS ────────────────────────────────────────
export const getActiveYear = async () => {
  const q = query(collection(db, 'school_years'), where('active', '==', true), limit(1))
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// ─── CLASSES ─────────────────────────────────────────────
export const getClasses = async () => {
  const snap = await getDocs(query(collection(db, 'classes'), orderBy('name')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getClassesForTeacher = async (teacherId) => {
  // Récupère toutes les affectations du prof
  const q = query(collection(db, 'teaching_assignments'), where('teacher_id', '==', teacherId))
  const snap = await getDocs(q)
  const classIds = [...new Set(snap.docs.map(d => d.data().class_id))]
  if (!classIds.length) return []

  // Récupère les classes correspondantes
  const allClasses = await getClasses()
  return allClasses.filter(c => classIds.includes(c.id))
}

export const createClass = async (data) => {
  await addDoc(collection(db, 'classes'), { ...data, created_at: serverTimestamp() })
}

export const updateClass = async (id, data) => {
  await updateDoc(doc(db, 'classes', id), data)
}

export const deleteClass = async (id) => {
  await deleteDoc(doc(db, 'classes', id))
}

// ─── SUBJECTS ────────────────────────────────────────────
export const getSubjects = async () => {
  const snap = await getDocs(query(collection(db, 'subjects'), orderBy('name')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const createSubject = async (data) => {
  await addDoc(collection(db, 'subjects'), { ...data, created_at: serverTimestamp() })
}

export const updateSubject = async (id, data) => {
  await updateDoc(doc(db, 'subjects', id), data)
}

export const deleteSubject = async (id) => {
  // Retire aussi la matière de toutes les classes où elle était utilisée
  const links = await getDocs(query(collection(db, 'class_subjects'), where('subject_id', '==', id)))
  const batch = writeBatch(db)
  links.docs.forEach(d => batch.delete(d.ref))
  batch.delete(doc(db, 'subjects', id))
  await batch.commit()
}

// ─── MATIÈRES PAR CLASSE (coefficient propre à chaque classe) ───
// Une matière du catalogue existe une seule fois ; chaque classe la « relie » avec son coefficient.
// L'id fixe classe_matière empêche les doublons.
export const getClassSubjects = async (classId) => {
  const snap = await getDocs(query(collection(db, 'class_subjects'), where('class_id', '==', classId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getAllClassSubjects = async () => {
  const snap = await getDocs(collection(db, 'class_subjects'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const setClassSubject = async (classId, subjectId, coefficient) => {
  const coef = Number(coefficient)
  if (!(coef > 0)) throw new Error('Le coefficient doit être supérieur à 0')
  await setDoc(doc(db, 'class_subjects', `${classId}_${subjectId}`), {
    class_id: classId, subject_id: subjectId, coefficient: coef, updated_at: serverTimestamp(),
  }, { merge: true })
}

export const removeClassSubject = async (classId, subjectId) => {
  await deleteDoc(doc(db, 'class_subjects', `${classId}_${subjectId}`))
}

// Copie les matières (et coefficients) d'une classe vers une autre, sans toucher à celles déjà présentes
export const copyClassSubjects = async (fromClassId, toClassId) => {
  const [source, existing] = await Promise.all([getClassSubjects(fromClassId), getClassSubjects(toClassId)])
  const have = new Set(existing.map(e => e.subject_id))
  const toAdd = source.filter(s => !have.has(s.subject_id))
  if (!toAdd.length) return 0
  const batch = writeBatch(db)
  for (const s of toAdd) {
    batch.set(doc(db, 'class_subjects', `${toClassId}_${s.subject_id}`), {
      class_id: toClassId, subject_id: s.subject_id, coefficient: s.coefficient, updated_at: serverTimestamp(),
    })
  }
  await batch.commit()
  return toAdd.length
}

// ─── STUDENTS ────────────────────────────────────────────
export const getStudents = async (classFilter = '', classIds = null) => {
  const col = collection(db, 'students')
  let data
  if (classFilter) {
    // Une classe précise : on ne lit QUE les élèves de cette classe
    if (classIds && !classIds.includes(classFilter)) return []
    const snap = await getDocs(query(col, where('class_id', '==', classFilter)))
    data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } else if (classIds) {
    // Plusieurs classes (ex. celles d'un prof) : Firestore limite 'in' à 30 valeurs, on découpe
    if (!classIds.length) return []
    const chunks = []
    for (let i = 0; i < classIds.length; i += 30) chunks.push(classIds.slice(i, i + 30))
    const snaps = await Promise.all(chunks.map(c => getDocs(query(col, where('class_id', 'in', c)))))
    data = snaps.flatMap(sn => sn.docs.map(d => ({ id: d.id, ...d.data() })))
  } else {
    // Toute l'école : réservé au personnel autorisé par les règles Firestore
    const snap = await getDocs(query(col, orderBy('matricule')))
    data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  // Tri par matricule ici (évite un index composite côté Firestore)
  data.sort((a, b) => ((a.matricule ?? '') < (b.matricule ?? '') ? -1 : (a.matricule ?? '') > (b.matricule ?? '') ? 1 : 0))

  const enriched = await Promise.all(data.map(async (s) => {
    if (!s.profile_id) return s
    try {
      const pSnap = await getDoc(doc(db, 'profiles', s.profile_id))
      if (pSnap.exists()) {
        const p = pSnap.data()
        return { ...s, first_name: p.first_name ?? '', last_name: p.last_name ?? '', email: p.email ?? null }
      }
    } catch(e) {}
    return s
  }))
  return enriched
}

export const getStudentByProfileId = async (profileId) => {
  const q = query(collection(db, 'students'), where('profile_id', '==', profileId), limit(1))
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export const updateStudent = async (id, data) => {
  await updateDoc(doc(db, 'students', id), data)
}

// ─── TEACHERS ────────────────────────────────────────────
export const getTeachers = async () => {
  const snap = await getDocs(query(collection(db, 'teachers'), orderBy('matricule')))
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return Promise.all(data.map(async (t) => {
    if (!t.profile_id) return t
    try {
      const pSnap = await getDoc(doc(db, 'profiles', t.profile_id))
      if (pSnap.exists()) {
        const p = pSnap.data()
        return { ...t, first_name: p.first_name ?? '', last_name: p.last_name ?? '', email: p.email ?? null, phone: p.phone ?? null }
      }
    } catch (e) {}
    return t
  }))
}

export const getTeacherByProfileId = async (profileId) => {
  const q = query(collection(db, 'teachers'), where('profile_id', '==', profileId), limit(1))
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// ─── TEACHING ASSIGNMENTS ────────────────────────────────
export const getAssignments = async (teacherId) => {
  const q = query(collection(db, 'teaching_assignments'), where('teacher_id', '==', teacherId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const addAssignment = async (data) => {
  await addDoc(collection(db, 'teaching_assignments'), { ...data, created_at: serverTimestamp() })
}

export const deleteAssignment = async (id) => {
  await deleteDoc(doc(db, 'teaching_assignments', id))
}

// ─── GRADES ──────────────────────────────────────────────
export const getGrades = async ({ classFilter, subjectFilter, termFilter, studentId, teacherId } = {}) => {
  const col = collection(db, 'grades')
  // Filtres d'égalité envoyés à Firestore (pas d'index composite nécessaire) :
  // on ne lit que les notes demandées, jamais « toute l'école puis on trie ».
  const wheres = []
  if (classFilter) wheres.push(where('class_id', '==', classFilter))
  if (subjectFilter) wheres.push(where('subject_id', '==', subjectFilter))
  if (termFilter) wheres.push(where('term', '==', termFilter))
  if (studentId) wheres.push(where('student_id', '==', studentId))
  if (teacherId) wheres.push(where('teacher_id', '==', teacherId))

  if (!wheres.length) {
    // Aucun filtre : 500 dernières notes de l'école (réservé au personnel autorisé)
    const snap = await getDocs(query(col, orderBy('date', 'desc'), limit(500)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  const dkey = (v) => (typeof v === 'string' ? v : v?.toDate ? v.toDate().toISOString().slice(0, 10) : '')
  const snap = await getDocs(query(col, ...wheres))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => dkey(b.date).localeCompare(dkey(a.date)))
    .slice(0, 500)
}

export const addGrade = async (data) => {
  await addDoc(collection(db, 'grades'), { ...data, created_at: serverTimestamp() })
}

// Enregistre plusieurs notes d'un coup (tout ou rien)
export const addGradesBulk = async (list) => {
  const batch = writeBatch(db)
  list.forEach(g => batch.set(doc(collection(db, 'grades')), { ...g, created_at: serverTimestamp() }))
  await batch.commit()
}

// Fiche de notes : matières affectées à une classe, notes d'un mois, enregistrement groupé
export const getClassAssignments = async (classId) => {
  const snap = await getDocs(query(collection(db, 'teaching_assignments'), where('class_id', '==', classId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getSheetGrades = async (classId, month) => {
  const snap = await getDocs(query(collection(db, 'grades'), where('class_id', '==', classId), where('month', '==', month)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const saveGradeSheet = async ({ sets, deletes }) => {
  const batch = writeBatch(db)
  sets.forEach(({ id, data }) => batch.set(doc(db, 'grades', id), { ...data, updated_at: serverTimestamp() }, { merge: true }))
  deletes.forEach(id => batch.delete(doc(db, 'grades', id)))
  await batch.commit()
}

export const deleteGrade = async (id) => {
  await deleteDoc(doc(db, 'grades', id))
}

// ─── ATTENDANCE ──────────────────────────────────────────
export const getAttendanceForClass = async (classId, date) => {
  const students = await getStudents(classId)
  if (!students.length) return []
  const ids = students.map(s => s.id)
  // Firestore limite 'in' à 30 valeurs : on découpe en paquets
  const chunks = []
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
  const snaps = await Promise.all(chunks.map(chunk => getDocs(query(
    collection(db, 'attendance'),
    where('date', '==', date),
    where('student_id', 'in', chunk)
  ))))
  const attMap = {}
  snaps.forEach(snap => snap.docs.forEach(d => { attMap[d.data().student_id] = { id: d.id, ...d.data() } }))
  return students.map(s => ({ ...s, attendance: attMap[s.id] ?? null }))
}

export const setAttendance = async (studentId, date, status, recordedBy) => {
  const q = query(
    collection(db, 'attendance'),
    where('student_id', '==', studentId),
    where('date', '==', date),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) {
    await addDoc(collection(db, 'attendance'), {
      student_id: studentId, date, status,
      recorded_by: recordedBy, created_at: serverTimestamp()
    })
  } else {
    await updateDoc(doc(db, 'attendance', snap.docs[0].id), { status, recorded_by: recordedBy })
  }
}

export const justifyAbsence = async (studentId, date, reason, justifiedBy) => {
  const q = query(
    collection(db, 'attendance'),
    where('student_id', '==', studentId),
    where('date', '==', date),
    limit(1)
  )
  const snap = await getDocs(q)
  if (!snap.empty) {
    await updateDoc(doc(db, 'attendance', snap.docs[0].id), {
      status: 'justified', justification: reason, justified_by: justifiedBy
    })
  }
}

export const getMyAttendance = async (studentId) => {
  // Pas d'orderBy côté Firestore (évite un index composite) : le tri se fait ici
  const q = query(collection(db, 'attendance'), where('student_id', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 100)
}

// ─── ANNOUNCEMENTS ───────────────────────────────────────
export const getAnnouncements = async () => {
  const snap = await getDocs(query(collection(db, 'announcements'), orderBy('created_at', 'desc'), limit(100)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const addAnnouncement = async (data) => {
  await addDoc(collection(db, 'announcements'), { ...data, created_at: serverTimestamp() })
}

export const deleteAnnouncement = async (id) => {
  await deleteDoc(doc(db, 'announcements', id))
}

export const togglePinned = async (id, pinned) => {
  await updateDoc(doc(db, 'announcements', id), { pinned })
}

// ─── STATS DASHBOARD ─────────────────────────────────────
export const countStudentsInClasses = async (classIds) => {
  if (!classIds.length) return 0
  const chunks = []
  for (let i = 0; i < classIds.length; i += 30) chunks.push(classIds.slice(i, i + 30))
  const snaps = await Promise.all(chunks.map(ch =>
    getCountFromServer(query(collection(db, 'students'), where('class_id', 'in', ch)))
  ))
  return snaps.reduce((n, s) => n + s.data().count, 0)
}

export const getDashboardStats = async () => {
  const [students, teachers, classes, subjects] = await Promise.all([
    getCountFromServer(collection(db, 'students')),
    getCountFromServer(collection(db, 'teachers')),
    getCountFromServer(collection(db, 'classes')),
    getCountFromServer(collection(db, 'subjects')),
  ])
  return {
    students: students.data().count,
    teachers: teachers.data().count,
    classes: classes.data().count,
    subjects: subjects.data().count,
  }
}

// ─── CREATE USER (côté admin) ────────────────────────────
export const createUserRecord = async (uid, profileData, role, extraData) => {
  await setDoc(doc(db, 'profiles', uid), {
    ...profileData,
    role,
    active: true,
    must_change_password: true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  })
  if (role === 'eleve') {
    await addDoc(collection(db, 'students'), {
      profile_id: uid,
      email: profileData.email,
      ...extraData,
      created_at: serverTimestamp(),
    })
  } else if (role === 'professeur') {
    await addDoc(collection(db, 'teachers'), {
      profile_id: uid,
      ...extraData,
      created_at: serverTimestamp(),
    })
  }
}
