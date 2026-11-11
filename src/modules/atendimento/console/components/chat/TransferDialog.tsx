import { Forward } from 'lucide-react'
import { useState } from 'react'
import type { AgentOption } from '../../types/domain'

interface TransferDialogProps {
  open: boolean
  agents: AgentOption[]
  loading: boolean
  onCancel(): void
  onConfirm(agentId: string): void
}

export function TransferDialog({
  open,
  agents,
  loading,
  onCancel,
  onConfirm,
}: TransferDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState('')

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
        <div className="modal-icon">
          <Forward size={22} aria-hidden="true" />
        </div>
        <h2 id="transfer-title">Transferir atendimento</h2>
        <label className="field-label" htmlFor="target-agent">
          Atendente
        </label>
        <select
          id="target-agent"
          className="select-input"
          value={selectedAgentId}
          onChange={(event) => setSelectedAgentId(event.target.value)}
        >
          <option value="">Selecione</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
              {agent.departmentName ? ` • ${agent.departmentName}` : ''}{' '}
              {agent.online ? '• online' : '• offline'}
            </option>
          ))}
        </select>
        <div className="modal-actions">
          <button className="secondary-action" type="button" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className="primary-action compact"
            type="button"
            onClick={() => onConfirm(selectedAgentId)}
            disabled={loading || !selectedAgentId}
          >
            {loading ? 'Transferindo...' : 'Transferir'}
          </button>
        </div>
      </section>
    </div>
  )
}
