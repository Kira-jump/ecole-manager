import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { isTeacher } from './roles'
import { getClasses, getClassesForTeacher, getTeacherByProfileId } from './db'

/**
 * Classes visibles par l'utilisateur connecté :
 * - professeur : uniquement les classes où il a une affectation
 * - autres rôles : toutes les classes
 */
export function useMyClasses({ enabled = true } = {}) {
  const { profile } = useAuth()
  const teacher = isTeacher(profile?.role)

  const myTeacher = useQuery({
    queryKey: ['my-teacher', profile?.id],
    enabled: enabled && teacher,
    queryFn: () => getTeacherByProfileId(profile.id),
  })

  return useQuery({
    queryKey: ['my-classes', profile?.role, myTeacher.data?.id ?? null],
    enabled: enabled && (!teacher || !!myTeacher.data?.id),
    queryFn: () => (teacher ? getClassesForTeacher(myTeacher.data.id) : getClasses()),
  })
}
