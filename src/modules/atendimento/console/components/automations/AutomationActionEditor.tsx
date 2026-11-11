import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { agentsApi } from '../../services/api/agentsApi'
import { macrosApi } from '../../services/api/macrosApi'
import type { AgentOption, ConversationPriority } from '../../types/domain'
import type {
  AutomationAction,
  AutomationActionType,
  AutomationConditionOperator,
} from '../../types/automation'
import type { Macro, MacroQueueOption } from '../../types/macro'
import { closeReasonOptions } from '../../utils/closeReasons'
import { conversationTagOptions } from '../../utils/conversationTags'
import { actionTypeLabels, createDefaultAutomationAction } from '../../utils/automationDescriptions'
import { createClientMessageId } from '../../utils/uuid'

const PRIORITY_OPTIONS: Array<{ value: ConversationPriority; label: string }> = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

const CONDITION_OPERATORS: Array<{ value: AutomationConditionOperator; label: string }> = [
  { value: 'EQUALS', label: 'é igual a' },
  { value: 'NOT_EQUALS', label: 'é diferente de' },
  { value: 'CONTAINS', label: 'contém' },
  { value: 'NOT_CONTAINS', label: 'não contém' },
  { value: 'STARTS_WITH', label: 'começa com' },
  { value: 'ENDS_WITH', label: 'termina com' },
  { value: 'EXISTS', label: 'existe' },
  { value: 'NOT_EXISTS', label: 'não existe' },
  { value: 'GREATER_THAN', label: 'é maior que' },
  { value: 'LESS_THAN', label: 'é menor que' },
]

function parseConditionValue(raw: string): unknown {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  return raw
}

interface AutomationActionListEditorProps {
  actions: AutomationAction[]
  onChange(next: AutomationAction[]): void
  emptyLabel?: string
}

export function AutomationActionListEditor({ actions, onChange, emptyLabel }: AutomationActionListEditorProps) {
  const [newType, setNewType] = useState<AutomationActionType>('SEND_MESSAGE')

  function updateAt(index: number, next: AutomationAction) {
    onChange(actions.map((action, itemIndex) => (itemIndex === index ? next : action)))
  }

  function moveAt(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= actions.length) return
    const next = [...actions]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    onChange(next)
  }

  function duplicateAt(index: number) {
    const action = actions[index]
    const copy: AutomationAction = { ...action, id: createClientMessageId() }
    const next = [...actions]
    next.splice(index + 1, 0, copy)
    onChange(next)
  }

  function removeAt(index: number) {
    onChange(actions.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className="macro-action-list">
      {actions.length === 0 && <p className="empty-state compact">{emptyLabel ?? 'Nenhuma ação adicionada.'}</p>}

      {actions.map((action, index) => (
        <AutomationActionRow
          key={action.id}
          action={action}
          index={index}
          total={actions.length}
          onChange={(next) => updateAt(index, next)}
          onMoveUp={() => moveAt(index, -1)}
          onMoveDown={() => moveAt(index, 1)}
          onDuplicate={() => duplicateAt(index)}
          onDelete={() => removeAt(index)}
        />
      ))}

      <div className="macro-action-add">
        <select
          className="select-input"
          value={newType}
          onChange={(event) => setNewType(event.target.value as AutomationActionType)}
        >
          {Object.entries(actionTypeLabels).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary-action compact"
          onClick={() => onChange([...actions, createDefaultAutomationAction(newType)])}
        >
          <Plus size={14} aria-hidden="true" />
          Adicionar ação
        </button>
      </div>
    </div>
  )
}

interface AutomationActionRowProps {
  action: AutomationAction
  index: number
  total: number
  onChange(next: AutomationAction): void
  onMoveUp(): void
  onMoveDown(): void
  onDuplicate(): void
  onDelete(): void
}

function useQueueOptions(): MacroQueueOption[] {
  const [queues, setQueues] = useState<MacroQueueOption[]>([])

  useEffect(() => {
    macrosApi
      .listQueues()
      .then(setQueues)
      .catch(() => setQueues([]))
  }, [])

  return queues
}

function useMacroOptions(): Macro[] {
  const [macroList, setMacroList] = useState<Macro[]>([])

  useEffect(() => {
    macrosApi
      .list()
      .then(setMacroList)
      .catch(() => setMacroList([]))
  }, [])

  return macroList
}

function useAgentOptions(): AgentOption[] {
  const [agentList, setAgentList] = useState<AgentOption[]>([])

  useEffect(() => {
    agentsApi
      .listMembers()
      .then(setAgentList)
      .catch(() => setAgentList([]))
  }, [])

  return agentList
}

function AutomationActionRow({
  action,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: AutomationActionRowProps) {
  const queues = useQueueOptions()
  const macroOptions = useMacroOptions()
  const agentOptions = useAgentOptions()

  return (
    <div className="macro-action-row">
      <header className="macro-action-row-header">
        <span className="macro-action-row-index">{index + 1}</span>
        <strong>{actionTypeLabels[action.type]}</strong>
        <div className="macro-action-row-controls">
          <button type="button" className="icon-button" disabled={index === 0} onClick={onMoveUp} aria-label="Mover para cima">
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            aria-label="Mover para baixo"
          >
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" onClick={onDuplicate} aria-label="Duplicar ação">
            <Copy size={14} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button danger" onClick={onDelete} aria-label="Excluir ação">
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      {(action.type === 'SEND_MESSAGE' || action.type === 'ADD_INTERNAL_NOTE') && (
        <label className="field-label">
          Texto (use {'{{customer.name}}'} para variáveis)
          <textarea value={action.text} onChange={(event) => onChange({ ...action, text: event.target.value })} rows={2} />
        </label>
      )}

      {(action.type === 'ADD_TAG' || action.type === 'REMOVE_TAG') && (
        <label className="field-label">
          Categoria
          <select
            className="select-input"
            value={action.tag}
            onChange={(event) => onChange({ ...action, tag: event.target.value as typeof action.tag })}
          >
            {conversationTagOptions.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {action.type === 'SET_PRIORITY' && (
        <label className="field-label">
          Prioridade
          <select
            className="select-input"
            value={action.priority}
            onChange={(event) => onChange({ ...action, priority: event.target.value as ConversationPriority })}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {action.type === 'TRANSFER_QUEUE' && (
        <label className="field-label">
          Fila
          {queues.length > 0 ? (
            <select
              className="select-input"
              value={action.queueId}
              onChange={(event) => onChange({ ...action, queueId: event.target.value })}
            >
              <option value="">Selecione</option>
              {queues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="select-input"
              value={action.queueId}
              placeholder="Ex.: SUPORTE_N2"
              onChange={(event) => onChange({ ...action, queueId: event.target.value })}
            />
          )}
        </label>
      )}

      {action.type === 'ASSIGN_AGENT' && (
        <label className="field-label">
          Atendente
          <select
            className="select-input"
            value={action.agentId}
            onChange={(event) => onChange({ ...action, agentId: event.target.value })}
          >
            <option value="">Selecione</option>
            {agentOptions.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {action.type === 'CLOSE_TICKET' && (
        <>
          <label className="field-label">
            Motivo do encerramento
            <select
              className="select-input"
              value={action.closeReason ?? ''}
              onChange={(event) =>
                onChange({ ...action, closeReason: (event.target.value || undefined) as typeof action.closeReason })
              }
            >
              <option value="">Padrão (resolvido)</option>
              {closeReasonOptions.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Observação (opcional)
            <input
              className="select-input"
              value={action.note ?? ''}
              onChange={(event) => onChange({ ...action, note: event.target.value })}
            />
          </label>
        </>
      )}

      {action.type === 'WAIT' && (
        <label className="field-label">
          Aguardar (ms)
          <input
            type="number"
            min={0}
            className="select-input"
            value={action.ms}
            onChange={(event) => onChange({ ...action, ms: Number(event.target.value) || 0 })}
          />
        </label>
      )}

      {action.type === 'RUN_MACRO' && (
        <label className="field-label">
          Macro
          <select
            className="select-input"
            value={action.macroId}
            onChange={(event) => onChange({ ...action, macroId: event.target.value })}
          >
            <option value="">Selecione</option>
            {macroOptions.map((macro) => (
              <option key={macro.id} value={macro.id}>
                {macro.shortcut} — {macro.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {action.type === 'API_OPERATION' && (
        <>
          <label className="field-label">
            Operação (chave autorizada no backend)
            <input
              className="select-input"
              value={action.operation}
              placeholder="Ex.: customerDiagnostic.regionalIncident"
              onChange={(event) => onChange({ ...action, operation: event.target.value })}
            />
          </label>
          <label className="field-label">
            Guardar resultado em (contexto.*)
            <input
              className="select-input"
              value={action.resultKey}
              placeholder="Ex.: regionalIncident"
              onChange={(event) => onChange({ ...action, resultKey: event.target.value })}
            />
          </label>
        </>
      )}

      {action.type === 'CONDITION' && (
        <>
          <div className="macro-condition-row">
            <input
              className="select-input"
              value={action.condition.field}
              placeholder="Ex.: regionalIncident.affected"
              onChange={(event) =>
                onChange({ ...action, condition: { ...action.condition, field: event.target.value } })
              }
            />
            <select
              className="select-input"
              value={action.condition.operator}
              onChange={(event) =>
                onChange({
                  ...action,
                  condition: { ...action.condition, operator: event.target.value as AutomationConditionOperator },
                })
              }
            >
              {CONDITION_OPERATORS.map((operator) => (
                <option key={operator.value} value={operator.value}>
                  {operator.label}
                </option>
              ))}
            </select>
            {action.condition.operator !== 'EXISTS' && action.condition.operator !== 'NOT_EXISTS' && (
              <input
                className="select-input"
                value={String(action.condition.value ?? '')}
                placeholder="Valor"
                onChange={(event) =>
                  onChange({
                    ...action,
                    condition: { ...action.condition, value: parseConditionValue(event.target.value) },
                  })
                }
              />
            )}
          </div>

          <div className="macro-condition-branch">
            <span className="macro-search-group-label">Se verdadeiro</span>
            <AutomationActionListEditor actions={action.then} onChange={(next) => onChange({ ...action, then: next })} />
          </div>

          <div className="macro-condition-branch">
            <span className="macro-search-group-label">Se falso</span>
            <AutomationActionListEditor
              actions={action.else ?? []}
              onChange={(next) => onChange({ ...action, else: next })}
            />
          </div>
        </>
      )}
    </div>
  )
}
