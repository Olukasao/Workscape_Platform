import { Archive, Clock3, Inbox, MessagesSquare, UserRoundCheck } from 'lucide-react'
import type { ConversationCounts, ConversationFilter } from '../../types/domain'

interface ConversationFiltersProps {
  activeFilter: ConversationFilter
  counts: ConversationCounts | null
  onChange(filter: ConversationFilter): void
}

const filters: Array<{
  id: ConversationFilter
  label: string
  countKey: keyof ConversationCounts
  icon: typeof Inbox
}> = [
  { id: 'new', label: 'Novos', countKey: 'new', icon: Inbox },
  { id: 'mine', label: 'Meus atendimentos', countKey: 'mine', icon: UserRoundCheck },
  { id: 'open', label: 'Em atendimento', countKey: 'open', icon: MessagesSquare },
  {
    id: 'waiting_customer',
    label: 'Aguardando cliente',
    countKey: 'waiting_customer',
    icon: Clock3,
  },
  { id: 'closed', label: 'Encerrados', countKey: 'closed', icon: Archive },
  { id: 'archived', label: 'Arquivados', countKey: 'archived', icon: Archive },
]

export function ConversationFilters({ activeFilter, counts, onChange }: ConversationFiltersProps) {
  return (
    <nav className="conversation-filters" aria-label="Filtros de atendimento">
      {filters.map((filter) => {
        const Icon = filter.icon
        const count = counts?.[filter.countKey] ?? 0

        return (
          <button
            className={filter.id === activeFilter ? 'active' : ''}
            type="button"
            key={filter.id}
            onClick={() => onChange(filter.id)}
            aria-label={`${filter.label}: ${count}`}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{filter.label}</span>
            <strong className="filter-count">{count}</strong>
          </button>
        )
      })}
    </nav>
  )
}
