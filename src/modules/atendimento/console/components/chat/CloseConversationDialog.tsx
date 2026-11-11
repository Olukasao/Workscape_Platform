import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ConversationCloseReason } from '../../types/domain'
import { closeReasonOptions } from '../../utils/closeReasons'

interface CloseConversationDialogProps {
  open: boolean
  loading?: boolean
  onConfirm(reason: ConversationCloseReason, note: string): void
  onCancel(): void
}

export function CloseConversationDialog({
  open,
  loading,
  onConfirm,
  onCancel,
}: CloseConversationDialogProps) {
  const [reason, setReason] = useState<ConversationCloseReason>('resolved')
  const [note, setNote] = useState('')
  const otherReasonMissingNote = reason === 'other' && !note.trim()

  useEffect(() => {
    if (!open) return

    setReason('resolved')
    setNote('')
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="close-title">
        <div className="modal-icon danger">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>
        <h2 id="close-title">Encerrar atendimento</h2>
        <p>Informe o motivo do encerramento para manter o histórico do atendimento organizado.</p>

        <label className="modal-field">
          <span className="field-label">Motivo</span>
          <select
            className="select-input"
            value={reason}
            onChange={(event) => setReason(event.target.value as ConversationCloseReason)}
            disabled={loading}
          >
            {closeReasonOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="modal-field">
          <span className="field-label">Observação</span>
          <textarea
            className="modal-textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Detalhe o encerramento se precisar..."
            rows={3}
            disabled={loading}
          />
        </label>

        <div className="modal-actions">
          <button className="secondary-action" type="button" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className="danger-action"
            type="button"
            onClick={() => onConfirm(reason, note.trim())}
            disabled={loading || otherReasonMissingNote}
          >
            {loading ? 'Encerrando...' : 'Encerrar'}
          </button>
        </div>
      </section>
    </div>
  )
}
