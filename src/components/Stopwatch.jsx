import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/LanguageProvider.jsx'
import { pad2, splitDuration } from '../utils/time.js'

function formatLap(ms) {
  const { h, m, s, cs } = splitDuration(ms)
  return `${h > 0 ? `${h}:` : ''}${pad2(m)}:${pad2(s)}.${pad2(cs)}`
}

export default function Stopwatch() {
  const { t } = useI18n()
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [laps, setLaps] = useState([])
  const startRef = useRef(0)

  useEffect(() => {
    if (!running) return undefined

    let frame = 0
    const loop = () => {
      setElapsed(performance.now() - startRef.current)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [running])

  const duration = splitDuration(elapsed)
  const started = elapsed > 0

  function toggle() {
    if (running) {
      setRunning(false)
      return
    }
    startRef.current = performance.now() - elapsed
    setRunning(true)
  }

  function reset() {
    setRunning(false)
    setElapsed(0)
    setLaps([])
  }

  function recordLap() {
    setLaps((current) => {
      const previousTotal = current.length ? current[0].total : 0
      return [
        { n: current.length + 1, total: elapsed, split: elapsed - previousTotal },
        ...current,
      ]
    })
  }

  return (
    <div className="stopwatch">
      <div className="stopwatch-display">
        <span>
          {duration.h > 0 ? `${duration.h}:${pad2(duration.m)}` : pad2(duration.m)}
        </span>
        <span className="stopwatch-colon">:</span>
        <span>{pad2(duration.s)}</span>
        <span className="stopwatch-cs">.{pad2(duration.cs)}</span>
      </div>

      <p className={`run-status${running ? ' is-running' : ''}`}>
        <span className="status-dot" aria-hidden="true" />
        {t(running ? 'running' : started ? 'paused' : 'ready')}
      </p>

      <div className="button-row">
        <button type="button" className="btn btn--primary btn--lg" onClick={toggle}>
          {t(running ? 'pause' : started ? 'resume' : 'start')}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--lg"
          onClick={recordLap}
          disabled={!running && !started}
        >
          {t('lap')}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--lg"
          onClick={reset}
          disabled={!started}
        >
          {t('reset')}
        </button>
      </div>

      {laps.length > 0 && (
        <div className="laps" aria-label={t('recordedLaps')}>
          <div className="lap-row lap-row--head">
            <span>{t('lapLabel')}</span>
            <span>{t('splitLabel')}</span>
            <span>{t('totalLabel')}</span>
          </div>
          {laps.map((lap) => (
            <div className="lap-row" key={lap.n}>
              <span className="lap-index">#{pad2(lap.n)}</span>
              <span>{formatLap(lap.split)}</span>
              <span className="lap-total">{formatLap(lap.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
