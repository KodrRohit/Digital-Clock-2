# Chronos — Digital Clock System

A dynamic clock website built with React and Vite. The big digital clock updates every second and the rest of the dashboard is fully interactive.

## Features

- **Live digital clock** — 24-hour or 12-hour format, blinking colons, second-by-second tick animation
- **Date & day tracking** — full date, greeting, time zone, UTC offset, day-of-year and a live day-progress bar
- **World clocks** — add or remove cities from 21 presets, with today/tomorrow badges, offsets and day/night hints. Selections persist in `localStorage`
- **Stopwatch** — 1/100th-second precision, lap splits and totals
- **Countdown timer** — hour/minute/second inputs, quick presets, progress ring and an audio chime when time is up
- **To-do list** — priorities, optional due dates, inline editing, all/active/done filters, completion progress, clear-completed and overdue highlighting. Tasks persist in `localStorage`
- **Dark & light themes** — remembered between visits, plus `?theme=light` / `?theme=dark` URL support
- **8 languages** — English, Spanish, French, German, Hindi, Arabic (full RTL), Japanese and Chinese. The choice is remembered and `?lang=es` deep links work. Dates, greetings, country names and all controls are localized
- **Deep-linkable tabs** — `#world`, `#stopwatch`, `#timer`, `#todo`
- **Responsive** — works from small phones to wide displays, with reduced-motion support

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Project structure

```
src/
  App.jsx                  Layout, hero clock, theme + tab state
  components/
    WorldClocks.jsx        City picker and live world clock cards
    Stopwatch.jsx          rAF-based stopwatch with laps
    Timer.jsx              Countdown ring with Web Audio chime
    TodoList.jsx           Priority tasks, due dates, filters and editing
  data/cities.js           City presets with IANA time zones
  hooks/useNow.js          Shared one-second tick
  i18n/
    translations.js        Strings for all eight languages
    LanguageProvider.jsx   Language state, t() helper and RTL direction
  utils/time.js            Intl-based time zone helpers
  index.css                Theme tokens, layout and animations
```

Time zones are handled with the browser's `Intl.DateTimeFormat`, so daylight-saving changes are automatic and no external time API is required.
