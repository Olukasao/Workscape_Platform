import { useMemo, useState } from 'react'
import type { Automation, AutomationStatus, AutomationTriggerType } from '../../types/automation'
import { triggerTypeLabels } from '../../utils/automationDescriptions'
import { AutomationCard } from './AutomationCard'

type StatusFilter = 'all' | AutomationStatus | 'errors'

interface AutomationListProps {
  automations: Automation[]
  loading: boolean
  canManage: boolean
  onEdit(automation: Automation): void
  onDuplicate(automation: Automation): void
  onToggleStatus(automation: Automation): void
  onDelete(automation: Automation): void
  onTest(automation: Automation): void
  onViewHistory(automation: Automation): void
}

const statusFilterOptions: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'ACTIVE', label: 'Ativas' },
  { id: 'PAUSED', label: 'Pausadas' },
  { id: 'DRAFT', label: 'Rascunhos' },
  { id: 'errors', label: 'Com erro' },
]

export function AutomationList({
  automations,
  loading,
  canManage,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
  onTest,
  onViewHistory,
}: AutomationListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [triggerFilter, setTriggerFilter] = useState<AutomationTriggerType | 'all'>('all')

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return automations.filter((automation) => {
      if (statusFilter === 'errors' && !(automation.metrics && automation.metrics.failuresToday > 0)) return false
      if (statusFilter !== 'all' && statusFilter !== 'errors' && automation.status !== statusFilter) return false
      if (triggerFilter !== 'all' && automation.trigger.type !== triggerFilter) return false

      if (
        normalizedSearch &&
        !automation.name.toLowerCase().includes(normalizedSearch) &&
        !(automation.description ?? '').toLowerCase().includes(normalizedSearch)
      ) {
        return false
      }

      return true
    })
  }, [automations, search, statusFilter, triggerFilter])

  return (
    <div className="automation-list">
      <div className="quick-reply-form-row">
        <label className="field-label">
          Buscar
          <input
            className="select-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome ou descrição"
          />
        </label>
        <label className="field-label">
          Evento
          <select
            className="select-input"
            value={triggerFilter}
            onChange={(event) => setTriggerFilter(event.target.value as AutomationTriggerType | 'all')}
          >
            <option value="all">Todos os eventos</option>
            {Object.entries(triggerTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="automation-status-filters">
        {statusFilterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`tag-chip ${statusFilter === option.id ? 'selected' : ''}`}
            onClick={() => setStatusFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && <p>Carregando automações...</p>}
      {!loading && filtered.length === 0 && <p className="empty-state">Nenhuma automação encontrada.</p>}

      <div className="automation-card-list">
        {filtered.map((automation) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            canManage={canManage}
            onEdit={() => onEdit(automation)}
            onDuplicate={() => onDuplicate(automation)}
            onToggleStatus={() => onToggleStatus(automation)}
            onDelete={() => onDelete(automation)}
            onTest={() => onTest(automation)}
            onViewHistory={() => onViewHistory(automation)}
          />
        ))}
      </div>
    </div>
  )
}
