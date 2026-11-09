import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/LanguageProvider.jsx'
import { pad2 } from '../utils/time.js'

const PRESETS = [
  { minutes: 1, seconds: 60 },
  { minutes: 5, seconds: 300 },
  { minutes: 10, seconds: 600 },
  { minutes: 25, seconds: 1500 },
]

const RADIUS = 104
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function totalFromInputs(inputs) {
  return inputs.h * 3600 + inputs.m * 60 + inputs.s
}

function inputsFromSeconds(seconds) {
  return {
    h: Math.floor(seconds / 3600),
    m: Math.floor((seconds % 3600) / 60),
    s: seconds % 60,
  }
}

function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const start = ctx.currentTime
    ;[0, 0.4, 0.8].forEach((offset) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, start + offset)
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.28, start + offset + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.32)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.34)
    })
    window.setTimeout(() => ctx.close(), 1800)
  } catch {
    /* Audio is a nice-to-have; ignore blocked contexts. */
  }
}

export default function CountdownTimer() {
  const { t } = useI18n()
  const [inputs, setInputs] = useState({ h: 0, m: 5, s: 0 })
  const [remaining, setRemaining] = useState(300)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const endRef = useRef(0)

  const inputTotal = totalFromInputs(inputs)
  const denominator = Math.max(inputTotal, 1)
  const progress = Math.min(1, Math.max(0, remaining / denominator))
  const hasPartialProgress = remaining > 0 && remaining < inputTotal - 0.05
  const displaySeconds = Math.ceil(remaining)
  const displayH = Math.floor(displaySeconds / 3600)
  const displayM = Math.floor((displaySeconds % 3600) / 60)
  const displayS = displaySeconds % 60

  useEffect(() => {
    if (!running) return undefined

    const tick = () => {
      const left = Math.max(0, (endRef.current - Date.now()) / 1000)
      setRemaining(left)
      if (left <= 0) {
        setRunning(false)
        setFinished(true)
        playChime()
      }
    }

    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [running])

  function updateInput(unit, rawValue) {
    const max = unit === 'h' ? 99 : 59
    const value = Math.max(0, Math.min(max, Math.floor(Number(rawValue) || 0)))
    const next = { ...inputs, [unit]: value }
    setInputs(next)
    if (!running) {
      setRemaining(totalFromInputs(next))
      setFinished(false)
    }
  }

  function applyPreset(seconds) {
    setInputs(inputsFromSeconds(seconds))
    if (!running) {
      setRemaining(seconds)
      setFinished(false)
    }
  }

  function toggle() {
    if (running) {
      setRemaining(Math.max(0, (endRef.current - Date.now()) / 1000))
      setRunning(false)
      return
    }

    const base = remaining > 0.05 ? remaining : inputTotal
    if (base <= 0) return
    endRef.current = Date.now() + base * 1000
    setFinished(false)
    setRunning(true)
  }

  function reset() {
    setRunning(false)
    setFinished(false)
    setRemaining(inputTotal)
  }

  return (
    <div className="timer">
      <div className={`timer-ring${finished ? ' is-finished' : ''}${running ? ' is-running' : ''}`}>
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <circle className="ring-bg" cx="120" cy="120" r={RADIUS} />
          <circle
            className="ring-fg"
            cx="120"
            cy="120"
            r={RADIUS}
            stroke="url(#timerGradient)"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <div className="timer-readout">
          <span className="timer-time">
            {displayH > 0 ? `${displayH}:${pad2(displayM)}` : pad2(displayM)}
            <span className="timer-colon">:</span>
            {pad2(displayS)}
          </span>
          <span className="timer-label">
            {finished ? t('timeIsUp') : running ? t('countingDown') : hasPartialProgress ? t('paused') : t('ready')}
          </span>
        </div>
      </div>

      <div className="timer-controls">
        <div className="timer-inputs" role="group" aria-label={t('timerSetDuration')}>
          <label className="timer-field">
            <input
              type="number"
              min="0"
              max="99"
              value={inputs.h}
              onChange={(event) => updateInput('h', event.target.value)}
              disabled={running}
              aria-label={t('timerHours')}
            />
            <span>{t('timerHours')}</span>
          </label>
          <span className="timer-field-sep" aria-hidden="true">
            :
          </span>
          <label className="timer-field">
            <input
              type="number"
              min="0"
              max="59"
              value={inputs.m}
              onChange={(event) => updateInput('m', event.target.value)}
              disabled={running}
              aria-label={t('timerMinutes')}
            />
            <span>{t('timerMinutes')}</span>
          </label>
          <span className="timer-field-sep" aria-hidden="true">
            :
          </span>
          <label className="timer-field">
            <input
              type="number"
              min="0"
              max="59"
              value={inputs.s}
              onChange={(event) => updateInput('s', event.target.value)}
              disabled={running}
              aria-label={t('timerSeconds')}
            />
            <span>{t('timerSeconds')}</span>
          </label>
        </div>

        <div className="preset-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              type="button"
              className="preset-chip"
              onClick={() => applyPreset(preset.seconds)}
              disabled={running}
            >
              {t('presetMinutes', { n: preset.minutes })}
            </button>
          ))}
        </div>

        <div className="button-row">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={toggle}
            disabled={inputTotal <= 0 && remaining <= 0}
          >
            {t(running ? 'pause' : hasPartialProgress ? 'resume' : 'start')}
          </button>
          <button type="button" className="btn btn--ghost btn--lg" onClick={reset}>
            {t('reset')}
          </button>
        </div>

        <p className="timer-hint">{t('timerHint')}</p>
      </div>
    </div>
  )
}
