import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDhWVIddwJ9Z0prxJLIR8pFlI6iaPQV0jg",
  authDomain: "ecole-manager-3aad4.firebaseapp.com",
  projectId: "ecole-manager-3aad4",
  storageBucket: "ecole-manager-3aad4.firebasestorage.app",
  messagingSenderId: "921931976798",
  appId: "1:921931976798:web:aa252717bc6a43a026e4cf"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
