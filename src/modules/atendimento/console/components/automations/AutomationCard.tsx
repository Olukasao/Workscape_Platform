import { Clock3, Copy, History, Pencil, PlayCircle, Trash2 } from 'lucide-react'
import type { Automation } from '../../types/automation'
import { formatRelativeTime } from '../../utils/dates'
import { AutomationFlowPreview } from './AutomationFlowPreview'

interface AutomationCardProps {
  automation: Automation
  canManage: boolean
  onEdit(): void
  onDuplicate(): void
  onToggleStatus(): void
  onDelete(): void
  onTest(): void
  onViewHistory(): void
}

const statusMeta: Record<Automation['status'], { label: string; className: string }> = {
  ACTIVE: { label: 'Ativa', className: 'active' },
  PAUSED: { label: 'Pausada', className: 'paused' },
  DRAFT: { label: 'Rascunho', className: 'draft' },
}

export function AutomationCard({
  automation,
  canManage,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
  onTest,
  onViewHistory,
}: AutomationCardProps) {
  const status = statusMeta[automation.status]
  const metrics = automation.metrics

  return (
    <article className="automation-card">
      <header className="automation-card-header">
        <div>
          <h3>{automation.name}</h3>
          {automation.description && <p className="automation-card-description">{automation.description}</p>}
        </div>
        <span className={`automation-status-pill ${status.className}`}>
          <span aria-hidden="true" />
          {status.label}
        </span>
      </header>

      <AutomationFlowPreview
        trigger={automation.trigger}
        conditionGroups={automation.conditionGroups}
        actions={automation.actions}
        compact
      />

      {metrics && (
        <div className="automation-card-metrics">
          <span>{metrics.executionsToday} execuções hoje</span>
          {metrics.successRatePercent !== null && <span>{metrics.successRatePercent.toFixed(1)}% sucesso</span>}
          {metrics.failuresToday > 0 && <span className="automation-metric-warning">{metrics.failuresToday} falha(s)</span>}
          <span>
            <Clock3 size={12} aria-hidden="true" />
            {metrics.lastExecutionAt ? `Última execução ${formatRelativeTime(metrics.lastExecutionAt)}` : 'Sem execuções ainda'}
          </span>
        </div>
      )}

      <div className="automation-card-actions">
        <button type="button" className="secondary-action compact" onClick={onTest}>
          <PlayCircle size={14} aria-hidden="true" />
          Testar
        </button>
        <button type="button" className="secondary-action compact" onClick={onViewHistory}>
          <History size={14} aria-hidden="true" />
          Execuções
        </button>
        {canManage && (
          <>
            <button type="button" className="secondary-action compact" onClick={onEdit}>
              <Pencil size={14} aria-hidden="true" />
              Editar
            </button>
            <button type="button" className="secondary-action compact" onClick={onDuplicate}>
              <Copy size={14} aria-hidden="true" />
              Duplicar
            </button>
            <button type="button" className="secondary-action compact" onClick={onToggleStatus}>
              {automation.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}
            </button>
            <button type="button" className="secondary-action danger-secondary compact" onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" />
              Excluir
            </button>
          </>
        )}
      </div>
    </article>
  )
}
