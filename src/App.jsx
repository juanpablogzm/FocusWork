import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useFirebaseState, gsiClientId, loadGSIScript } from './firebase.js'
import pkg from '../package.json'
import './App.css'

const STORAGE_KEY = 'focuswork:data'

const QUOTES = [
  'Pequeños pasos cada día crean grandes resultados.',
  'La disciplina pesa gramos, el arrepentimiento toneladas.',
  'Hazlo hoy, tu yo del futuro te lo agradecerá.',
  'Concéntrate en progresar, no en ser perfecto.',
  'Cada momento enfocado suma a tu meta.',
  'Descansa también es parte de trabajar bien.',
  'Respira, prioriza y sigue. Tú puedes.',
  'Menos distracciones, más propósito.',
  'Fluye con calma, como el agua.',
  'Tu energía despierta tu buena suerte.',
]

const defaultData = () => ({
  meetings: [],
  stretchInterval: 60,
  stretchEnabled: true,
  restMinutes: 5,
  focusSeconds: 0,
  workStart: '',
  workEnd: '',
  readyLeadMin: 30,
  dark: false,
  nextStretch: null,
  resting: null,
  soundEnabled: true,
})

function saveLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage no disponible (privado/bloqueado): solo en memoria
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    return { ...defaultData(), ...JSON.parse(raw) }
  } catch {
    return defaultData()
  }
}

function normalizeData(d) {
  const merged = { ...defaultData(), ...(d ?? {}) }
  if (!Array.isArray(merged.meetings)) merged.meetings = []
  return merged
}

// Timbre de notificación generado con Web Audio API (no requiere archivos de audio)
let audioCtx = null
function ensureAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    audioCtx ??= new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    audioCtx = null
  }
  return audioCtx
}
function playNotes(notes, { type = 'sine', vol = 0.3, gap = 0.16 } = {}) {
  try {
    const ctx = ensureAudio()
    if (!ctx) return
    const t0 = ctx.currentTime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      const t = t0 + i * gap
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.5)
    })
  } catch {
    // Sin soporte de audio: la notificación visual sigue funcionando
  }
}

// Sonidos por evento: reuniones/avisos, inicio de descanso y fin de descanso
function playChime() {
  playNotes([523.25, 659.25, 783.99])
}
function playRestStart() {
  playNotes([659.25, 783.99, 987.77], { type: 'triangle', gap: 0.2 })
}
function playRestEnd() {
  playNotes([783.99, 659.25, 523.25], { type: 'triangle', gap: 0.2 })
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

// iOS Safari no expone el API de pantalla completa para la página (solo videos).
function supportsFullscreen() {
  return typeof document !== 'undefined' && typeof document.documentElement?.requestFullscreen === 'function'
}

// Ejecutándose como PWA (agregada a pantalla de inicio): ya ocupa toda la pantalla
function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  return (
    window.navigator.standalone === true ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
  )
}

// Calcula el timestamp de la próxima ocurrencia de una reunión después de `after`
function nextOccurrence(m, after) {
  const base = new Date(m.datetime)
  const baseTime = base.getTime()
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const weekday = days[m.weekday ?? base.getDay()]

  if (!m.recur || m.recur === 'none') {
    return baseTime >= after ? baseTime : null
  }

  // Buscamos en una ventana futura razonable (próximos 180 días)
  const hh = base.getHours()
  const mm = base.getMinutes()
  for (let i = 0; i < 180; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    // Para weekly, solo el día de la semana correspondiente
    if (m.recur === 'weekly') {
      const dName = days[d.getDay()]
      if (dName !== weekday) continue
    }
    if (m.recur === 'monthly') {
      if (d.getDate() !== base.getDate()) continue
    }
    const cand = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime()
    if (cand >= after) return cand
  }
  return null
}

export default function App() {
  const now = useNow()
  const { user, error: authError, signIn, signOutUser, firebaseEnabled } = useAuth()
  const fallback = useMemo(() => normalizeData(loadData()), [])
  const { state, update: firebaseUpdate } = useFirebaseState(user?.uid, fallback)
  const data = useMemo(() => normalizeData(state), [state])

  const update = useCallback(
    (patch) => {
      firebaseUpdate((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
        saveLocal(next)
        return next
      })
    },
    [firebaseUpdate],
  )

  const [toast, setToast] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // El descanso vive en `data` para sincronizarse también en Firebase entre dispositivos
  const nextStretch = data.nextStretch
  const resting = data.resting
  const setNextStretch = useCallback((v) => update({ nextStretch: v || null }), [update])
  const setResting = useCallback((v) => update({ resting: v || null }), [update])

  const dark = data.dark

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Los navegadores bloquean el audio hasta que el usuario interactúa al menos una vez
  useEffect(() => {
    const unlock = () => ensureAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const notify = useCallback(
    (msg, sound = 'chime') => {
      setToast(msg)
      if (data.soundEnabled) {
        if (sound === 'rest-start') playRestStart()
        else if (sound === 'rest-end') playRestEnd()
        else playChime()
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('FocusWork', { body: msg })
      }
    },
    [data.soundEnabled],
  )

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const onFs = () => setIsFullscreen(supportsFullscreen() ? !!document.fullscreenElement : isStandalonePwa())
    document.addEventListener('fullscreenchange', onFs)
    window.addEventListener('resize', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      window.removeEventListener('resize', onFs)
    }
  }, [])

  const toggleFullscreen = () => {
    if (isStandalonePwa()) return
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
      return
    }
    if (supportsFullscreen()) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      return
    }
    // iOS Safari no soporta el API de pantalla completa → guía a modo PWA
    notify('En iPhone/iPad abre el menú Compartir → “Agregar a pantalla de inicio” y así FocusWork ocupará toda la pantalla. 📲')
  }

  const finishRest = useCallback(() => {
    setResting(null)
    if (document.fullscreenElement) document.exitFullscreen?.()
    setNextStretch(Date.now() + data.stretchInterval * 60 * 1000)
    notify('Descanso completado. Volvamos a concentrarnos. 🌿', 'rest-end')
  }, [data.stretchInterval, notify, setNextStretch, setResting])

  // Stretch timer: automático, se reprograma al inicio o al cambiar la config
  const scheduledInterval = useRef(null)
  useEffect(() => {
    if (!data.stretchEnabled || resting) return
    const nowMs = Date.now()
    let target = nextStretch
    if (!target || target <= nowMs || scheduledInterval.current !== data.stretchInterval) {
      scheduledInterval.current = data.stretchInterval
      target = nowMs + data.stretchInterval * 60 * 1000
      setNextStretch(target)
      return
    }
    const t = setTimeout(() => {
      setNextStretch(null)
      scheduledInterval.current = null
      setResting(Date.now() + data.restMinutes * 60 * 1000)
      document.documentElement.requestFullscreen?.().catch(() => {})
      notify('Toca levantarte y estirarte un momento. Tu cuerpo lo agradece. 🧘', 'rest-start')
    }, target - nowMs)
    return () => clearTimeout(t)
  }, [nextStretch, data.stretchEnabled, data.stretchInterval, data.restMinutes, resting, notify, setNextStretch, setResting])

  // Rest countdown → finish & reschedule
  useEffect(() => {
    if (!resting) return
    if (Date.now() >= resting) {
      setResting(null)
      if (document.fullscreenElement) document.exitFullscreen?.()
      setNextStretch(Date.now() + data.stretchInterval * 60 * 1000)
      notify('Descanso completado. Volvamos a concentrarnos. 🌿', 'rest-end')
    }
  }, [resting, now, data.stretchInterval, notify, setNextStretch, setResting])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(t)
  }, [toast])

  // Persistir la cuenta regresiva para que sobreviva recargas (p. ej. al cambiar tema)
  // Si vino de Firebase un timestamp vencido (p. ej. otro dispositivo), se limpia
  useEffect(() => {
    if (nextStretch && nextStretch <= Date.now()) setNextStretch(null)
    if (resting && resting <= Date.now()) setResting(null)
  }, [nextStretch, resting, setNextStretch, setResting])

  // Meeting alerts
  function *happeningMeetings(nowMs) {
    const seen = new Map()
    for (const m of data.meetings) {
      // Barrido del día anterior al próximo día para no perder nada
      for (let off = -1; off <= 6; off++) {
        const a = new Date(nowMs)
        a.setDate(a.getDate() + off)
        const start = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0).getTime()
        const t = nextOccurrence(m, start)
        if (t == null) continue
        const dist = t - nowMs
        if (dist >= 0 && dist < 5 * 60 * 1000 && !seen.has(m.id + ':' + t)) {
          seen.set(m.id + ':' + t, true)
          yield { m, t }
        }
      }
    }
  }

  const alerted = useRef(new Set())
  useEffect(() => {
    const nowMs = Date.now()
    for (const { m, t } of happeningMeetings(nowMs)) {
      const key = m.id + ':' + t
      if (alerted.current.has(key)) continue
      alerted.current.add(key)
      const minutes = Math.max(0, Math.round((t - nowMs) / 60000))
      notify(`${m.title} · inicia en ${minutes} min`)
    }
  }, [now, data.meetings, notify])

  // Work schedule: ready-to-leave alert
  const workAlerted = useRef({})
  useEffect(() => {
    if (!data.workEnd) return
    const nowMs = Date.now()
    const [eh, em] = data.workEnd.split(':').map(Number)
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em).getTime()
    const lead = data.readyLeadMin * 60 * 1000
    const diff = endTime - nowMs
    if (diff > 0 && diff <= lead) {
      const key = endTime
      if (workAlerted.current[key]) return
      workAlerted.current[key] = true
      const minutes = Math.max(0, Math.round(diff / 60000))
      notify(`Prepárate para salir en ${minutes} min. Buen trabajo hoy ✨`)
    }
  }, [now, data.workEnd, data.readyLeadMin, notify])

  let best = null
  for (let off = 0; off <= 30; off++) {
    const a = new Date()
    a.setDate(a.getDate() + off)
    if (a.getDate() === now.getDate()) a.setTime(now.getTime())
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0).getTime()
    for (const m of data.meetings) {
      const t = nextOccurrence(m, start)
      if (t == null) continue
      if (t >= Date.now() && (!best || t < best.t)) best = { m, t }
    }
  }
  const nextMeeting = best

  // Progreso de la jornada laboral: cuánto llevas de tu horario (entrada → salida)
  function workDayProgress() {
    if (!data.workStart || !data.workEnd) return 0
    const [sh, sm] = data.workStart.split(':').map(Number)
    const [eh, em] = data.workEnd.split(':').map(Number)
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm).getTime()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em).getTime()
    const nowMs = now.getTime()
    if (nowMs <= start) return 0
    if (nowMs >= end) return 1
    return (nowMs - start) / (end - start)
  }
  const workProgress = workDayProgress()
  const progress = workProgress

  const openSettings = () => setShowSettings(true)

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">FocusWork</span>
        <div className="top-actions">
          {user && (
            <UserChip name={user.displayName} photo={user.photoURL} onSignOut={signOutUser} />
          )}
          <button className="icon-btn" onClick={() => update((p) => ({ ...p, dark: !p.dark }))} title="Cambiar tema">
            {dark ? '☀' : '🌙'}
          </button>
          <button className="icon-btn" onClick={toggleFullscreen} title="Pantalla completa">
            {isFullscreen ? '⤢' : '⛶'}
          </button>
          <button className="icon-btn strong" onClick={openSettings}>⚙</button>
        </div>
      </div>

      {toast && <Toast text={toast} onClose={() => setToast(null)} />}

      {resting && <RestOverlay endsAt={resting} total={data.restMinutes * 60} now={now} onFinish={finishRest} />}

      {user ? (
        <>
          <main className="stage">
            <PlantStage progress={progress} data={data} now={now} />
            <div className="widgets">
              <Quote />
              <RestTimer nextStretch={nextStretch} enabled={data.stretchEnabled} intervalMin={data.stretchInterval} now={now} />
              <UpNext now={now} nextMeeting={nextMeeting} />
            </div>
          </main>

          {showSettings && (
            <SettingsPanel
              data={data}
              now={now}
              onClose={() => setShowSettings(false)}
              update={update}
              nextStretch={nextStretch}
            />
          )}
        </>
      ) : (
        <AuthScreen
          firebaseEnabled={firebaseEnabled}
          error={authError}
          onSignIn={signIn}
        />
      )}

      <footer className="footer">FocusWork v{pkg.version}</footer>
    </div>
  )
}

function UserChip({ name, photo, onSignOut }) {
  return (
    <span className="user-chip" title={name}>
      {photo ? <img className="user-avatar" src={photo} alt="" /> : <span className="user-avatar">{name?.[0]}</span>}
      <button className="icon-btn" onClick={onSignOut} title="Cerrar sesión">⎋</button>
    </span>
  )
}

function AuthScreen({ firebaseEnabled, error, onSignIn }) {
  const displayError = error
    ? String(error)
        .replace('Firebase: Error (', '')
        .replace(').', '')
        .replaceAll('auth/', '')
        .replaceAll('-', ' ')
    : ''
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>FocusWork</h1>
        <p>Inicia sesión para sincronizar tus datos en la nube y accederlos desde cualquier dispositivo.</p>
        {firebaseEnabled ? (
          <>
            <GoogleSignInButton clientId={gsiClientId} onToken={onSignIn} />
            {error ? (
              <p className="auth-error">⚠ {displayError}</p>
            ) : (
              <p className="auth-hint">Tus datos se guardan en la nube y se sincronizan entre dispositivos.</p>
            )}
          </>
        ) : (
          <p className="empty">
            Firebase no está configurado. Añade tus credenciales en un archivo <code>.env</code> (ver README).
          </p>
        )}
      </div>
    </div>
  )
}

function GoogleSignInButton({ clientId, onToken }) {
  const containerRef = useRef(null)
  const initedRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!clientId) {
      setError('Falta VITE_FIREBASE_WEB_CLIENT_ID en tu .env')
      return
    }
    let cancelled = false
    loadGSIScript()
      .then(() => {
        if (cancelled || !containerRef.current) return
        if (initedRef.current !== clientId) {
          initedRef.current = clientId
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => onToken(response.credential),
          })
        }
        containerRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
        })
      })
      .catch((e) => setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [clientId, onToken])

  return (
    <div className="gsi-wrap">
      {error ? <p className="auth-error">⚠ {error}</p> : <div ref={containerRef} />}
    </div>
  )
}

function PlantStage({ progress, data, now }) {
  const [sh, sm] = (data.workStart || '0:0').split(':').map(Number)
  const [eh, em] = (data.workEnd || '0:0').split(':').map(Number)
  const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const workPct = Math.round(progress * 100)
  const growth = Math.min(1, data.focusSeconds / (8 * 3600))
  const level = Math.floor(growth * 6)
  const remaining = Math.max(0, 1 - progress)
  const nowH = now.getHours(), nowM = now.getMinutes()

  return (
    <section className="stage-hero">
      <div className="ring-wrap">
        <svg className="ring" viewBox="0 0 320 320">
          <circle className="ring-track" cx="160" cy="160" r="148" />
          <circle
            className="ring-progress"
            cx="160" cy="160" r="148"
            style={{ strokeDashoffset: 930 * (1 - progress) }}
          />
        </svg>
        <Plant level={level} />
        <span className="ring-pct">{workPct}% de tu jornada</span>
      </div>

      <div className="timer">
        <span className="timer-digits">{fmt(nowH, nowM)}</span>
        <span className="timer-label">{data.workStart && data.workEnd ? `Horario ${fmt(sh, sm)} – ${fmt(eh, em)}` : 'Configura tu horario en ⚙ Ajustes'}</span>
      </div>
      {data.workStart && data.workEnd && (
        <p className="focus-total">
          {remaining > 0
            ? `Quedan ${Math.round(remaining * (new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm).getTime()) / 60000)} min de jornada`
            : 'Jornada completada ✨'}
        </p>
      )}
    </section>
  )
}

function Plant({ level }) {
  const scale = 0.7 + level * 0.05
  return (
    <svg className="plant" viewBox="0 0 160 160" aria-hidden="true" style={{ transform: `scale(${scale})` }}>
      <path d="M52 152 L108 152 L100 110 L60 110 Z" fill="#d9b382" />
      <path d="M80 112 C80 108 78 104 80 100" stroke="#9a6f45" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M66 98 q-16 -6 -20 -22 q18 4 20 22z" fill="#4aa37a" />
      <path d="M94 98 q18 -4 22 -20 q-18 0 -22 20z" fill="#3fae84" />
      <path d="M80 88 q-4 -18 2 -30" stroke="#3c8c68" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M74 80 q-20 -8 -24 -24 q20 4 24 24z" fill="#4aa37a" />
      <path d="M88 78 q20 -6 24 -22 q-20 4 -24 22z" fill="#3fae84" />
      <path d="M80 68 q-2 -16 0 -26" stroke="#3c8c68" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M72 56 q-18 -6 -20 -20 q18 2 20 20z" fill="#4aa37a" />
      <path d="M90 54 q18 -4 20 -18 q-18 2 -20 18z" fill="#3fae84" />
      {level >= 5 && <circle cx="81" cy="42" r="6" fill="#ffd977" />}
    </svg>
  )
}

function Quote() {
  const [i, setI] = useState(() => Math.floor(Math.random() * QUOTES.length))
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % QUOTES.length), 20000)
    return () => clearInterval(t)
  }, [])
  return (
    <section className="widget quote">
      <p>“{QUOTES[i]}”</p>
    </section>
  )
}

function UpNext({ now, nextMeeting }) {
  if (!nextMeeting) return null
  const t = new Date(nextMeeting.t)
  const minutes = Math.max(0, Math.round((t.getTime() - now.getTime()) / 60000))
  const today = now.toDateString() === t.toDateString()
  const dayLabel = today
    ? ''
    : t.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
  return (
    <section className="widget upnext">
      <span className="label">Próxima reunión</span>
      <h3>{nextMeeting.m.title}</h3>
      <p>
        {t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        {today && minutes < 30 ? ` · en ${minutes} min` : ''}
        {!today ? ` · ${dayLabel}` : ''}
      </p>
    </section>
  )
}

function RestTimer({ nextStretch, enabled, intervalMin, now }) {
  const remaining = nextStretch != null ? Math.max(0, nextStretch - now.getTime()) : null

  if (!enabled) {
    return (
      <section className="widget rest-timer off">
        <span className="label">Próximo descanso</span>
        <p>Recordatorio desactivado</p>
      </section>
    )
  }

  if (remaining == null) {
    return (
      <section className="widget rest-timer off">
        <span className="label">Próximo descanso</span>
        <p>Programando…</p>
      </section>
    )
  }

  const totalMs = intervalMin * 60 * 1000
  const frac = totalMs > 0 ? remaining / totalMs : 0
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const C = 2 * Math.PI * 74

  return (
    <section className="widget rest-timer">
      <span className="label">Próximo descanso</span>
      <div className="rest-timer-row">
        <div className="rest-mini-wrap">
          <svg className="ring" viewBox="0 0 160 160">
            <circle className="ring-track" cx="80" cy="80" r="74" strokeWidth="10" />
            <circle
              className="ring-progress"
              cx="80" cy="80" r="74" strokeWidth="10"
              strokeDasharray={C}
              strokeDashoffset={C * frac}
            />
          </svg>
          <span className="rest-mini-digits">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
        </div>
        <p className="rest-mini-msg">
          Tiempo que falta para tu pausa. Cuando llegue, levántate, estira y descansa los ojos. 🧘
        </p>
      </div>
    </section>
  )
}

function SettingsPanel({ data, now, update, onClose, nextStretch }) {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 1500)
    return () => clearTimeout(t)
  }, [data])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Ajustes{saved && <span className="saved-hint"> ✓ Guardado</span>}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <section className="panel-section">
          <h3>⏰ Horario laboral</h3>
          <WorkScheduleForm data={data} update={update} />
        </section>

        <section className="panel-section">
          <h3>📅 Reuniones</h3>
          <MeetingForm onAdd={(m) => update((p) => ({ ...p, meetings: [...p.meetings, m] }))} />
          <MeetingList
            meetings={data.meetings}
            now={now}
            onDelete={(id) => update((p) => ({ ...p, meetings: p.meetings.filter((m) => m.id !== id) }))}
          />
        </section>

        <section className="panel-section">
          <h3>🔔 Notificaciones</h3>
          <div className="stretch-row">
            <span className="stretch-info">
              Sonido en recordatorios de descanso, reuniones y avisos. Funciona mejor con la pestaña abierta o la app instalada.
            </span>
            <button
              onClick={() => update((p) => ({ ...p, soundEnabled: !p.soundEnabled, }))}
              className="btn-secondary"
            >
              {data.soundEnabled ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </section>

        <section className="panel-section">
          <h3>🧘 Momentos de descanso</h3>
          <StretchSettings
            values={{ interval: data.stretchInterval, enabled: data.stretchEnabled, rest: data.restMinutes }}
            onInterval={(v) => update((p) => ({ ...p, stretchInterval: v }))}
            onRest={(v) => update((p) => ({ ...p, restMinutes: v }))}
            onToggle={() => update((p) => ({ ...p, stretchEnabled: !p.stretchEnabled }))}
            nextStretch={nextStretch}
          />
        </section>
      </div>
    </div>
  )
}

function WorkScheduleForm({ data, update }) {
  return (
    <div className="work-form">
      <label className="field">
        <span>Entrada</span>
        <input type="time" className="input" value={data.workStart} onChange={(e) => update({ workStart: e.target.value })} />
      </label>
      <label className="field">
        <span>Salida</span>
        <input type="time" className="input" value={data.workEnd} onChange={(e) => update({ workEnd: e.target.value })} />
      </label>
      <label className="field">
        <span>Avisar antes de salir</span>
        <select className="select" value={data.readyLeadMin} onChange={(e) => update({ readyLeadMin: Number(e.target.value) })}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>60 min</option>
        </select>
      </label>
    </div>
  )
}

function MeetingForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [datetime, setDatetime] = useState('')
  const [recur, setRecur] = useState('none')
  const [weekday, setWeekday] = useState('mon')
  const submit = (e) => {
    e.preventDefault()
    if (!title.trim() || !datetime) return
    onAdd({ id: crypto.randomUUID(), title: title.trim(), datetime, recur, weekday })
    setTitle('')
    setDatetime('')
    setRecur('none')
  }
  return (
    <form className="meeting-form" onSubmit={submit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="input" />
      <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="input datetime" />
      <select
        className="select recur"
        value={recur}
        onChange={(e) => setRecur(e.target.value)}
        title="Repetición"
      >
        <option value="none">Una sola vez</option>
        <option value="daily">Todos los días</option>
        <option value="weekly">Todas las semanas</option>
        <option value="monthly">Mismo día del mes</option>
      </select>
      {recur === 'weekly' && (
        <select
          className="select recur"
          value={weekday}
          onChange={(e) => setWeekday(e.target.value)}
          title="Día de la semana"
        >
          <option value="mon">Lunes</option>
          <option value="tue">Martes</option>
          <option value="wed">Miércoles</option>
          <option value="thu">Jueves</option>
          <option value="fri">Viernes</option>
          <option value="sat">Sábado</option>
          <option value="sun">Domingo</option>
        </select>
      )}
      <button type="submit" className="btn-primary">Agregar</button>
    </form>
  )
}

function MeetingList({ meetings, now, onDelete }) {
  if (meetings.length === 0) return <p className="empty">Sin reuniones agendadas.</p>
  const today = now.toDateString()
  const todays = meetings.filter((m) => new Date(m.datetime).toDateString() === today).sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  const others = meetings.filter((m) => new Date(m.datetime).toDateString() !== today).sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  return (
    <div className="meeting-list">
      {todays.length > 0 && <Group title="Hoy" meetings={todays} now={now} onDelete={onDelete} />}
      {others.length > 0 && <Group title="Próximos días" meetings={others} now={now} onDelete={onDelete} />}
    </div>
  )
}

function Group({ title, meetings, now, onDelete }) {
  const recurLabel = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' }
  return (
    <>
      <h3 className="group-title">{title}</h3>
      {meetings.map((m) => {
        const t = new Date(m.datetime)
        const passed = t.getTime() < now.getTime()
        const withinHour = !passed && t.getTime() - now.getTime() < 60 * 60 * 1000
        return (
          <div key={m.id} className={`meeting ${passed ? 'passed' : ''} ${withinHour ? 'soon' : ''}`}>
            <div className="meeting-time">{t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="meeting-body">
              <span className="meeting-title">{m.title}</span>
              {m.recur && m.recur !== 'none' && <span className="badge recur-badge">{recurLabel[m.recur]}</span>}
              {withinHour && <span className="badge">Pronto</span>}
            </div>
            <button className="btn-delete" onClick={() => onDelete(m.id)} aria-label="Eliminar">✕</button>
          </div>
        )
      })}
    </>
  )
}

function StretchSettings({ values, onInterval, onRest, onToggle, nextStretch }) {
  return (
    <div className="stretch">
      <div className="stretch-row">
        <span className="stretch-info">Los recordatorios se activan automáticamente.</span>
        <button onClick={onToggle} className="btn-secondary">{values.enabled ? 'Desactivar' : 'Activar'}</button>
      </div>
      <label className="stretch-label">
        Cada <select className="select" value={values.interval} onChange={(e) => onInterval(Number(e.target.value))}>
          <option value={30}>30</option>
          <option value={45}>45</option>
          <option value={50}>50</option>
          <option value={60}>60</option>
          <option value={90}>90</option>
        </select> minutos
      </label>
      <label className="stretch-label">
        Duración del descanso: <select className="select" value={values.rest} onChange={(e) => onRest(Number(e.target.value))}>
          <option value={3}>3</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
        </select> minutos
      </label>
      {nextStretch && <p className="next-stretch">Próximo descanso en {Math.max(1, Math.round((nextStretch - Date.now()) / 60000))} min</p>}
    </div>
  )
}

function Toast({ text, onClose }) {
  return (
    <div className="toast-outer">
      <div className="toast">
        <p>{text}</p>
        <button onClick={onClose} className="toast-close">✕</button>
      </div>
    </div>
  )
}

function RestOverlay({ endsAt, total, now, onFinish }) {
  const remainingMs = Math.max(0, endsAt - now.getTime())
  const secs = Math.ceil(remainingMs / 1000)
  const mm = Math.floor(secs / 60)
  const ss = secs % 60
  const totalMs = total * 1000
  const frac = totalMs > 0 ? remainingMs / totalMs : 0
  return (
    <div className="rest-overlay">
      <div className="rest-box">
        <div className="rest-ring-wrap">
          <svg className="ring" viewBox="0 0 320 320">
            <circle className="ring-track" cx="160" cy="160" r="148" />
            <circle
              className="ring-progress rest-ring"
              cx="160" cy="160" r="148"
              style={{ strokeDashoffset: 930 * (1 - frac) }}
            />
          </svg>
          <div className="rest-center">
            <span className="rest-digits">{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
            <span className="rest-label">Descanso</span>
          </div>
        </div>
        <h2>Hora de pararte 🧘</h2>
        <p className="rest-msg">Levanta, estírate, respira y mueve un poco el cuerpo. Tómate tu tiempo.</p>
        <button className="btn-primary" onClick={onFinish}>Terminar descanso</button>
      </div>
    </div>
  )
}
