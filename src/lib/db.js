import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit, setDoc,
  serverTimestamp, getCountFromServer,
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
  await deleteDoc(doc(db, 'subjects', id))
}

// ─── STUDENTS ────────────────────────────────────────────
export const getStudents = async (classFilter = '') => {
  let q = query(collection(db, 'students'), orderBy('matricule'))
  const snap = await getDocs(q)
  let data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (classFilter) data = data.filter(s => s.class_id === classFilter)

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
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
  let q = query(collection(db, 'grades'), orderBy('date', 'desc'), limit(500))
  const snap = await getDocs(q)
  let data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (classFilter) data = data.filter(g => g.class_id === classFilter)
  if (subjectFilter) data = data.filter(g => g.subject_id === subjectFilter)
  if (termFilter) data = data.filter(g => g.term === termFilter)
  if (studentId) data = data.filter(g => g.student_id === studentId)
  if (teacherId) data = data.filter(g => g.teacher_id === teacherId)
  return data
}

export const addGrade = async (data) => {
  await addDoc(collection(db, 'grades'), { ...data, created_at: serverTimestamp() })
}

export const deleteGrade = async (id) => {
  await deleteDoc(doc(db, 'grades', id))
}

// ─── ATTENDANCE ──────────────────────────────────────────
export const getAttendanceForClass = async (classId, date) => {
  const students = await getStudents(classId)
  if (!students.length) return []
  const ids = students.map(s => s.id)
  const q = query(
    collection(db, 'attendance'),
    where('date', '==', date),
    where('student_id', 'in', ids.slice(0, 30))
  )
  const snap = await getDocs(q)
  const attMap = {}
  snap.docs.forEach(d => { attMap[d.data().student_id] = { id: d.id, ...d.data() } })
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
  const q = query(
    collection(db, 'attendance'),
    where('student_id', '==', studentId),
    orderBy('date', 'desc'),
    limit(100)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
