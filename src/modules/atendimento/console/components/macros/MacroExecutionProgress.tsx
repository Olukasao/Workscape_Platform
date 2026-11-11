import { AlertTriangle, Check, CircleDashed, Loader2, SkipForward, Zap } from 'lucide-react'
import type { MacroExecutionState } from '../../types/macro'
import { describeMacroAction } from '../../utils/macroShortcuts'

interface MacroExecutionProgressProps {
  state: MacroExecutionState
  pendingGate: { kind: 'confirm' | 'error'; path: string } | null
  onConfirmStep(proceed: boolean): void
  onResolveError(decision: 'retry' | 'continue' | 'cancel'): void
  onCancel(): void
  onClose(): void
}

function StepIcon({ status }: { status: MacroExecutionState['steps'][number]['status'] }) {
  if (status === 'success') return <Check size={15} className="macro-step-icon success" aria-hidden="true" />
  if (status === 'running') return <Loader2 size={15} className="macro-step-icon running spin" aria-hidden="true" />
  if (status === 'failed') return <AlertTriangle size={15} className="macro-step-icon failed" aria-hidden="true" />
  if (status === 'skipped') return <SkipForward size={15} className="macro-step-icon skipped" aria-hidden="true" />
  if (status === 'awaiting_confirmation')
    return <AlertTriangle size={15} className="macro-step-icon pending" aria-hidden="true" />
  return <CircleDashed size={15} className="macro-step-icon pending" aria-hidden="true" />
}

export function MacroExecutionProgress({
  state,
  pendingGate,
  onConfirmStep,
  onResolveError,
  onCancel,
  onClose,
}: MacroExecutionProgressProps) {
  if (state.status === 'idle' || !state.macro) return null

  const finished = state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled'

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="macro-progress-title">
        <div className="modal-icon">
          <Zap size={22} aria-hidden="true" />
        </div>
        <h2 id="macro-progress-title">Executando macro</h2>
        <p className="modal-subtitle">{state.macro.name}</p>

        <ol className="macro-progress-list">
          {state.steps.map((step) => (
            <li key={step.path} className={`macro-progress-step ${step.status}`}>
              <div className="macro-progress-step-row">
                <StepIcon status={step.status} />
                <span>{describeMacroAction(step.action)}</span>
              </div>

              {step.status === 'failed' && step.error && <p className="form-error compact">{step.error}</p>}

              {step.status === 'failed' && pendingGate?.kind === 'error' && pendingGate.path === step.path && (
                <div className="macro-progress-gate-actions">
                  <button type="button" className="secondary-action compact" onClick={() => onResolveError('retry')}>
                    Tentar novamente
                  </button>
                  <button
                    type="button"
                    className="secondary-action compact"
                    onClick={() => onResolveError('continue')}
                  >
                    Continuar
                  </button>
                  <button
                    type="button"
                    className="secondary-action danger-secondary compact"
                    onClick={() => onResolveError('cancel')}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {step.status === 'awaiting_confirmation' &&
                pendingGate?.kind === 'confirm' &&
                pendingGate.path === step.path &&
                step.action.confirm && (
                  <div className="macro-progress-confirm">
                    <p>
                      <strong>{step.action.confirm.title}</strong>
                    </p>
                    {step.action.confirm.description && <p>{step.action.confirm.description}</p>}
                    <div className="macro-progress-gate-actions">
                      <button
                        type="button"
                        className="secondary-action compact"
                        onClick={() => onConfirmStep(false)}
                      >
                        {step.action.confirm.skipLabel ?? 'Pular'}
                      </button>
                      <button
                        type="button"
                        className="primary-action compact"
                        onClick={() => onConfirmStep(true)}
                      >
                        {step.action.confirm.confirmLabel ?? 'Confirmar'}
                      </button>
                    </div>
                  </div>
                )}
            </li>
          ))}
        </ol>

        {state.status === 'completed' && <p className="macro-progress-summary success">✓ Macro concluída</p>}
        {state.status === 'failed' && <p className="macro-progress-summary failed">⚠ Macro encerrada com falhas</p>}
        {state.status === 'cancelled' && <p className="macro-progress-summary">Macro cancelada</p>}

        <div className="modal-actions">
          {!finished && (
            <button type="button" className="secondary-action danger-secondary" onClick={onCancel}>
              Cancelar execução
            </button>
          )}
          {finished && (
            <button type="button" className="primary-action compact" onClick={onClose}>
              Fechar
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
