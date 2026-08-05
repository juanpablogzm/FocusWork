import { useCallback, useEffect, useRef, useState } from 'react'
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
  focusSeconds: 0,
  workStart: '',
  workEnd: '',
  readyLeadMin: 30,
})

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    return { ...defaultData(), ...JSON.parse(raw) }
  } catch {
    return defaultData()
  }
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage no disponible (privado/bloqueado): solo en memoria
  }
}

function useLocalData() {
  const [data, setData] = useState(loadData)
  const update = useCallback((patch) => {
    setData((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      saveData(next)
      return next
    })
  }, [])
  return [data, update]
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
  const [data, update] = useLocalData()
  const [toast, setToast] = useState(null)
  const [nextStretch, setNextStretch] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('focuswork:dark') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('focuswork:dark', dark ? '1' : '0')
    } catch {}
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const notify = useCallback((msg) => {
    setToast(msg)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('FocusWork', { body: msg })
    }
  }, [])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  // Stretch timer
  useEffect(() => {
    if (!data.stretchEnabled || !nextStretch) return
    const delay = nextStretch - Date.now()
    if (delay <= 0) return
    const t = setTimeout(() => {
      notify('Toca levantarte y estirarte un momento. Tu cuerpo lo agradece. 🧘')
      setNextStretch(null)
    }, delay)
    return () => clearTimeout(t)
  }, [nextStretch, data.stretchEnabled, notify])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(t)
  }, [toast])

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
          <button className="icon-btn" onClick={() => setDark((d) => !d)} title="Cambiar tema">
            {dark ? '☀' : '🌙'}
          </button>
          <button className="icon-btn" onClick={toggleFullscreen} title="Pantalla completa">
            {isFullscreen ? '⤢' : '⛶'}
          </button>
          <button className="icon-btn strong" onClick={openSettings}>⚙</button>
        </div>
      </div>

      {toast && <Toast text={toast} onClose={() => setToast(null)} />}

      <main className="stage">
        <PlantStage progress={progress} data={data} now={now} />
        <div className="widgets">
          <Quote />
          <UpNext now={now} nextMeeting={nextMeeting} />
        </div>
      </main>

      {showSettings && (
        <SettingsPanel
          data={data}
          now={now}
          onClose={() => setShowSettings(false)}
          update={update}
          startStretch={() => {
            setNextStretch(Date.now() + data.stretchInterval * 60 * 1000)
            notify(`Te recordaré estirarte cada ${data.stretchInterval} minutos.`)
          }}
          nextStretch={nextStretch}
        />
      )}
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

function SettingsPanel({ data, now, update, onClose, startStretch, nextStretch }) {
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
          <h3>🧘 Momentos de descanso</h3>
          <StretchSettings
            values={{ interval: data.stretchInterval, enabled: data.stretchEnabled }}
            onInterval={(v) => update((p) => ({ ...p, stretchInterval: v }))}
            onToggle={() => update((p) => ({ ...p, stretchEnabled: !p.stretchEnabled }))}
            onStart={startStretch}
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

function StretchSettings({ values, onInterval, onToggle, onStart, nextStretch }) {
  return (
    <div className="stretch">
      <div className="stretch-row">
        <button onClick={onStart} className="btn-secondary">▶ Iniciar recordatorio</button>
        <button onClick={onToggle} className="btn-secondary">{values.enabled ? 'Desactivar' : 'Activar'}</button>
      </div>
      <label className="stretch-label">
        Cada <select className="select" value={values.interval} onChange={(e) => onInterval(Number(e.target.value))}>
          <option value={30}>30</option>
          <option value={45}>45</option>
          <option value={60}>60</option>
          <option value={90}>90</option>
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