// Fonction serveur Vercel : réinitialise le mot de passe d'un compte (réservé à la direction).
// Nécessite la variable d'environnement FIREBASE_SERVICE_ACCOUNT (contenu JSON de la clé de service).
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { canResetPassword, generatePassword } from './_lib/reset.js'

function initAdmin() {
  if (getApps().length) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT manquante')
  initializeApp({ credential: cert(JSON.parse(raw)) })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  try {
    initAdmin()

    // 1. Qui appelle ? (jeton de connexion Firebase)
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Non connecté' })
    let caller
    try {
      caller = await getAuth().verifyIdToken(token, true)
    } catch {
      return res.status(401).json({ error: 'Session invalide, reconnecte-toi.' })
    }

    // 2. Quel compte cible ?
    const uid = req.body?.uid
    if (!uid || typeof uid !== 'string') return res.status(400).json({ error: 'Compte cible manquant' })

    // 3. Droits : lus dans Firestore (jamais fournis par le navigateur)
    const db = getFirestore()
    const [callerSnap, targetSnap] = await Promise.all([
      db.doc(`profiles/${caller.uid}`).get(),
      db.doc(`profiles/${uid}`).get(),
    ])
    if (!callerSnap.exists || callerSnap.data().active === false) {
      return res.status(403).json({ error: 'Accès refusé' })
    }
    if (!targetSnap.exists) return res.status(404).json({ error: 'Compte introuvable' })

    const check = canResetPassword({
      callerRole: callerSnap.data().role,
      targetRole: targetSnap.data().role,
      sameUser: uid === caller.uid,
    })
    if (!check.ok) return res.status(check.status).json({ error: check.error })

    // 4. Lectures d'abord (si elles échouent, rien n'a encore changé)
    let matricule = null
    if (targetSnap.data().role === 'eleve') {
      const s = await db.collection('students').where('profile_id', '==', uid).limit(1).get()
      matricule = s.empty ? null : (s.docs[0].data().matricule ?? null)
    }

    // 5. Drapeau en premier : si la suite échoue, l'ancien mot de passe reste valable
    const password = generatePassword()
    await db.doc(`profiles/${uid}`).update({
      must_change_password: true,
      password_reset_at: FieldValue.serverTimestamp(),
      password_reset_by: caller.uid,
    })

    // 6. Nouveau mot de passe, puis déconnexion des sessions ouvertes
    await getAuth().updateUser(uid, { password })
    try {
      await getAuth().revokeRefreshTokens(uid)
    } catch (e) {
      // Le mot de passe est déjà changé : on le renvoie quand même à l'admin
      console.error('reset-password: révocation des sessions échouée', e)
    }

    return res.status(200).json({ password, matricule })
  } catch (err) {
    console.error('reset-password', err)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}
