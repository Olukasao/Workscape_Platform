import { Plus, Workflow } from 'lucide-react'
import { useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { AutomationEditor } from '../components/automations/AutomationEditor'
import { AutomationExecutionHistory } from '../components/automations/AutomationExecutionHistory'
import { AutomationList } from '../components/automations/AutomationList'
import { AutomationTestDialog } from '../components/automations/AutomationTestDialog'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { useAutomations } from '../hooks/useAutomations'
import { automationsApi } from '../services/api/automationsApi'
import type { Automation, AutomationInput } from '../types/automation'
import { getReadableError } from '../utils/errors'
import { canManageAutomations } from '../utils/security'

type EditorView = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; automation: Automation }

export function AutomationsPage() {
  const { user } = useAuth()
  const { automations, loading, error, reload } = useAutomations()
  const canManage = canManageAutomations(user?.role)

  const [editorView, setEditorView] = useState<EditorView>({ mode: 'closed' })
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [testingAutomation, setTestingAutomation] = useState<Automation | null>(null)
  const [historyAutomation, setHistoryAutomation] = useState<Automation | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSave(input: AutomationInput) {
    setSaving(true)
    setActionError('')

    try {
      if (editorView.mode === 'edit') {
        await automationsApi.update(editorView.automation.id, input)
      } else {
        await automationsApi.create(input)
      }
      setEditorView({ mode: 'closed' })
      await reload()
    } catch (err) {
      setActionError(getReadableError(err, 'Não foi possível salvar a automação.'))
    } finally {
      setSaving(false)
    }
  }

  async function duplicateAutomation(automation: Automation) {
    setActionError('')
    try {
      await automationsApi.create({
        name: `${automation.name} - cópia`,
        description: automation.description,
        status: 'DRAFT',
        priority: automation.priority,
        stopProcessing: automation.stopProcessing,
        trigger: automation.trigger,
        conditionGroups: automation.conditionGroups,
        actions: automation.actions,
      })
      await reload()
    } catch (err) {
      setActionError(getReadableError(err, 'Não foi possível duplicar a automação.'))
    }
  }

  async function toggleStatus(automation: Automation) {
    setActionError('')
    try {
      if (automation.status === 'ACTIVE') {
        await automationsApi.disable(automation.id)
      } else {
        await automationsApi.enable(automation.id)
      }
      await reload()
    } catch (err) {
      setActionError(getReadableError(err, 'Não foi possível atualizar o status da automação.'))
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return

    setDeleting(true)
    try {
      await automationsApi.remove(pendingDelete.id)
      setPendingDelete(null)
      await reload()
    } catch (err) {
      setActionError(getReadableError(err, 'Não foi possível excluir a automação.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageShell
      active="automacoes"
      title="Automações"
      subtitle="Regras QUANDO / SE / ENTÃO que o sistema dispara automaticamente a partir de eventos do atendimento."
      headerExtra={
        canManage ? (
          <button type="button" className="primary-action compact" onClick={() => setEditorView({ mode: 'create' })}>
            <Plus size={16} aria-hidden="true" />
            Nova automação
          </button>
        ) : undefined
      }
    >
      {error && <p className="form-error">{error}</p>}
      {actionError && <p className="form-error">{actionError}</p>}

      <AutomationList
        automations={automations}
        loading={loading}
        canManage={canManage}
        onEdit={(automation) => setEditorView({ mode: 'edit', automation })}
        onDuplicate={(automation) => void duplicateAutomation(automation)}
        onToggleStatus={(automation) => void toggleStatus(automation)}
        onDelete={(automation) => setPendingDelete(automation)}
        onTest={(automation) => setTestingAutomation(automation)}
        onViewHistory={(automation) => setHistoryAutomation(automation)}
      />

      {editorView.mode !== 'closed' && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel wide-panel" role="dialog" aria-modal="true" aria-labelledby="automation-editor-title">
            <div className="modal-icon">
              <Workflow size={22} aria-hidden="true" />
            </div>
            <h2 id="automation-editor-title">
              {editorView.mode === 'edit' ? 'Editar automação' : 'Nova automação'}
            </h2>
            <AutomationEditor
              automation={editorView.mode === 'edit' ? editorView.automation : null}
              saving={saving}
              onCancel={() => setEditorView({ mode: 'closed' })}
              onSave={handleSave}
            />
          </section>
        </div>
      )}

      {testingAutomation && (
        <AutomationTestDialog automation={testingAutomation} onClose={() => setTestingAutomation(null)} />
      )}

      {historyAutomation && (
        <AutomationExecutionHistory automation={historyAutomation} onClose={() => setHistoryAutomation(null)} />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir automação"
        message={`Tem certeza que deseja excluir "${pendingDelete?.name}"? O histórico de execuções já registrado é preservado.`}
        confirmLabel="Excluir"
        loadingLabel="Excluindo..."
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </PageShell>
  )
}
