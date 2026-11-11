import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export interface SearchableSelectOption {
  id: string
  label: string
  description?: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  emptyOptionLabel: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyOptionLabel,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.id === value) ?? null

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => option.label.toLowerCase().includes(normalized))
  }, [options, query])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className={`searchable-select${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="searchable-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? '' : 'searchable-select-placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <span className="searchable-select-trigger-icons">
          {selected && (
            <X
              size={14}
              aria-label="Limpar seleção"
              onClick={(event) => {
                event.stopPropagation()
                onChange('')
              }}
            />
          )}
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </button>

      {open && !disabled && (
        <div className="searchable-select-panel" role="listbox">
          <div className="searchable-select-search">
            <Search size={14} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar..."
            />
          </div>
          <ul>
            <li>
              <button
                type="button"
                className={value === '' ? 'active' : ''}
                onClick={() => {
                  onChange('')
                  setOpen(false)
                  setQuery('')
                }}
              >
                {emptyOptionLabel}
                {value === '' && <Check size={14} aria-hidden="true" />}
              </button>
            </li>
            {filteredOptions.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className={value === option.id ? 'active' : ''}
                  onClick={() => {
                    onChange(option.id)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span>
                    {option.label}
                    {option.description && (
                      <small>{option.description}</small>
                    )}
                  </span>
                  {value === option.id && <Check size={14} aria-hidden="true" />}
                </button>
              </li>
            ))}
            {filteredOptions.length === 0 && <li className="searchable-select-empty">Nenhum resultado</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
