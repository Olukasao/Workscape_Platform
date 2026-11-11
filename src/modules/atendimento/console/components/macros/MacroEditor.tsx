import { useState } from 'react'
import type { Macro, MacroAction, MacroInput } from '../../types/macro'
import { MacroActionListEditor } from './MacroActionEditor'

interface MacroEditorProps {
  macro: Macro | null
  saving: boolean
  onCancel(): void
  onSave(input: MacroInput): void
}

function toInput(macro: Macro | null): MacroInput {
  return {
    name: macro?.name ?? '',
    description: macro?.description ?? '',
    shortcut: macro?.shortcut ?? '',
    category: macro?.category ?? '',
    enabled: macro?.enabled ?? true,
    actions: macro?.actions ?? [],
  }
}

export function MacroEditor({ macro, saving, onCancel, onSave }: MacroEditorProps) {
  const [form, setForm] = useState<MacroInput>(() => toInput(macro))

  function setActions(actions: MacroAction[]) {
    setForm((current) => ({ ...current, actions }))
  }

  const canSave = form.name.trim() && form.shortcut.trim() && form.actions.length > 0

  return (
    <div className="macro-editor">
      <div className="quick-reply-form-row">
        <label className="field-label">
          Nome
          <input
            className="select-input"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Cliente sem conexão"
            maxLength={120}
          />
        </label>
        <label className="field-label">
          Atalho
          <input
            className="select-input"
            value={form.shortcut}
            onChange={(event) => setForm((current) => ({ ...current, shortcut: event.target.value }))}
            placeholder="/semnet"
            maxLength={40}
          />
        </label>
      </div>

      <div className="quick-reply-form-row">
        <label className="field-label">
          Categoria
          <input
            className="select-input"
            value={form.category ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            placeholder="Suporte"
            maxLength={60}
          />
        </label>
        <label className="macro-action-confirm-toggle">
          <input
            type="checkbox"
            checked={form.enabled ?? true}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          />
          Macro ativa
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

      <h3>Ações</h3>
      <MacroActionListEditor actions={form.actions} onChange={setActions} />

      <div className="modal-actions">
        <button type="button" className="secondary-action" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button
          type="button"
          className="primary-action compact"
          disabled={!canSave || saving}
          onClick={() => onSave(form)}
        >
          {saving ? 'Salvando...' : 'Salvar macro'}
        </button>
      </div>
    </div>
  )
}
