import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { macrosApi } from '../../services/api/macrosApi'
import { conversationTagOptions } from '../../utils/conversationTags'
import { createDefaultAction } from '../../utils/macroShortcuts'
import { createClientMessageId } from '../../utils/uuid'
import type { MacroAction, MacroActionType, MacroConditionOperator, MacroQueueOption } from '../../types/macro'
import type { ConversationPriority } from '../../types/domain'

const ACTION_TYPE_LABELS: Record<MacroActionType, string> = {
  SEND_MESSAGE: 'Enviar mensagem',
  ADD_TAG: 'Adicionar categoria',
  REMOVE_TAG: 'Remover categoria',
  SET_PRIORITY: 'Definir prioridade',
  ADD_INTERNAL_NOTE: 'Criar nota interna',
  TRANSFER_QUEUE: 'Transferir',
  WAIT: 'Aguardar',
  API_REQUEST: 'Consultar operação',
  CONDITION: 'Condição',
}

const PRIORITY_OPTIONS: Array<{ value: ConversationPriority; label: string }> = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

const CONDITION_OPERATORS: Array<{ value: MacroConditionOperator; label: string }> = [
  { value: 'EQUALS', label: 'é igual a' },
  { value: 'NOT_EQUALS', label: 'é diferente de' },
  { value: 'EXISTS', label: 'existe' },
  { value: 'NOT_EXISTS', label: 'não existe' },
  { value: 'CONTAINS', label: 'contém' },
  { value: 'GREATER_THAN', label: 'é maior que' },
  { value: 'LESS_THAN', label: 'é menor que' },
]

function parseConditionValue(raw: string): unknown {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  return raw
}

interface MacroActionListEditorProps {
  actions: MacroAction[]
  onChange(next: MacroAction[]): void
  emptyLabel?: string
}

export function MacroActionListEditor({ actions, onChange, emptyLabel }: MacroActionListEditorProps) {
  const [newType, setNewType] = useState<MacroActionType>('SEND_MESSAGE')

  function updateAt(index: number, next: MacroAction) {
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
    const copy: MacroAction = { ...action, id: createClientMessageId() }
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
        <MacroActionRow
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
          onChange={(event) => setNewType(event.target.value as MacroActionType)}
        >
          {Object.entries(ACTION_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary-action compact"
          onClick={() => onChange([...actions, createDefaultAction(newType)])}
        >
          <Plus size={14} aria-hidden="true" />
          Adicionar ação
        </button>
      </div>
    </div>
  )
}

interface MacroActionRowProps {
  action: MacroAction
  index: number
  total: number
  onChange(next: MacroAction): void
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

function MacroActionRow({
  action,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: MacroActionRowProps) {
  const queues = useQueueOptions()

  return (
    <div className="macro-action-row">
      <header className="macro-action-row-header">
        <span className="macro-action-row-index">{index + 1}</span>
        <strong>{ACTION_TYPE_LABELS[action.type]}</strong>
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
          <textarea
            value={action.text}
            onChange={(event) => onChange({ ...action, text: event.target.value })}
            rows={2}
          />
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
              value={action.queue}
              onChange={(event) => onChange({ ...action, queue: event.target.value })}
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
              value={action.queue}
              placeholder="Ex.: SUPORTE_N2"
              onChange={(event) => onChange({ ...action, queue: event.target.value })}
            />
          )}
        </label>
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

      {action.type === 'API_REQUEST' && (
        <>
          <label className="field-label">
            Operação (chave autorizada no backend)
            <input
              className="select-input"
              value={action.operation}
              placeholder="Ex.: customerDiagnostic.connectionStatus"
              onChange={(event) => onChange({ ...action, operation: event.target.value })}
            />
          </label>
          <label className="field-label">
            Guardar resultado em (context.results.*)
            <input
              className="select-input"
              value={action.key}
              placeholder="Ex.: connectionStatus"
              onChange={(event) => onChange({ ...action, key: event.target.value })}
            />
          </label>
        </>
      )}

      {action.type === 'CONDITION' && (
        <>
          <div className="macro-condition-row">
            <input
              className="select-input"
              value={action.condition.variable}
              placeholder="Ex.: regionalIncident.affected"
              onChange={(event) =>
                onChange({ ...action, condition: { ...action.condition, variable: event.target.value } })
              }
            />
            <select
              className="select-input"
              value={action.condition.operator}
              onChange={(event) =>
                onChange({
                  ...action,
                  condition: { ...action.condition, operator: event.target.value as MacroConditionOperator },
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
            <MacroActionListEditor
              actions={action.then}
              onChange={(next) => onChange({ ...action, then: next })}
            />
          </div>

          <div className="macro-condition-branch">
            <span className="macro-search-group-label">Se falso</span>
            <MacroActionListEditor
              actions={action.else ?? []}
              onChange={(next) => onChange({ ...action, else: next })}
            />
          </div>
        </>
      )}

      <div className="macro-action-row-footer">
        <label className="macro-action-error-strategy">
          Em caso de erro
          <select
            className="select-input compact"
            value={action.onError ?? 'STOP'}
            onChange={(event) =>
              onChange({ ...action, onError: event.target.value === 'CONTINUE' ? 'CONTINUE' : 'STOP' })
            }
          >
            <option value="STOP">Parar e perguntar</option>
            <option value="CONTINUE">Continuar automaticamente</option>
          </select>
        </label>

        <label className="macro-action-confirm-toggle">
          <input
            type="checkbox"
            checked={Boolean(action.confirm)}
            onChange={(event) =>
              onChange({
                ...action,
                confirm: event.target.checked
                  ? (action.confirm ?? { title: 'Confirmar esta ação?' })
                  : undefined,
              })
            }
          />
          Exigir confirmação manual antes de executar
        </label>

        {action.confirm && (
          <input
            className="select-input"
            value={action.confirm.title}
            placeholder="Título da confirmação"
            onChange={(event) => onChange({ ...action, confirm: { ...action.confirm!, title: event.target.value } })}
          />
        )}
      </div>
    </div>
  )
}
