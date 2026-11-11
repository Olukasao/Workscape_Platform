import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { macrosApi } from '../../services/api/macrosApi'
import type { Automation, AutomationConditionGroup, AutomationInput, AutomationTrigger } from '../../types/automation'
import {
  automationClosesTickets,
  automationSendsMessages,
  validateAutomation,
} from '../../utils/automationValidation'
import { AutomationActionListEditor } from './AutomationActionEditor'
import { AutomationConditionEditor } from './AutomationConditionEditor'
import { AutomationFlowPreview } from './AutomationFlowPreview'
import { AutomationTriggerEditor } from './AutomationTriggerEditor'

interface AutomationEditorProps {
  automation: Automation | null
  saving: boolean
  onCancel(): void
  onSave(input: AutomationInput): void
}

function toInput(automation: Automation | null): AutomationInput {
  return {
    name: automation?.name ?? '',
    description: automation?.description ?? '',
    status: automation?.status ?? 'DRAFT',
    priority: automation?.priority ?? 10,
    stopProcessing: automation?.stopProcessing ?? false,
    trigger: automation?.trigger ?? { type: 'MESSAGE_RECEIVED' },
    conditionGroups: automation?.conditionGroups ?? [],
    actions: automation?.actions ?? [],
  }
}

export function AutomationEditor({ automation, saving, onCancel, onSave }: AutomationEditorProps) {
  const [form, setForm] = useState<AutomationInput>(() => toInput(automation))
  const [queueIds, setQueueIds] = useState<string[]>([])
  const [macroIds, setMacroIds] = useState<string[]>([])
  const [activationErrors, setActivationErrors] = useState<string[]>([])

  useEffect(() => {
    macrosApi
      .listQueues()
      .then((queues) => setQueueIds(queues.map((queue) => queue.id)))
      .catch(() => setQueueIds([]))
    macrosApi
      .list()
      .then((macroList) => setMacroIds(macroList.map((macro) => macro.id)))
      .catch(() => setMacroIds([]))
  }, [])

  const sendsMessages = useMemo(() => automationSendsMessages(form), [form])
  const closesTickets = useMemo(() => automationClosesTickets(form), [form])

  function setTrigger(trigger: AutomationTrigger) {
    setForm((current) => ({ ...current, trigger }))
  }

  function setConditionGroups(conditionGroups: AutomationConditionGroup[]) {
    setForm((current) => ({ ...current, conditionGroups }))
  }

  function setActions(actions: AutomationInput['actions']) {
    setForm((current) => ({ ...current, actions }))
  }

  function saveDraft() {
    setActivationErrors([])
    onSave({ ...form, status: 'DRAFT' })
  }

  function saveAndActivate() {
    const errors = validateAutomation(form, { queueIds, macroIds })
    if (errors.length > 0) {
      setActivationErrors(errors)
      return
    }

    setActivationErrors([])
    onSave({ ...form, status: 'ACTIVE' })
  }

  const canSave = form.name.trim().length > 0

  return (
    <div className="automation-editor">
      <div className="quick-reply-form-row">
        <label className="field-label">
          Nome
          <input
            className="select-input"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Classificar cliente sem conexão"
            maxLength={120}
          />
        </label>
        <label className="field-label">
          Prioridade entre automações (menor roda primeiro)
          <input
            type="number"
            min={1}
            className="select-input"
            value={form.priority ?? 10}
            onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value) || 1 }))}
          />
        </label>
      </div>

      <label className="field-label">
        Descrição
        <textarea
          value={form.description ?? ''}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          rows={2}
          maxLength={400}
        />
      </label>

      <label className="macro-action-confirm-toggle">
        <input
          type="checkbox"
          checked={form.stopProcessing ?? false}
          onChange={(event) => setForm((current) => ({ ...current, stopProcessing: event.target.checked }))}
        />
        Após executar esta automação, não executar outras automações para o mesmo evento
      </label>

      <h3>QUANDO</h3>
      <AutomationTriggerEditor trigger={form.trigger} onChange={setTrigger} />

      <h3>SE</h3>
      <AutomationConditionEditor conditionGroups={form.conditionGroups} onChange={setConditionGroups} />

      <h3>ENTÃO</h3>
      <AutomationActionListEditor actions={form.actions} onChange={setActions} />

      <h3>Pré-visualização</h3>
      <AutomationFlowPreview trigger={form.trigger} conditionGroups={form.conditionGroups} actions={form.actions} />

      {(sendsMessages || closesTickets) && (
        <div className="automation-warning">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            {sendsMessages && <p>Esta automação pode enviar mensagens automaticamente para clientes.</p>}
            {closesTickets && <p>Esta automação pode encerrar atendimentos automaticamente.</p>}
            <p>Revise as condições antes de ativar.</p>
          </div>
        </div>
      )}

      {activationErrors.length > 0 && (
        <div className="form-error">
          <strong>Não é possível ativar:</strong>
          <ul>
            {activationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="secondary-action" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="secondary-action" disabled={!canSave || saving} onClick={saveDraft}>
          Salvar rascunho
        </button>
        <button type="button" className="primary-action compact" disabled={!canSave || saving} onClick={saveAndActivate}>
          {saving ? 'Salvando...' : 'Salvar e ativar'}
        </button>
      </div>
    </div>
  )
}
