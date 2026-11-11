import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  loadingLabel?: string
  loading?: boolean
  onConfirm(): void
  onCancel(): void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  loadingLabel,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="modal-icon danger">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="secondary-action" type="button" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="danger-action" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? (loadingLabel ?? 'Processando...') : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
