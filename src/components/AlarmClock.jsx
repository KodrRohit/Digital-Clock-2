import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/LanguageProvider.jsx'
import { pad2 } from '../utils/time.js'
import { ALARM_SOUNDS, playAlarmSound } from '../utils/alarmSounds.js'
import { getCustomSound, listCustomSounds, saveCustomSound } from '../utils/audioStore.js'

const STORAGE_KEY = 'chronos.alarms'
const SNOOZE_MS = 5 * 60 * 1000
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const SOUND_IDS = new Set(ALARM_SOUNDS.map((sound) => sound.id))
const SOUND_LABEL_KEYS = {
  chime: 'alarmSoundChime',
  bell: 'alarmSoundBell',
  digital: 'alarmSoundDigital',
  gentle: 'alarmSoundGentle',
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTimeKey(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function getDefaultTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  return `${pad2(date.getHours())}:00`
}

function isTimeValue(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function normalizeAlarm(raw) {
  if (!raw || typeof raw !== 'object' || !isTimeValue(raw.time)) return null

  const sound =
    raw.sound === 'custom' ? 'custom' : SOUND_IDS.has(raw.sound) ? raw.sound : 'chime'

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId(),
    time: raw.time,
    label: typeof raw.label === 'string' ? raw.label.slice(0, 60) : '',
    enabled: raw.enabled !== false,
    repeat: Boolean(raw.repeat),
    sound,
    customSoundId: typeof raw.customSoundId === 'string' ? raw.customSoundId : '',
    lastFired: typeof raw.lastFired === 'string' ? raw.lastFired : '',
    snoozeUntil: Number.isFinite(raw.snoozeUntil) ? raw.snoozeUntil : 0,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
  }
}

function loadAlarms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeAlarm).filter(Boolean)
  } catch {
    return []
  }
}

/** Splits an HH:MM value into display parts, honouring the 12/24-hour setting. */
function getAlarmParts(value, hour12, am, pm) {
  const [rawHour, rawMinute] = value.split(':').map(Number)
  const hour = hour12 ? rawHour % 12 || 12 : rawHour
  return {
    hour: pad2(hour),
    minute: pad2(rawMinute),
    suffix: hour12 ? (rawHour < 12 ? am : pm) : '',
  }
}

function formatAlarmTime(value, hour12, am, pm) {
  const parts = getAlarmParts(value, hour12, am, pm)
  return `${parts.hour}:${parts.minute}${parts.suffix ? ` ${parts.suffix}` : ''}`
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.7 7.7 0 0 1 0 11" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 14.5v4.2a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-4.2" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l.9 12.2h8.2L17 7M10.5 11v4.5M13.5 11v4.5" />
    </svg>
  )
}

export default function AlarmClock({ now, hour12 = false }) {
  const { t } = useI18n()
  const [alarms, setAlarms] = useState(loadAlarms)
  const [time, setTime] = useState(getDefaultTime)
  const [label, setLabel] = useState('')
  const [sound, setSound] = useState('chime')
  const [repeat, setRepeat] = useState(true)
  const [customSounds, setCustomSounds] = useState([])
  const [ringingId, setRingingId] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')

  const ringingRef = useRef(null)
  const soundStopRef = useRef(null)
  const previewStopRef = useRef(null)
  const previewTimerRef = useRef(0)
  const snoozeButtonRef = useRef(null)
  const fileInputRef = useRef(null)

  const ringing = ringingId ? (alarms.find((alarm) => alarm.id === ringingId) ?? null) : null

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms))
    } catch {
      /* Persistence is optional. */
    }
  }, [alarms])

  useEffect(() => {
    let alive = true
    listCustomSounds()
      .then((sounds) => {
        if (alive) setCustomSounds(sounds)
      })
      .catch(() => {
        /* Uploaded sounds are optional; the built-in presets still work. */
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(
    () => () => {
      soundStopRef.current?.()
      soundStopRef.current = null
      previewStopRef.current?.()
      previewStopRef.current = null
      if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!ringing) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    snoozeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [ringing])

  // Fire the next due alarm once per minute (or when a snooze expires).
  useEffect(() => {
    if (!now || ringingRef.current) return
    const dateKey = toDateKey(now)
    const nowMinute = toTimeKey(now)
    const nowMs = now.getTime()

    const due = alarms.find((alarm) => {
      if (alarm.snoozeUntil) return nowMs >= alarm.snoozeUntil
      if (!alarm.enabled) return false
      return alarm.time === nowMinute && alarm.lastFired !== `${dateKey}|${alarm.time}`
    })
    if (!due) return

    const firedKey = `${dateKey}|${due.time}`
    ringingRef.current = due.id
    setRingingId(due.id)
    stopPreview()
    setAlarms((current) =>
      current.map((alarm) =>
        alarm.id === due.id
          ? {
              ...alarm,
              snoozeUntil: 0,
              lastFired: firedKey,
              // One-time alarms switch off as soon as they ring. Snooze still works.
              enabled: alarm.repeat ? alarm.enabled : false,
            }
          : alarm,
      ),
    )
    playForAlarm(due)
  }, [now, alarms])

  function stopCurrentSound() {
    soundStopRef.current?.()
    soundStopRef.current = null
  }

  function stopPreview() {
    previewStopRef.current?.()
    previewStopRef.current = null
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current)
      previewTimerRef.current = 0
    }
    setPreviewing(false)
  }

  async function playForAlarm(alarm) {
    stopCurrentSound()
    let blob = null

    if (alarm.sound === 'custom' && alarm.customSoundId) {
      try {
        const record = await getCustomSound(alarm.customSoundId)
        blob = record?.blob ?? null
      } catch {
        blob = null
      }
    }

    if (ringingRef.current !== alarm.id) return

    const handle =
      alarm.sound === 'custom' && !blob
        ? playAlarmSound({ sound: 'chime' })
        : playAlarmSound({ sound: alarm.sound, blob })
    soundStopRef.current = handle?.stop ?? null
  }

  function silenceAlarm() {
    stopCurrentSound()
    stopPreview()
    ringingRef.current = null
    setRingingId(null)
  }

  function snoozeAlarm() {
    const id = ringingRef.current
    if (!id) return
    const until = Date.now() + SNOOZE_MS
    setAlarms((current) =>
      current.map((alarm) => (alarm.id === id ? { ...alarm, snoozeUntil: until } : alarm)),
    )
    silenceAlarm()
  }

  function dismissAlarm() {
    const id = ringingRef.current
    if (!id) return
    setAlarms((current) =>
      current.map((alarm) =>
        alarm.id === id
          ? {
              ...alarm,
              snoozeUntil: 0,
              enabled: alarm.repeat ? alarm.enabled : false,
            }
          : alarm,
      ),
    )
    silenceAlarm()
  }

  function addAlarm(event) {
    event.preventDefault()
    if (!isTimeValue(time)) return

    const customSoundId = sound.startsWith('custom:') ? sound.slice('custom:'.length) : ''
    const soundId = customSoundId ? 'custom' : sound
    const sameMinute = time === toTimeKey(now)
    const alarm = {
      id: makeId(),
      time,
      label: label.trim().slice(0, 60),
      enabled: true,
      repeat,
      sound: soundId,
      customSoundId,
      lastFired: sameMinute ? `${toDateKey(now)}|${time}` : '',
      snoozeUntil: 0,
      createdAt: Date.now(),
    }

    setAlarms((current) => [...current, alarm])
    setLabel('')
    setTime(getDefaultTime())
    setError('')
  }

  function toggleAlarm(id) {
    setAlarms((current) =>
      current.map((alarm) => {
        if (alarm.id !== id) return alarm
        if (alarm.enabled) {
          return { ...alarm, enabled: false, snoozeUntil: 0 }
        }
        const sameMinute = alarm.time === toTimeKey(now)
        return {
          ...alarm,
          enabled: true,
          snoozeUntil: 0,
          lastFired: sameMinute ? `${toDateKey(now)}|${alarm.time}` : '',
        }
      }),
    )
  }

  function removeAlarm(id) {
    setAlarms((current) => current.filter((alarm) => alarm.id !== id))
  }

  function soundValueForAlarm(alarm) {
    if (alarm.sound === 'custom' && alarm.customSoundId) {
      return `custom:${alarm.customSoundId}`
    }
    return alarm.sound
  }

  function soundLabel(alarm) {
    if (alarm.sound === 'custom') {
      const found = customSounds.find((entry) => entry.id === alarm.customSoundId)
      return found?.name ?? t('alarmSoundCustom')
    }
    return t(SOUND_LABEL_KEYS[alarm.sound] ?? 'alarmSoundChime')
  }

  async function previewSound(value) {
    if (ringingRef.current) return
    if (previewing) {
      stopPreview()
      return
    }

    stopPreview()
    const customSoundId = value.startsWith('custom:') ? value.slice('custom:'.length) : ''
    let blob = null

    if (customSoundId) {
      try {
        const record = await getCustomSound(customSoundId)
        blob = record?.blob ?? null
      } catch {
        blob = null
      }
    }

    const handle = blob
      ? playAlarmSound({ blob })
      : playAlarmSound({ sound: customSoundId ? 'chime' : value })
    if (!handle) return

    previewStopRef.current = handle.stop
    setPreviewing(true)
    previewTimerRef.current = window.setTimeout(stopPreview, 2400)
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('alarmFileTooLarge'))
      return
    }
    if (file.type && !file.type.startsWith('audio/')) {
      setError(t('alarmFileError'))
      return
    }

    try {
      const saved = await saveCustomSound(file)
      setCustomSounds((current) => [...current, saved])
      setSound(`custom:${saved.id}`)
      setError('')
    } catch {
      setError(t('alarmFileError'))
    }
  }

  const ordered = alarms.slice().sort((a, b) => a.time.localeCompare(b.time) || b.createdAt - a.createdAt)
  const am = t('am')
  const pm = t('pm')

  return (
    <div className="alarm">
      <form className="alarm-form" onSubmit={addAlarm}>
        <label className="alarm-field alarm-field--time">
          <span className="alarm-field-label">{t('alarmTime')}</span>
          <input
            className="alarm-time-input"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
            aria-label={t('alarmTime')}
          />
        </label>

        <label className="alarm-field alarm-field--label">
          <span className="alarm-field-label">{t('alarmLabel')}</span>
          <input
            className="alarm-text-input"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('alarmLabelPlaceholder')}
            maxLength={60}
            aria-label={t('alarmLabel')}
          />
        </label>

        <label className="alarm-field alarm-field--sound">
          <span className="alarm-field-label">{t('alarmSound')}</span>
          <span className="alarm-select-wrap">
            <select
              className="alarm-select"
              value={sound}
              onChange={(event) => setSound(event.target.value)}
              aria-label={t('alarmSound')}
            >
              {ALARM_SOUNDS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {t(entry.labelKey)}
                </option>
              ))}
              {customSounds.map((entry) => (
                <option key={entry.id} value={`custom:${entry.id}`}>
                  {entry.name}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="alarm-repeat">
          <input
            type="checkbox"
            checked={repeat}
            onChange={(event) => setRepeat(event.target.checked)}
          />
          <span className="alarm-repeat-track" aria-hidden="true">
            <span className="alarm-repeat-thumb" />
          </span>
          <span className="alarm-repeat-text">{t('alarmRepeat')}</span>
        </label>

        <div className="alarm-form-actions">
          <button
            type="button"
            className="btn btn--ghost alarm-test"
            onClick={() => previewSound(sound)}
            disabled={Boolean(ringing)}
          >
            <SpeakerIcon />
            {previewing ? t('alarmStop') : t('alarmTest')}
          </button>
          <button type="submit" className="btn btn--primary alarm-add">
            <span aria-hidden="true">+</span> {t('alarmAdd')}
          </button>
        </div>
      </form>

      <div className="alarm-upload-row">
        <input
          ref={fileInputRef}
          className="alarm-file-input"
          type="file"
          accept="audio/*"
          onChange={handleUpload}
          aria-label={t('alarmUpload')}
        />
        <button
          type="button"
          className="btn btn--ghost btn--sm alarm-upload"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon />
          {t('alarmUpload')}
        </button>
        <span className="alarm-upload-hint">{t('alarmUploadHint')}</span>
        {error && (
          <span className="alarm-error" role="alert">
            {error}
          </span>
        )}
      </div>

      {ordered.length > 0 ? (
        <ul className="alarm-list">
          {ordered.map((alarm) => {
            const parts = getAlarmParts(alarm.time, hour12, am, pm)
            return (
              <li
                key={alarm.id}
                className={`alarm-card${alarm.enabled ? '' : ' is-off'}${
                  alarm.snoozeUntil ? ' is-snoozed' : ''
                }`}
              >
                <div className="alarm-card-time">
                  <span className="alarm-time-value">
                    {parts.hour}:{parts.minute}
                  </span>
                  {parts.suffix && <span className="alarm-time-suffix">{parts.suffix}</span>}
                </div>

                <div className="alarm-card-info">
                  <span className="alarm-label">{alarm.label || t('alarmUntitled')}</span>
                  <div className="alarm-chips">
                    <span className={`alarm-chip${alarm.repeat ? ' alarm-chip--daily' : ''}`}>
                      {alarm.repeat ? t('alarmDaily') : t('alarmOnce')}
                    </span>
                    <span className="alarm-chip alarm-chip--sound">{soundLabel(alarm)}</span>
                    {alarm.snoozeUntil > 0 && (
                      <span className="alarm-chip alarm-chip--snooze">
                        {t('alarmSnoozed', {
                          time: formatAlarmTime(
                            toTimeKey(new Date(alarm.snoozeUntil)),
                            hour12,
                            am,
                            pm,
                          ),
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="alarm-card-actions">
                  <button
                    type="button"
                    className="alarm-action"
                    onClick={() => previewSound(soundValueForAlarm(alarm))}
                    aria-label={t('alarmTest')}
                    title={t('alarmTest')}
                  >
                    <SpeakerIcon />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alarm.enabled}
                    aria-label={t(alarm.enabled ? 'alarmTurnOff' : 'alarmTurnOn')}
                    title={t(alarm.enabled ? 'alarmTurnOff' : 'alarmTurnOn')}
                    className={`alarm-switch${alarm.enabled ? ' is-on' : ''}`}
                    onClick={() => toggleAlarm(alarm.id)}
                  >
                    <span />
                  </button>
                  <button
                    type="button"
                    className="alarm-action alarm-action--danger"
                    onClick={() => removeAlarm(alarm.id)}
                    aria-label={t('alarmDelete')}
                    title={t('alarmDelete')}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="todo-empty alarm-empty">
          <span className="todo-empty-icon" aria-hidden="true">
            ⏰
          </span>
          <p>{t('alarmEmpty')}</p>
        </div>
      )}

      {ringing &&
        createPortal(
          <div className="alarm-overlay">
            <div
              className="alarm-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="alarm-dialog-title"
              aria-describedby="alarm-dialog-desc"
            >
              <span className="alarm-dialog-icon" aria-hidden="true">
                ⏰
              </span>
              <span className="alarm-dialog-eyebrow">{t('alarmRinging')}</span>
              <h2 id="alarm-dialog-title">
                {formatAlarmTime(ringing.time, hour12, am, pm)}
              </h2>
              <p id="alarm-dialog-desc">{ringing.label || t('alarmUntitled')}</p>
              <span className="alarm-dialog-badge">
                {ringing.repeat ? t('alarmDaily') : t('alarmOnce')}
              </span>
              <div className="alarm-dialog-actions">
                <button
                  ref={snoozeButtonRef}
                  type="button"
                  className="btn btn--ghost btn--lg"
                  onClick={snoozeAlarm}
                >
                  {t('alarmSnooze')}
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={dismissAlarm}
                >
                  {t('alarmDismiss')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
