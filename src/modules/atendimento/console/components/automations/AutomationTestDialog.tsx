import { AlertTriangle, Check, CircleDashed, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import { useAutomationPreview } from '../../hooks/useAutomationPreview'
import type { Automation, AutomationPreviewInput, AutomationPreviewStep } from '../../types/automation'
import type { ConversationPriority, ConversationStatus, ConversationTag } from '../../types/domain'
import { conversationTagOptions } from '../../utils/conversationTags'

interface AutomationTestDialogProps {
  automation: Automation | null
  onClose(): void
}

const STATUS_OPTIONS: Array<{ value: ConversationStatus; label: string }> = [
  { value: 'new', label: 'Novo' },
  { value: 'open', label: 'Em atendimento' },
  { value: 'waiting_customer', label: 'Aguardando cliente' },
  { value: 'waiting_agent', label: 'Aguardando atendente' },
  { value: 'closed', label: 'Encerrado' },
]

const PRIORITY_OPTIONS: Array<{ value: ConversationPriority; label: string }> = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

function StepIcon({ status }: { status: AutomationPreviewStep['status'] }) {
  if (status === 'WOULD_RUN') return <Check size={14} className="macro-step-icon success" aria-hidden="true" />
  if (status === 'SKIPPED') return <AlertTriangle size={14} className="macro-step-icon skipped" aria-hidden="true" />
  return <CircleDashed size={14} className="macro-step-icon pending" aria-hidden="true" />
}

export function AutomationTestDialog({ automation, onClose }: AutomationTestDialogProps) {
  const { result, running, error, run, reset } = useAutomationPreview()
  const [input, setInput] = useState<AutomationPreviewInput>({
    message: '',
    tags: [],
    waitingMinutes: 0,
    customerName: 'Cliente',
  })

  if (!automation) return null

  function toggleTag(tag: ConversationTag) {
    setInput((current) => ({
      ...current,
      tags: current.tags?.includes(tag) ? current.tags.filter((item) => item !== tag) : [...(current.tags ?? []), tag],
    }))
  }

  function close() {
    reset()
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel wide-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-test-title"
      >
        <div className="modal-icon">
          <PlayCircle size={22} aria-hidden="true" />
        </div>
        <h2 id="automation-test-title">Testar automação</h2>
        <p className="modal-subtitle">{automation.name}</p>
        <p>Dados de exemplo — este teste roda só localmente e nunca altera um atendimento real.</p>

        <label className="field-label">
          Mensagem de exemplo
          <textarea
            value={input.message ?? ''}
            onChange={(event) => setInput((current) => ({ ...current, message: event.target.value }))}
            rows={2}
            placeholder="estou sem internet desde ontem"
          />
        </label>

        <div className="quick-reply-form-row">
          <label className="field-label">
            Status do atendimento
            <select
              className="select-input"
              value={input.status ?? ''}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  status: (event.target.value || undefined) as ConversationStatus | undefined,
                }))
              }
            >
              <option value="">(não informado)</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Prioridade atual
            <select
              className="select-input"
              value={input.priority ?? ''}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  priority: (event.target.value || undefined) as ConversationPriority | undefined,
                }))
              }
            >
              <option value="">(não informado)</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field-label">
          Minutos sem resposta do cliente
          <input
            type="number"
            min={0}
            className="select-input"
            value={input.waitingMinutes ?? 0}
            onChange={(event) =>
              setInput((current) => ({ ...current, waitingMinutes: Number(event.target.value) || 0 }))
            }
          />
        </label>

        <div className="tag-options">
          {conversationTagOptions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`tag-chip ${input.tags?.includes(tag.id) ? 'selected' : ''}`}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={close}>
            Fechar
          </button>
          <button
            type="button"
            className="primary-action compact"
            disabled={running}
            onClick={() => void run(automation, input)}
          >
            {running ? 'Testando...' : 'Testar automação'}
          </button>
        </div>

        {result && (
          <div className="automation-test-result">
            <p>
              <strong>Trigger:</strong> {result.triggerMatched ? 'correspondeu' : 'não correspondeu'}
            </p>
            <p>
              <strong>Condições:</strong> {result.conditionsMatched ? 'atendidas' : 'não atendidas'}
            </p>
            <ol className="macro-progress-list">
              {result.steps.map((step) => (
                <li
                  key={step.id}
                  className={`macro-progress-step ${step.status === 'WOULD_RUN' ? 'success' : step.status === 'SKIPPED' ? 'skipped' : 'pending'}`}
                >
                  <div className="macro-progress-step-row">
                    <StepIcon status={step.status} />
                    <span>{step.label}</span>
                  </div>
                  {step.detail && <p className="automation-step-detail">{step.detail}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  )
}
