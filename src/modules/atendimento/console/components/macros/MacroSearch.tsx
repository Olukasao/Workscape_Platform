import type { Macro } from '../../types/macro'
import { groupMacrosByCategory } from '../../utils/macroShortcuts'
import { MacroSuggestion } from './MacroSuggestion'

interface MacroSearchProps {
  macros: Macro[]
  highlightedId?: string | null
  favoriteIds?: string[]
  onSelect(macro: Macro): void
  onHighlight?(macroId: string): void
  emptyLabel?: string
}

export function MacroSearch({
  macros,
  highlightedId,
  favoriteIds = [],
  onSelect,
  onHighlight,
  emptyLabel = 'Nenhuma macro encontrada.',
}: MacroSearchProps) {
  if (macros.length === 0) {
    return <p className="empty-state compact">{emptyLabel}</p>
  }

  const groups = groupMacrosByCategory(macros)

  return (
    <div className="macro-search-groups" role="listbox" aria-label="Macros">
      {groups.map((group) => (
        <div className="macro-search-group" key={group.category}>
          <span className="macro-search-group-label">{group.category}</span>
          {group.macros.map((macro) => (
            <MacroSuggestion
              key={macro.id}
              macro={macro}
              highlighted={highlightedId === macro.id}
              favorite={favoriteIds.includes(macro.id)}
              onSelect={onSelect}
              onHighlight={onHighlight}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
