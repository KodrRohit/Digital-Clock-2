import { useEffect, useRef, useState } from 'react'
import WorldClocks from './components/WorldClocks.jsx'
import Stopwatch from './components/Stopwatch.jsx'
import CountdownTimer from './components/Timer.jsx'
import AlarmClock from './components/AlarmClock.jsx'
import TodoList from './components/TodoList.jsx'
import { useNow } from './hooks/useNow.js'
import { useI18n } from './i18n/LanguageProvider.jsx'
import { LANGUAGES } from './i18n/translations.js'
import {
  LOCAL_TZ,
  getZoneParts,
  getDisplayTime,
  formatDateLong,
  getOffsetLabel,
  getDayOfYear,
  getDaysInYear,
  getGreetingKey,
} from './utils/time.js'

const TABS = [
  { id: 'world', labelKey: 'tabWorld', hintKey: 'hintWorld', icon: 'globe' },
  { id: 'stopwatch', labelKey: 'tabStopwatch', hintKey: 'hintStopwatch', icon: 'stopwatch' },
  { id: 'timer', labelKey: 'tabTimer', hintKey: 'hintTimer', icon: 'timer' },
  { id: 'alarm', labelKey: 'tabAlarm', hintKey: 'hintAlarm', icon: 'alarm' },
  { id: 'todo', labelKey: 'tabTodo', hintKey: 'hintTodo', icon: 'check' },
]

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Storage can be unavailable (private mode); the UI still works. */
  }
}

function getInitialTheme() {
  const requested = new URLSearchParams(window.location.search).get('theme')
  if (requested === 'light' || requested === 'dark') return requested
  const saved = readStorage('chronos.theme', '')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function getInitialTab() {
  const hash = window.location.hash.replace('#', '')
  return TABS.some((entry) => entry.id === hash) ? hash : 'world'
}

function TabIcon({ name }) {
  if (name === 'globe') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
      </svg>
    )
  }
  if (name === 'stopwatch') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="13.5" r="7.5" />
        <path d="M12 13.5V9.5M9 2.5h6M12 2.5v2M18 6l1.5-1.5" />
      </svg>
    )
  }
  if (name === 'alarm') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.2.9 5.7 2.2 7.2H4.3C5.6 15.7 6.5 14.2 6.5 10Z" />
        <path d="M10 20.2a2.2 2.2 0 0 0 4 0M3 3.8 5.2 2M21 3.8 18.8 2" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5l1.7 1.7L8.7 5M4 13.5l1.7 1.7L8.7 12M4 20.5l1.7 1.7L8.7 19M12 7h8M12 14h8M12 21h8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2.5h12M6 21.5h12M7 2.5c0 5 5 5.5 5 9.5 0-4 5-4.5 5-9.5M7 21.5c0-5 5-5.5 5-9.5 0 4 5 4.5 5 9.5" />
    </svg>
  )
}

export default function App() {
  const now = useNow(1000)
  const { t, lang, setLang, language } = useI18n()
  const [theme, setTheme] = useState(getInitialTheme)
  const [hour12, setHour12] = useState(() => readStorage('chronos.hour12', '0') === '1')
  const [tab, setTab] = useState(getInitialTab)
  const tabsRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStorage('chronos.theme', theme)
  }, [theme])

  useEffect(() => {
    writeStorage('chronos.hour12', hour12 ? '1' : '0')
  }, [hour12])

  useEffect(() => {
    document.title = `Chronos · ${t('brandSubtitle')}`
  }, [t])

  useEffect(() => {
    // Keep the active tab reachable when the tab bar scrolls on narrow screens.
    const container = tabsRef.current
    if (!container) return undefined

    const ensureVisible = () => {
      const active = container.querySelector('.tab.is-active')
      if (!active) return
      const bar = container.getBoundingClientRect()
      const button = active.getBoundingClientRect()
      if (button.left < bar.left) {
        container.scrollLeft -= bar.left - button.left + 8
      } else if (button.right > bar.right) {
        container.scrollLeft += button.right - bar.right + 8
      }
    }

    ensureVisible()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(ensureVisible) : null
    observer?.observe(container)
    window.addEventListener('resize', ensureVisible)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', ensureVisible)
    }
  }, [tab, lang])

  const parts = getZoneParts(now, LOCAL_TZ)
  const time = getDisplayTime(parts, hour12, { am: t('am'), pm: t('pm') })
  const dateLabel = formatDateLong(now, LOCAL_TZ, language.locale)
  const offset = getOffsetLabel(now, LOCAL_TZ)
  const dayOfYear = getDayOfYear(parts)
  const daysInYear = getDaysInYear(parts.year)
  const secondsOfDay = parts.hour * 3600 + parts.minute * 60 + parts.second
  const dayProgress = Math.min(100, (secondsOfDay / 86_400) * 100)
  const greeting = t(getGreetingKey(parts.hour))
  const spokenTime = `${time.hour}:${time.minute}:${time.second}${time.suffix ? ` ${time.suffix}` : ''}`
  const activeTab = TABS.find((entry) => entry.id === tab) ?? TABS[0]

  function selectTab(nextTab) {
    setTab(nextTab)
    try {
      window.history.replaceState(null, '', `#${nextTab}`)
    } catch {
      /* Navigation history is unavailable in some embedded contexts. */
    }
  }

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true">
        <span className="orb orb--one" />
        <span className="orb orb--two" />
        <span className="orb orb--three" />
      </div>

      <header className="topbar container">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <defs>
                <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#38bdf8" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#brandGradient)" />
              <circle cx="16" cy="16" r="8.5" fill="none" stroke="#071120" strokeWidth="2" />
              <path d="M16 10.5v5.8l3.8 2.3" fill="none" stroke="#071120" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <div className="brand-text">
            <h1>Chronos</h1>
            <p>{t('brandSubtitle')}</p>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="lang-select" title={t('language')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.6" />
              <path d="M3.4 12h17.2" />
              <path d="M12 3.4c2.5 2.6 2.5 14.6 0 17.2M12 3.4c-2.5 2.6-2.5 14.6 0 17.2" />
            </svg>
            <select
              value={lang}
              onChange={(event) => setLang(event.target.value)}
              aria-label={t('language')}
            >
              {LANGUAGES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.native}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            aria-label={t(theme === 'dark' ? 'themeToLight' : 'themeToDark')}
            title={t(theme === 'dark' ? 'themeToLight' : 'themeToDark')}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.6 6.6 0 0 0 10.7 10.7Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4.1" />
                <path d="M12 2.2v2.1M12 19.7v2.1M4.1 4.1l1.5 1.5M18.4 18.4l1.5 1.5M2.2 12h2.1M19.7 12h2.1M4.1 19.9l1.5-1.5M18.4 5.6l1.5-1.5" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="container">
        <section className="panel clock-card">
          <div className="clock-card-head">
            <span className="eyebrow">
              <span className="live-dot" aria-hidden="true" />
              {t('localTime')}
            </span>
            <div className="clock-controls">
              <span className="tz-chip" title={LOCAL_TZ}>
                {offset}
              </span>
              <button
                type="button"
                className="hour-toggle"
                onClick={() => setHour12((value) => !value)}
                aria-label={t(hour12 ? 'switchTo24' : 'switchTo12')}
              >
                {hour12 ? '12h' : '24h'}
              </button>
            </div>
          </div>

          <div className="digital-clock" role="timer" aria-label={spokenTime} aria-live="off">
            <span key={`h-${time.hour}`} className="clock-unit tick-swap">
              {time.hour}
            </span>
            <span className="clock-colon" aria-hidden="true">
              :
            </span>
            <span key={`m-${time.minute}`} className="clock-unit tick-swap">
              {time.minute}
            </span>
            <span className="clock-colon clock-colon--soft" aria-hidden="true">
              :
            </span>
            <span key={`s-${time.second}`} className="clock-seconds tick-swap">
              {time.second}
            </span>
            {time.suffix && <span className="clock-suffix">{time.suffix}</span>}
          </div>

          <p className="clock-date">{dateLabel}</p>

          <div className="clock-meta">
            <span>{greeting}</span>
            <span className="meta-sep" aria-hidden="true">
              •
            </span>
            <span>{LOCAL_TZ.replaceAll('_', ' ')}</span>
            <span className="meta-sep" aria-hidden="true">
              •
            </span>
            <span>{offset}</span>
          </div>

          <div className="day-progress">
            <div className="progress-labels">
              <span>{t('dayProgress')}</span>
              <span>{dayProgress.toFixed(1)}%</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label={t('progressAria')}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round(dayProgress)}
            >
              <div className="progress-fill" style={{ width: `${dayProgress}%` }} />
            </div>
          </div>

          <div className="clock-stats">
            <div className="clock-stat">
              <span className="stat-label">{t('timeZone')}</span>
              <span className="stat-value stat-value--sm">{LOCAL_TZ.split('/').pop().replaceAll('_', ' ')}</span>
            </div>
            <div className="clock-stat">
              <span className="stat-label">{t('utcOffset')}</span>
              <span className="stat-value">{offset}</span>
            </div>
            <div className="clock-stat">
              <span className="stat-label">{t('dayOfYear')}</span>
              <span className="stat-value">
                {dayOfYear}
                <small>/{daysInYear}</small>
              </span>
            </div>
          </div>
        </section>

        <section className="panel workspace">
          <div className="workspace-head">
            <div ref={tabsRef} className="tabs" role="tablist" aria-label={t('clockTools')}>
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === entry.id}
                  aria-controls={`panel-${entry.id}`}
                  className={`tab${tab === entry.id ? ' is-active' : ''}`}
                  onClick={() => selectTab(entry.id)}
                >
                  <TabIcon name={entry.icon} />
                  <span>{t(entry.labelKey)}</span>
                </button>
              ))}
            </div>
            <p className="workspace-hint">{t(activeTab.hintKey)}</p>
          </div>

          <div
            id="panel-world"
            role="tabpanel"
            className={`tab-panel${tab === 'world' ? '' : ' is-hidden'}`}
          >
            <WorldClocks now={now} hour12={hour12} />
          </div>

          <div
            id="panel-stopwatch"
            role="tabpanel"
            className={`tab-panel${tab === 'stopwatch' ? '' : ' is-hidden'}`}
          >
            <Stopwatch />
          </div>

          <div
            id="panel-timer"
            role="tabpanel"
            className={`tab-panel${tab === 'timer' ? '' : ' is-hidden'}`}
          >
            <CountdownTimer />
          </div>

          <div
            id="panel-alarm"
            role="tabpanel"
            className={`tab-panel${tab === 'alarm' ? '' : ' is-hidden'}`}
          >
            <AlarmClock now={now} hour12={hour12} />
          </div>

          <div
            id="panel-todo"
            role="tabpanel"
            className={`tab-panel${tab === 'todo' ? '' : ' is-hidden'}`}
          >
            <TodoList />
          </div>
        </section>
      </main>

      <footer className="footer container">
        <span>{t('footerBuilt')}</span>
        <span className="footer-status">
          <span className="live-dot" aria-hidden="true" />
          {t('footerLive')}
        </span>
      </footer>
    </div>
  )
}
