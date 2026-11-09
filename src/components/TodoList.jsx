import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/LanguageProvider.jsx'

const STORAGE_KEY = 'chronos.todos'
const PRIORITIES = ['low', 'medium', 'high']
const PRIORITY_LABEL_KEYS = {
  low: 'todoPriorityLow',
  medium: 'todoPriorityMedium',
  high: 'todoPriorityHigh',
}

const FILTERS = [
  { id: 'all', labelKey: 'todoFilterAll' },
  { id: 'active', labelKey: 'todoFilterActive' },
  { id: 'done', labelKey: 'todoFilterDone' },
]

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTodo(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.text !== 'string') return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId(),
    text: raw.text.slice(0, 200),
    done: Boolean(raw.done),
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'medium',
    due: typeof raw.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.due) ? raw.due : '',
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
  }
}

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeTodo).filter(Boolean)
  } catch {
    return []
  }
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDue(due, locale) {
  const date = new Date(`${due}T00:00:00`)
  if (Number.isNaN(date.getTime())) return due
  try {
    const sameYear = date.getFullYear() === new Date().getFullYear()
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(date)
  } catch {
    return due
  }
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4.2L19.4 8.8a2.4 2.4 0 0 0-3.4-3.4L4.8 16.6 4 20Z" />
      <path d="M14.5 6.9l3.4 3.4" />
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

export default function TodoList() {
  const { t, language } = useI18n()
  const [todos, setTodos] = useState(loadTodos)
  const [text, setText] = useState('')
  const [priority, setPriority] = useState('medium')
  const [due, setDue] = useState('')
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const inputRef = useRef(null)
  const skipBlurRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
    } catch {
      /* Persistence is optional. */
    }
  }, [todos])

  const remaining = todos.filter((todo) => !todo.done).length
  const completed = todos.length - remaining
  const progress = todos.length ? (completed / todos.length) * 100 : 0

  const visible = todos
    .filter((todo) => {
      if (filter === 'active') return !todo.done
      if (filter === 'done') return todo.done
      return true
    })
    .slice()
    .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)

  const todayKey = toDateKey(new Date())
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = toDateKey(tomorrow)

  function addTodo(event) {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    const todo = {
      id: makeId(),
      text: value,
      done: false,
      priority,
      due,
      createdAt: Date.now(),
    }
    setTodos((current) => [todo, ...current])
    setText('')
    setDue('')
    inputRef.current?.focus()
  }

  function toggleTodo(id) {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
    )
  }

  function removeTodo(id) {
    setTodos((current) => current.filter((todo) => todo.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function clearCompleted() {
    setTodos((current) => current.filter((todo) => !todo.done))
  }

  function startEdit(todo) {
    skipBlurRef.current = false
    setEditingId(todo.id)
    setEditingText(todo.text)
  }

  function commitEdit(id) {
    if (editingId !== id) return
    const value = editingText.trim()
    if (value) {
      setTodos((current) =>
        current.map((todo) => (todo.id === id ? { ...todo, text: value } : todo)),
      )
    }
    setEditingId(null)
  }

  function cancelEdit() {
    skipBlurRef.current = true
    setEditingId(null)
  }

  function dueLabel(todo) {
    if (todo.due === todayKey) return t('today')
    if (todo.due === tomorrowKey) return t('tomorrow')
    return formatDue(todo.due, language.locale)
  }

  const emptyMessage =
    filter === 'active'
      ? t('todoEmptyActive')
      : filter === 'done'
        ? t('todoEmptyDone')
        : t('todoEmptyAll')

  return (
    <div className="todo">
      <form className="todo-form" onSubmit={addTodo}>
        <input
          ref={inputRef}
          className="todo-input"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('todoPlaceholder')}
          aria-label={t('todoPlaceholder')}
          maxLength={200}
        />
        <div className="todo-select-wrap">
          <select
            className="todo-select"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            aria-label={t('todoPriority')}
            title={t('todoPriority')}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {t(PRIORITY_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </div>
        <input
          className="todo-date"
          type="date"
          value={due}
          onChange={(event) => setDue(event.target.value)}
          aria-label={t('todoDueDate')}
          title={t('todoDueDate')}
        />
        <button type="submit" className="btn btn--primary todo-add" disabled={!text.trim()}>
          <span aria-hidden="true">+</span> {t('todoAdd')}
        </button>
      </form>

      <div className="todo-toolbar">
        <div className="todo-filters" role="group" aria-label={t('todoFilters')}>
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`todo-filter${filter === entry.id ? ' is-active' : ''}`}
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {t(entry.labelKey)}
            </button>
          ))}
        </div>
        <div className="todo-toolbar-right">
          <span className="todo-left" aria-live="polite">
            {t('todoLeft', { n: remaining })}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={clearCompleted}
            disabled={completed === 0}
          >
            {t('todoClearDone')}
          </button>
        </div>
      </div>

      {todos.length > 0 && (
        <div className="todo-progress">
          <div
            className="progress-track"
            role="progressbar"
            aria-label={t('todoProgress', { done: completed, total: todos.length })}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(progress)}
          >
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="todo-progress-label">
            {t('todoProgress', { done: completed, total: todos.length })}
          </span>
        </div>
      )}

      {visible.length > 0 ? (
        <ul className="todo-list">
          {visible.map((todo) => {
            const overdue = Boolean(todo.due) && todo.due < todayKey && !todo.done
            return (
              <li
                key={todo.id}
                className={`todo-item priority-${todo.priority}${todo.done ? ' is-done' : ''}`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={todo.done}
                  aria-label={t(todo.done ? 'todoMarkActive' : 'todoMarkDone')}
                  className="todo-check"
                  onClick={() => toggleTodo(todo.id)}
                >
                  <CheckIcon />
                </button>

                <div className="todo-body">
                  {editingId === todo.id ? (
                    <input
                      className="todo-edit"
                      type="text"
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitEdit(todo.id)
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelEdit()
                        }
                      }}
                      onBlur={() => {
                        if (skipBlurRef.current) {
                          skipBlurRef.current = false
                          return
                        }
                        commitEdit(todo.id)
                      }}
                      aria-label={t('todoEdit')}
                      maxLength={200}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="todo-text"
                      onDoubleClick={() => startEdit(todo)}
                      title={t('todoEdit')}
                    >
                      {todo.text}
                    </span>
                  )}

                  <div className="todo-meta">
                    <span className={`priority-pill priority-${todo.priority}`}>
                      {t(PRIORITY_LABEL_KEYS[todo.priority])}
                    </span>
                    {todo.due && (
                      <span className={`todo-due${overdue ? ' is-overdue' : ''}`}>
                        <CalendarIcon />
                        {overdue ? `${t('todoOverdue')} · ` : ''}
                        {dueLabel(todo)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="todo-actions">
                  <button
                    type="button"
                    className="todo-action"
                    onClick={() => startEdit(todo)}
                    aria-label={t('todoEdit')}
                    title={t('todoEdit')}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="todo-action todo-action--danger"
                    onClick={() => removeTodo(todo.id)}
                    aria-label={t('todoDelete')}
                    title={t('todoDelete')}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="todo-empty">
          <span className="todo-empty-icon" aria-hidden="true">
            {filter === 'done' ? '🎉' : '🗒️'}
          </span>
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  )
}
