import { useEffect, useMemo, useState } from 'react'
import { CITY_PRESETS, DEFAULT_CITY_IDS } from '../data/cities.js'
import { useI18n } from '../i18n/LanguageProvider.jsx'
import {
  getZoneParts,
  getDisplayTime,
  getOffsetLabel,
  getDayRelation,
  getCountryName,
} from '../utils/time.js'

const CITY_BY_ID = new Map(CITY_PRESETS.map((city) => [city.id, city]))

function loadCityIds() {
  try {
    const raw = localStorage.getItem('chronos.cities')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((id) => CITY_BY_ID.has(id))
        if (valid.length) return valid
      }
    }
  } catch {
    /* Ignore corrupt or blocked storage and fall back to defaults. */
  }
  return DEFAULT_CITY_IDS
}

export default function WorldClocks({ now, hour12 }) {
  const { t, language } = useI18n()
  const [cityIds, setCityIds] = useState(loadCityIds)
  const [selection, setSelection] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem('chronos.cities', JSON.stringify(cityIds))
    } catch {
      /* Persistence is optional. */
    }
  }, [cityIds])

  const available = useMemo(
    () => CITY_PRESETS.filter((city) => !cityIds.includes(city.id)),
    [cityIds],
  )

  const selectedId =
    selection && available.some((city) => city.id === selection)
      ? selection
      : (available[0]?.id ?? '')

  function addCity() {
    if (!selectedId) return
    setCityIds((current) => (current.includes(selectedId) ? current : [...current, selectedId]))
    setSelection('')
  }

  function removeCity(id) {
    setCityIds((current) => current.filter((cityId) => cityId !== id))
  }

  const cities = cityIds.map((id) => CITY_BY_ID.get(id)).filter(Boolean)

  return (
    <div className="world">
      <div className="world-toolbar">
        <div className="select-wrap">
          <select
            className="select"
            value={selectedId}
            onChange={(event) => setSelection(event.target.value)}
            disabled={!available.length}
            aria-label={t('worldChooseCity')}
          >
            {available.length ? (
              available.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.city} — {getCountryName(city.code, language.locale, city.country)}
                </option>
              ))
            ) : (
              <option value="">{t('worldAllAdded')}</option>
            )}
          </select>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={addCity}
          disabled={!selectedId}
        >
          <span aria-hidden="true">+</span> {t('worldAddCity')}
        </button>
      </div>

      {cities.length ? (
        <div className="world-grid">
          {cities.map((city) => (
            <WorldCard
              key={city.id}
              city={city}
              now={now}
              hour12={hour12}
              onRemove={() => removeCity(city.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            🌐
          </span>
          <p>{t('worldEmpty')}</p>
        </div>
      )}
    </div>
  )
}

function WorldCard({ city, now, hour12, onRemove }) {
  const { t, language } = useI18n()
  const parts = getZoneParts(now, city.timeZone)
  const time = getDisplayTime(parts, hour12, { am: t('am'), pm: t('pm') })
  const offset = getOffsetLabel(now, city.timeZone)
  const relation = getDayRelation(now, city.timeZone)
  const relationLabel =
    relation === 0
      ? t('today')
      : relation === 1
        ? t('tomorrow')
        : relation === -1
          ? t('yesterday')
          : `${relation > 0 ? '+' : ''}${relation}d`
  const isDaytime = parts.hour >= 6 && parts.hour < 18

  return (
    <article className="world-card">
      <div className="world-card-top">
        <span className="world-flag" aria-hidden="true">
          {city.code}
        </span>
        <div className="world-name">
          <h3>{city.city}</h3>
          <p>{getCountryName(city.code, language.locale, city.country)}</p>
        </div>
        <button
          type="button"
          className="world-remove"
          onClick={onRemove}
          aria-label={t('worldRemove', { city: city.city })}
          title={t('worldRemove', { city: city.city })}
        >
          ×
        </button>
      </div>

      <div className="world-time">
        <span>{time.hour}</span>
        <span className="world-colon">:</span>
        <span>{time.minute}</span>
        <span className="world-seconds">
          <span className="world-colon">:</span>
          {time.second}
        </span>
        {time.suffix && <span className="world-suffix">{time.suffix}</span>}
      </div>

      <div className="world-meta">
        <span className={`day-pill${relation !== 0 ? ' day-pill--shift' : ''}`}>{relationLabel}</span>
        <span className="world-offset">{offset}</span>
        <span className="day-icon" title={t(isDaytime ? 'dayTime' : 'nightTime')} aria-hidden="true">
          {isDaytime ? '☀️' : '🌙'}
        </span>
      </div>
    </article>
  )
}
