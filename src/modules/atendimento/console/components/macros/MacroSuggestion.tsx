import { Star, Zap } from 'lucide-react'
import type { Macro } from '../../types/macro'
import { countMacroActions } from '../../utils/macroShortcuts'

interface MacroSuggestionProps {
  macro: Macro
  highlighted?: boolean
  favorite?: boolean
  onSelect(macro: Macro): void
  onHighlight?(macroId: string): void
}

export function MacroSuggestion({ macro, highlighted, favorite, onSelect, onHighlight }: MacroSuggestionProps) {
  const actionsCount = countMacroActions(macro.actions)

  return (
    <button
      type="button"
      role="option"
      aria-selected={Boolean(highlighted)}
      className={`macro-suggestion ${highlighted ? 'highlighted' : ''}`}
      onMouseEnter={() => onHighlight?.(macro.id)}
      onClick={() => onSelect(macro)}
    >
      <span className="macro-suggestion-icon" aria-hidden="true">
        <Zap size={15} />
      </span>
      <span className="macro-suggestion-body">
        <span className="macro-suggestion-title">
          <strong>{macro.shortcut}</strong>
          <span>{macro.name}</span>
        </span>
        <span className="macro-suggestion-meta">
          {macro.category && <span className="tag-chip compact">{macro.category}</span>}
          <span>{actionsCount} {actionsCount === 1 ? 'ação' : 'ações'}</span>
        </span>
      </span>
      {favorite && (
        <span className="macro-suggestion-favorite" aria-hidden="true">
          <Star size={14} fill="currentColor" />
        </span>
      )}
    </button>
  )
}
