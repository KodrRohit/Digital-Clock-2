import { useEffect, useState } from 'react'

/**
 * Returns the current Date, refreshed on a fixed interval.
 * Kept in one place so every clock in the app ticks in sync.
 */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), interval)
    return () => clearInterval(id)
  }, [interval])

  return now
}
