import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

function matriculeToEmail(matricule) {
  return `${matricule.toLowerCase().replace(/[^a-z0-9]/g, '-')}@ecole-manager.local`
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() })
        } else {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred
  }

  // Le matricule devient un faux email interne (même règle que Users.jsx à la création du compte).
  // Pas de recherche dans Firestore : l'élève n'est pas encore connecté, les règles la refuseraient.
  const signInWithMatricule = (matricule, password) =>
    signIn(matriculeToEmail(matricule), password)

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (!user) return
    const snap = await getDoc(doc(db, 'profiles', user.uid))
    if (snap.exists()) setProfile({ id: snap.id, ...snap.data() })
  }

  const changePassword = async (newPassword) => {
    if (!user) throw new Error('Non connecté')
    await updatePassword(user, newPassword)
    await updateDoc(doc(db, 'profiles', user.uid), { must_change_password: false })
    await refreshProfile()
  }

  return (
    <AuthContext.Provider value={{
      session: user ? { user } : null,
      user,
      profile,
      loading,
      signIn,
      signInWithMatricule,
      signOut,
      refreshProfile,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider')
  return ctx
}
