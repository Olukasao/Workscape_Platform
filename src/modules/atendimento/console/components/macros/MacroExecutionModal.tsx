import { Zap } from 'lucide-react'
import type { Macro } from '../../types/macro'
import { describeMacroActions } from '../../utils/macroShortcuts'

interface MacroExecutionModalProps {
  macro: Macro | null
  onCancel(): void
  onConfirm(): void
}

export function MacroExecutionModal({ macro, onCancel, onConfirm }: MacroExecutionModalProps) {
  if (!macro) return null

  const steps = describeMacroActions(macro.actions)

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="macro-execution-title">
        <div className="modal-icon">
          <Zap size={22} aria-hidden="true" />
        </div>
        <h2 id="macro-execution-title">Executar macro</h2>
        <p className="modal-subtitle">{macro.name}</p>

        <p>Esta macro executará as ações a seguir, em ordem:</p>
        <ul className="macro-confirmation-list">
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ul>

        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="primary-action compact" onClick={onConfirm}>
            Executar macro
          </button>
        </div>
      </section>
    </div>
  )
}
