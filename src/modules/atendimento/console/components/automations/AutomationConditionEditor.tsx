import { Plus, Trash2 } from 'lucide-react'
import type {
  AutomationCondition,
  AutomationConditionGroup,
  AutomationConditionGroupOperator,
  AutomationConditionOperator,
} from '../../types/automation'
import { conditionOperatorLabels } from '../../utils/automationDescriptions'
import { createClientMessageId } from '../../utils/uuid'

interface AutomationConditionEditorProps {
  conditionGroups: AutomationConditionGroup[]
  onChange(next: AutomationConditionGroup[]): void
}

function createCondition(): AutomationCondition {
  return { id: createClientMessageId(), field: '', operator: 'CONTAINS', value: '' }
}

function createGroup(): AutomationConditionGroup {
  return { id: createClientMessageId(), operator: 'OR', conditions: [createCondition()] }
}

export function AutomationConditionEditor({ conditionGroups, onChange }: AutomationConditionEditorProps) {
  function updateGroup(index: number, next: AutomationConditionGroup) {
    onChange(conditionGroups.map((group, groupIndex) => (groupIndex === index ? next : group)))
  }

  function removeGroup(index: number) {
    onChange(conditionGroups.filter((_, groupIndex) => groupIndex !== index))
  }

  function updateCondition(groupIndex: number, conditionIndex: number, patch: Partial<AutomationCondition>) {
    const group = conditionGroups[groupIndex]
    const nextConditions = group.conditions.map((condition, index) =>
      index === conditionIndex ? { ...condition, ...patch } : condition,
    )
    updateGroup(groupIndex, { ...group, conditions: nextConditions })
  }

  return (
    <div className="automation-condition-editor">
      {conditionGroups.length === 0 && (
        <p className="empty-state compact">Sem condições — a automação roda sempre que o evento acontecer.</p>
      )}

      {conditionGroups.map((group, groupIndex) => (
        <div className="automation-condition-group" key={group.id}>
          <div className="automation-condition-group-header">
            <select
              className="select-input compact"
              value={group.operator}
              onChange={(event) =>
                updateGroup(groupIndex, { ...group, operator: event.target.value as AutomationConditionGroupOperator })
              }
            >
              <option value="OR">QUALQUER condição (OU)</option>
              <option value="AND">TODAS as condições (E)</option>
            </select>
            <button
              type="button"
              className="icon-button danger"
              onClick={() => removeGroup(groupIndex)}
              aria-label="Remover grupo de condições"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>

          {group.conditions.map((condition, conditionIndex) => (
            <div className="automation-condition-row" key={condition.id}>
              <input
                className="select-input"
                value={condition.field}
                placeholder="Ex.: message.text"
                onChange={(event) => updateCondition(groupIndex, conditionIndex, { field: event.target.value })}
              />
              <select
                className="select-input"
                value={condition.operator}
                onChange={(event) =>
                  updateCondition(groupIndex, conditionIndex, {
                    operator: event.target.value as AutomationConditionOperator,
                  })
                }
              >
                {Object.entries(conditionOperatorLabels).map(([operator, label]) => (
                  <option key={operator} value={operator}>
                    {label}
                  </option>
                ))}
              </select>
              {condition.operator !== 'EXISTS' && condition.operator !== 'NOT_EXISTS' && (
                <input
                  className="select-input"
                  value={String(condition.value ?? '')}
                  placeholder="Valor"
                  onChange={(event) => updateCondition(groupIndex, conditionIndex, { value: event.target.value })}
                />
              )}
              <button
                type="button"
                className="icon-button danger"
                aria-label="Remover condição"
                onClick={() =>
                  updateGroup(groupIndex, {
                    ...group,
                    conditions: group.conditions.filter((_, index) => index !== conditionIndex),
                  })
                }
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="secondary-action compact"
            onClick={() => updateGroup(groupIndex, { ...group, conditions: [...group.conditions, createCondition()] })}
          >
            <Plus size={14} aria-hidden="true" />
            Adicionar condição
          </button>
        </div>
      ))}

      <button
        type="button"
        className="secondary-action compact"
        onClick={() => onChange([...conditionGroups, createGroup()])}
      >
        <Plus size={14} aria-hidden="true" />
        Adicionar grupo de condições
      </button>
    </div>
  )
}
