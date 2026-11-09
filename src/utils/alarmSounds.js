export const ALARM_SOUNDS = [
  { id: 'chime', labelKey: 'alarmSoundChime' },
  { id: 'bell', labelKey: 'alarmSoundBell' },
  { id: 'digital', labelKey: 'alarmSoundDigital' },
  { id: 'gentle', labelKey: 'alarmSoundGentle' },
]

const PATTERNS = {
  chime: {
    loop: 2600,
    notes: [
      { at: 0, freq: 880, duration: 0.85, gain: 1 },
      { at: 0.28, freq: 1174.66, duration: 0.85, gain: 0.85 },
      { at: 0.56, freq: 1567.98, duration: 1.1, gain: 0.7 },
    ],
  },
  bell: {
    loop: 2800,
    notes: [
      { at: 0, freq: 523.25, duration: 1.5, gain: 1, type: 'triangle' },
      { at: 0.5, freq: 659.25, duration: 1.4, gain: 0.8, type: 'triangle' },
      { at: 1.1, freq: 523.25, duration: 1.3, gain: 0.65, type: 'triangle' },
    ],
  },
  digital: {
    loop: 1700,
    notes: [0, 0.2, 0.4, 0.6].flatMap((at) => [
      { at, freq: 1046.5, duration: 0.12, gain: 0.7, type: 'square' },
      { at: at + 0.1, freq: 1318.51, duration: 0.1, gain: 0.5, type: 'square' },
    ]),
  },
  gentle: {
    loop: 3400,
    notes: [
      { at: 0, freq: 392, duration: 1.1, gain: 0.7 },
      { at: 0.4, freq: 523.25, duration: 1.1, gain: 0.62 },
      { at: 0.8, freq: 659.25, duration: 1.1, gain: 0.55 },
      { at: 1.2, freq: 523.25, duration: 1.2, gain: 0.45 },
    ],
  },
}

function playSynth(pattern, volume) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null

  let context
  try {
    context = new AudioContextClass()
  } catch {
    return null
  }

  let stopped = false
  let timer = null

  const schedulePhrase = () => {
    if (stopped || context.state === 'closed') return
    if (context.state === 'suspended') context.resume().catch(() => {})

    const start = context.currentTime + 0.05
    for (const note of pattern.notes) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const peak = Math.max(0.02, (note.gain ?? 1) * volume)
      const noteStart = start + note.at
      const noteEnd = noteStart + note.duration

      oscillator.type = note.type ?? 'sine'
      oscillator.frequency.setValueAtTime(note.freq, noteStart)
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.exponentialRampToValueAtTime(peak, noteStart + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(noteStart)
      oscillator.stop(noteEnd + 0.05)
    }
  }

  schedulePhrase()
  timer = window.setInterval(schedulePhrase, pattern.loop)

  return {
    stop() {
      if (stopped) return
      stopped = true
      if (timer) {
        window.clearInterval(timer)
        timer = null
      }
      if (context.state !== 'closed') {
        context.close().catch(() => {
          /* Closing races are harmless. */
        })
      }
    },
  }
}

function playBlob(blob) {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.loop = true
  audio.preload = 'auto'
  audio.volume = 0.9

  audio.play().catch(() => {
    /* Autoplay can be blocked; the visual alarm still appears. */
  })

  return {
    stop() {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch {
        /* Ignore teardown errors. */
      }
      URL.revokeObjectURL(url)
    },
  }
}

/**
 * Starts a looping alarm sound. Returns a handle with a stop() method,
 * or null when audio is unavailable.
 */
export function playAlarmSound({ sound = 'chime', blob = null, volume = 0.26 } = {}) {
  if (blob) return playBlob(blob)
  return playSynth(PATTERNS[sound] ?? PATTERNS.chime, volume)
}
