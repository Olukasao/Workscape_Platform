import { Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Macro } from '../../types/macro'
import { searchMacros } from '../../utils/macroShortcuts'
import { MacroSearch } from './MacroSearch'

interface MacroMenuProps {
  macros: Macro[]
  recentMacros: Macro[]
  favoriteIds: string[]
  onSelect(macro: Macro): void
}

export function MacroMenu({ macros, recentMacros, favoriteIds, onSelect }: MacroMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const results = useMemo(() => searchMacros(macros, query), [macros, query])
  const showRecents = !query.trim() && recentMacros.length > 0

  useEffect(() => {
    if (!open) {
      setQuery('')
      setHighlightedId(null)
      return
    }

    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  function selectMacro(macro: Macro) {
    onSelect(macro)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }

    if (results.length === 0) return

    const currentIndex = results.findIndex((macro) => macro.id === highlightedId)

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedId(results[(currentIndex + 1 + results.length) % results.length].id)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedId(results[(currentIndex - 1 + results.length) % results.length].id)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const target = results.find((macro) => macro.id === highlightedId) ?? results[0]
      if (target) selectMacro(target)
    }
  }

  return (
    <div className="macro-menu-anchor">
      <button
        type="button"
        className="macro-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Macros"
        title="Macros"
      >
        <Zap size={16} aria-hidden="true" />
        Macros
      </button>

      {open && (
        <>
          <div className="macro-menu-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <section className="macro-menu-panel" role="dialog" aria-label="Selecionar macro">
            <input
              ref={inputRef}
              className="select-input"
              placeholder="Pesquisar macro..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setHighlightedId(null)
              }}
              onKeyDown={handleKeyDown}
            />

            <div className="macro-menu-scroll">
              {showRecents && (
                <div className="macro-search-group">
                  <span className="macro-search-group-label">Recentes</span>
                  <MacroSearch
                    macros={recentMacros}
                    highlightedId={highlightedId}
                    favoriteIds={favoriteIds}
                    onSelect={selectMacro}
                    onHighlight={setHighlightedId}
                  />
                </div>
              )}

              <MacroSearch
                macros={results}
                highlightedId={highlightedId}
                favoriteIds={favoriteIds}
                onSelect={selectMacro}
                onHighlight={setHighlightedId}
                emptyLabel="Nenhuma macro encontrada para essa busca."
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
