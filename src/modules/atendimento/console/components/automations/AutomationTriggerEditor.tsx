import type { AutomationTrigger, AutomationTriggerType } from '../../types/automation'
import { conversationTagOptions } from '../../utils/conversationTags'
import { triggerTypeLabels } from '../../utils/automationDescriptions'

interface AutomationTriggerEditorProps {
  trigger: AutomationTrigger
  onChange(next: AutomationTrigger): void
}

function createDefaultTrigger(type: AutomationTriggerType): AutomationTrigger {
  switch (type) {
    case 'CUSTOMER_INACTIVE':
    case 'AGENT_INACTIVE':
      return { type, minutes: 10 }
    case 'SLA_WARNING':
      return { type, thresholdPercent: 80 }
    case 'TAG_ADDED':
      return { type }
    default:
      return { type }
  }
}

export function AutomationTriggerEditor({ trigger, onChange }: AutomationTriggerEditorProps) {
  return (
    <div className="automation-trigger-editor">
      <select
        className="select-input"
        value={trigger.type}
        onChange={(event) => onChange(createDefaultTrigger(event.target.value as AutomationTriggerType))}
      >
        {Object.entries(triggerTypeLabels).map(([type, label]) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>

      {(trigger.type === 'CUSTOMER_INACTIVE' || trigger.type === 'AGENT_INACTIVE') && (
        <label className="field-label">
          Minutos sem resposta
          <input
            type="number"
            min={1}
            className="select-input"
            value={trigger.minutes}
            onChange={(event) => onChange({ ...trigger, minutes: Number(event.target.value) || 1 })}
          />
        </label>
      )}

      {trigger.type === 'SLA_WARNING' && (
        <label className="field-label">
          % do limite de SLA
          <input
            type="number"
            min={1}
            max={100}
            className="select-input"
            value={trigger.thresholdPercent}
            onChange={(event) => onChange({ ...trigger, thresholdPercent: Number(event.target.value) || 1 })}
          />
        </label>
      )}

      {trigger.type === 'TAG_ADDED' && (
        <label className="field-label">
          Categoria (opcional — vazio considera qualquer categoria)
          <select
            className="select-input"
            value={trigger.tag ?? ''}
            onChange={(event) =>
              onChange({ ...trigger, tag: (event.target.value || undefined) as typeof trigger.tag })
            }
          >
            <option value="">Qualquer categoria</option>
            {conversationTagOptions.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
