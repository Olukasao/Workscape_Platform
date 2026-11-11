import { AlertTriangle, Check, CircleDashed, History, Loader2, SkipForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import { automationsApi } from '../../services/api/automationsApi'
import type { Automation, AutomationExecution, AutomationExecutionStep } from '../../types/automation'
import { formatClock, formatRelativeTime } from '../../utils/dates'
import { getReadableError } from '../../utils/errors'

interface AutomationExecutionHistoryProps {
  automation: Automation | null
  onClose(): void
}

function StepIcon({ status }: { status: AutomationExecutionStep['status'] }) {
  if (status === 'SUCCESS') return <Check size={14} className="macro-step-icon success" aria-hidden="true" />
  if (status === 'RUNNING') return <Loader2 size={14} className="macro-step-icon running spin" aria-hidden="true" />
  if (status === 'FAILED') return <AlertTriangle size={14} className="macro-step-icon failed" aria-hidden="true" />
  if (status === 'SKIPPED') return <SkipForward size={14} className="macro-step-icon skipped" aria-hidden="true" />
  return <CircleDashed size={14} className="macro-step-icon pending" aria-hidden="true" />
}

export function AutomationExecutionHistory({ automation, onClose }: AutomationExecutionHistoryProps) {
  const [executions, setExecutions] = useState<AutomationExecution[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AutomationExecution | null>(null)

  useEffect(() => {
    if (!automation) return

    setLoading(true)
    setError('')
    setSelected(null)
    automationsApi
      .listExecutions(automation.id)
      .then((response) => setExecutions(response.data))
      .catch((err) => setError(getReadableError(err, 'Não foi possível carregar o histórico.')))
      .finally(() => setLoading(false))
  }, [automation])

  if (!automation) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel wide-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-icon">
          <History size={22} aria-hidden="true" />
        </div>
        <h2 id="automation-history-title">Execuções</h2>
        <p className="modal-subtitle">{automation.name}</p>

        {error && <p className="form-error">{error}</p>}
        {loading && <p>Carregando...</p>}

        {!loading && !selected && (
          <div className="quick-reply-list">
            {executions.length === 0 && <p className="empty-state">Nenhuma execução registrada ainda.</p>}
            {executions.map((execution) => (
              <button
                type="button"
                key={execution.id}
                className="automation-execution-row"
                onClick={() => setSelected(execution)}
              >
                <span>{formatClock(execution.startedAt)}</span>
                <span>Ticket #{execution.ticketId ?? '—'}</span>
                <span className={`automation-execution-status ${execution.status.toLowerCase()}`}>
                  {execution.status}
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="automation-execution-detail">
            <button type="button" className="secondary-action compact" onClick={() => setSelected(null)}>
              ← Voltar
            </button>
            <p>
              Ticket #{selected.ticketId ?? '—'} · Início {formatClock(selected.startedAt)} ·{' '}
              {formatRelativeTime(selected.startedAt)}
            </p>
            <ol className="macro-progress-list">
              {selected.steps.map((step) => (
                <li key={step.id} className={`macro-progress-step ${step.status.toLowerCase()}`}>
                  <div className="macro-progress-step-row">
                    <StepIcon status={step.status} />
                    <span>{step.label}</span>
                  </div>
                  {step.error && <p className="form-error compact">{step.error}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onClose}>
            Fechar
          </button>
        </div>
      </section>
    </div>
  )
}
