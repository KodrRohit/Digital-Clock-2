export const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

const partsFormatters = new Map()
const longDateFormatters = new Map()
const shortOffsetFormatters = new Map()

function getPartsFormatter(timeZone) {
  let fmt = partsFormatters.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timeZone, fmt)
  }
  return fmt
}

/** Numeric calendar/clock parts for a time zone, in one pass. */
export function getZoneParts(date, timeZone = LOCAL_TZ) {
  const raw = {}
  for (const part of getPartsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') raw[part.type] = part.value
  }
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour: Number(raw.hour) % 24,
    minute: Number(raw.minute),
    second: Number(raw.second),
    ms: date.getMilliseconds(),
  }
}

export function pad2(n) {
  return String(Math.floor(n)).padStart(2, '0')
}

/** Splits clock parts into padded strings for the digital display. */
export function getDisplayTime(parts, hour12 = false, labels = {}) {
  const hour = hour12 ? parts.hour % 12 || 12 : parts.hour
  const amLabel = labels.am ?? 'AM'
  const pmLabel = labels.pm ?? 'PM'
  return {
    hour: pad2(hour),
    minute: pad2(parts.minute),
    second: pad2(parts.second),
    suffix: hour12 ? (parts.hour < 12 ? amLabel : pmLabel) : '',
  }
}

export function formatDateLong(date, timeZone = LOCAL_TZ, locale = 'en-US') {
  const cacheKey = `${locale}|${timeZone}`
  let fmt = longDateFormatters.get(cacheKey)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    longDateFormatters.set(cacheKey, fmt)
  }
  return fmt.format(date)
}

export function getOffsetLabel(date, timeZone = LOCAL_TZ) {
  let fmt = shortOffsetFormatters.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    shortOffsetFormatters.set(timeZone, fmt)
  }
  const part = fmt.formatToParts(date).find((p) => p.type === 'timeZoneName')
  return part ? part.value : ''
}

const countryNameFormatters = new Map()

/** Localized country name for an ISO 3166-1 alpha-2 code. */
export function getCountryName(code, locale = 'en-US', fallback = code) {
  try {
    const cacheKey = `${locale}|${code}`
    let formatter = countryNameFormatters.get(cacheKey)
    if (!formatter) {
      formatter = new Intl.DisplayNames([locale], { type: 'region' })
      countryNameFormatters.set(cacheKey, formatter)
    }
    return formatter.of(code) ?? fallback
  } catch {
    return fallback
  }
}

export function getDayOfYear(parts) {
  const start = Date.UTC(parts.year, 0, 0)
  return Math.floor((Date.UTC(parts.year, parts.month - 1, parts.day) - start) / 86_400_000)
}

export function getDaysInYear(year) {
  return Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000)
}

/** -1 yesterday, 0 today, 1 tomorrow relative to the user's local date. */
export function getDayRelation(date, timeZone) {
  const remote = getZoneParts(date, timeZone)
  const local = getZoneParts(date, LOCAL_TZ)
  const diff = Date.UTC(remote.year, remote.month - 1, remote.day) -
    Date.UTC(local.year, local.month - 1, local.day)
  return Math.round(diff / 86_400_000)
}

export function getGreetingKey(hour) {
  if (hour < 5) return 'goodNight'
  if (hour < 12) return 'goodMorning'
  if (hour < 17) return 'goodAfternoon'
  if (hour < 21) return 'goodEvening'
  return 'goodNight'
}

/** Breaks milliseconds into h / m / s / centiseconds. */
export function splitDuration(ms) {
  const totalCs = Math.max(0, Math.floor(ms / 10))
  return {
    h: Math.floor(totalCs / 360_000),
    m: Math.floor((totalCs % 360_000) / 6_000),
    s: Math.floor((totalCs % 6_000) / 100),
    cs: totalCs % 100,
  }
}
