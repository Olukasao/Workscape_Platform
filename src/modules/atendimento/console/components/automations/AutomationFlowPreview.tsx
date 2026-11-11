import { ArrowDown } from 'lucide-react'
import type { AutomationAction, AutomationConditionGroup, AutomationTrigger } from '../../types/automation'
import { describeAutomationActions, describeConditionGroup, describeTrigger } from '../../utils/automationDescriptions'

interface AutomationFlowPreviewProps {
  trigger: AutomationTrigger
  conditionGroups: AutomationConditionGroup[]
  actions: AutomationAction[]
  compact?: boolean
}

export function AutomationFlowPreview({ trigger, conditionGroups, actions, compact }: AutomationFlowPreviewProps) {
  const actionLines = describeAutomationActions(actions)

  return (
    <div className={`automation-flow ${compact ? 'compact' : ''}`}>
      <div className="automation-flow-card when">
        <span className="automation-flow-label">QUANDO</span>
        <p>{describeTrigger(trigger)}</p>
      </div>

      {conditionGroups.length > 0 && (
        <>
          <ArrowDown size={14} aria-hidden="true" className="automation-flow-arrow" />
          <div className="automation-flow-card if">
            <span className="automation-flow-label">SE</span>
            {conditionGroups.map((group) => (
              <p key={group.id}>{describeConditionGroup(group)}</p>
            ))}
          </div>
        </>
      )}

      <ArrowDown size={14} aria-hidden="true" className="automation-flow-arrow" />
      <div className="automation-flow-card then">
        <span className="automation-flow-label">ENTÃO</span>
        {actionLines.length === 0 ? (
          <p className="automation-flow-empty">Nenhuma ação adicionada.</p>
        ) : (
          <ol>
            {actionLines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
