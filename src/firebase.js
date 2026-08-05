import { useEffect, useRef, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut } from 'firebase/auth'
import { getDatabase, off, onValue, ref, set } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnabled =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.databaseURL) &&
  Boolean(firebaseConfig.projectId)

export const gsiClientId = import.meta.env.VITE_FIREBASE_WEB_CLIENT_ID || ''

export function loadGSIScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('no se pudo cargar Google Identity Services'))
    document.head.appendChild(s)
  })
}

let app = null
let auth = null
let database = null

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  database = getDatabase(app)
}

export function useAuth() {
  const [user, setUser] = useState(() => (auth ? auth.currentUser : null))
  const [loading, setLoading] = useState(auth ? true : false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!auth) return
    let cancelled = false
    const unsub = onAuthStateChanged(auth, (u) => {
      if (cancelled) return
      setUser(u)
      setLoading(false)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const signIn = async (idToken) => {
    if (!auth) return
    setError(null)
    try {
      const credential = GoogleAuthProvider.credential(idToken)
      const result = await signInWithCredential(auth, credential)
      setUser(result.user)
    } catch (err) {
      setError(err?.code ?? err?.message ?? String(err))
    }
  }

  const signOutUser = async () => {
    if (auth) await signOut(auth)
  }

  return { user, loading, error, signIn, signOutUser, firebaseEnabled, loadGSIScript }
}

export function useFirebaseState(uid, fallback) {
  const [state, setState] = useState(fallback)
  const [ready, setReady] = useState(false)
  const writing = useRef(false)
  const cached = useRef(null)

  useEffect(() => {
    if (!database || !uid) {
      setState(fallback)
      setReady(true)
      return
    }

    const dbRef = ref(database, `users/${uid}/state`)
    cached.current = null
    writing.current = false
    setReady(false)

    const unsub = onValue(dbRef, (snap) => {
      if (writing.current) return
      const remote = snap.val()
      cached.current = remote
      setState(remote ?? fallback)
      setReady(true)
    })

    return () => off(dbRef, 'value', unsub)
  }, [uid, fallback])

  const update = (patch) => {
    setState((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      if (database && uid) {
        writing.current = true
        set(ref(database, `users/${uid}/state`), next)
          .then(() => {
            writing.current = false
            cached.current = next
          })
          .catch(() => {
            writing.current = false
            setState(cached.current ?? next)
          })
      }
      return next
    })
  }

  return { state, ready, update }
}
