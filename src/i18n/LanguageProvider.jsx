import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LANGUAGE, LANGUAGES, TRANSLATIONS } from './translations.js'

const LanguageContext = createContext(null)

function detectLanguage() {
  try {
    const requested = new URLSearchParams(window.location.search).get('lang')
    if (requested && TRANSLATIONS[requested]) return requested

    const saved = localStorage.getItem('chronos.lang')
    if (saved && TRANSLATIONS[saved]) return saved

    const browserCode = (navigator.language || DEFAULT_LANGUAGE).slice(0, 2)
    if (TRANSLATIONS[browserCode]) return browserCode
  } catch {
    /* Storage and URL APIs may be unavailable in embedded contexts. */
  }
  return DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectLanguage)
  const language = LANGUAGES.find((entry) => entry.code === lang) ?? LANGUAGES[0]

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = language.dir
    try {
      localStorage.setItem('chronos.lang', lang)
    } catch {
      /* Persistence is optional. */
    }
  }, [lang, language.dir])

  const value = useMemo(() => {
    const dictionary = TRANSLATIONS[lang] ?? TRANSLATIONS[DEFAULT_LANGUAGE]
    const fallback = TRANSLATIONS[DEFAULT_LANGUAGE]

    const t = (key, variables) => {
      let text = dictionary[key] ?? fallback[key] ?? key
      if (variables) {
        for (const [name, replacement] of Object.entries(variables)) {
          text = text.replaceAll(`{${name}}`, String(replacement))
        }
      }
      return text
    }

    return { lang, setLang, language, dir: language.dir, t }
  }, [lang, language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useI18n must be used inside <LanguageProvider>')
  return context
}
