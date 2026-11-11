import { Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { macrosApi } from '../../services/api/macrosApi'
import type { Macro, MacroInput } from '../../types/macro'
import { getReadableError } from '../../utils/errors'
import { countMacroActions, groupMacrosByCategory, searchMacros } from '../../utils/macroShortcuts'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { MacroEditor } from './MacroEditor'

interface MacroAdminDialogProps {
  open: boolean
  macros: Macro[]
  loading: boolean
  onClose(): void
  onReload(): void
}

type ViewState = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; macro: Macro }

export function MacroAdminDialog({ open, macros, loading, onClose, onReload }: MacroAdminDialogProps) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewState>({ mode: 'list' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Macro | null>(null)
  const [deleting, setDeleting] = useState(false)

  const groups = useMemo(
    () => groupMacrosByCategory(searchMacros(macros, query, { includeDisabled: true })),
    [macros, query],
  )

  if (!open) return null

  async function handleSave(input: MacroInput) {
    setSaving(true)
    setError('')

    try {
      if (view.mode === 'edit') {
        await macrosApi.update(view.macro.id, input)
      } else {
        await macrosApi.create(input)
      }
      setView({ mode: 'list' })
      onReload()
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível salvar a macro.'))
    } finally {
      setSaving(false)
    }
  }

  async function duplicateMacro(macro: Macro) {
    setError('')
    try {
      await macrosApi.create({
        name: `${macro.name} (cópia)`,
        description: macro.description,
        shortcut: `${macro.shortcut}-copia`,
        category: macro.category,
        enabled: false,
        actions: macro.actions,
      })
      onReload()
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível duplicar a macro.'))
    }
  }

  async function toggleEnabled(macro: Macro) {
    setError('')
    try {
      await macrosApi.update(macro.id, { enabled: !macro.enabled })
      onReload()
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível atualizar a macro.'))
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return

    setDeleting(true)
    try {
      await macrosApi.remove(pendingDelete.id)
      setPendingDelete(null)
      onReload()
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível excluir a macro.'))
    } finally {
      setDeleting(false)
    }
  }

  function close() {
    setView({ mode: 'list' })
    setQuery('')
    setError('')
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <section
        className="modal-panel wide-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="macro-admin-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-icon">
          <Zap size={22} aria-hidden="true" />
        </div>
        <h2 id="macro-admin-title">Macros</h2>
        <p className="modal-subtitle">
          Sequências de ações que os atendentes disparam digitando "/" no campo de mensagem.
        </p>

        {error && <p className="form-error">{error}</p>}

        {view.mode === 'list' && (
          <>
            <div className="quick-reply-form-row">
              <input
                className="select-input"
                placeholder="Buscar macro..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button" className="primary-action compact" onClick={() => setView({ mode: 'create' })}>
                Criar macro
              </button>
            </div>

            <div className="quick-reply-list">
              {loading && <p>Carregando...</p>}
              {!loading && groups.length === 0 && <p className="empty-state">Nenhuma macro encontrada.</p>}
              {!loading &&
                groups.map((group) => (
                  <div key={group.category}>
                    <span className="macro-search-group-label">{group.category}</span>
                    {group.macros.map((macro) => (
                      <div className={`quick-reply-row ${macro.enabled ? '' : 'inactive'}`} key={macro.id}>
                        <div className="quick-reply-row-info">
                          <strong>{macro.shortcut}</strong>
                          <span>{macro.name}</span>
                          <span className="tag-chip compact">{countMacroActions(macro.actions)} ações</span>
                          {!macro.enabled && <span className="tag-chip compact">Inativa</span>}
                        </div>
                        <div className="quick-reply-row-actions">
                          <button
                            type="button"
                            className="secondary-action compact"
                            onClick={() => setView({ mode: 'edit', macro })}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="secondary-action compact"
                            onClick={() => void duplicateMacro(macro)}
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            className="secondary-action compact"
                            onClick={() => void toggleEnabled(macro)}
                          >
                            {macro.enabled ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            className="secondary-action danger-secondary compact"
                            onClick={() => setPendingDelete(macro)}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-action" onClick={close}>
                Fechar
              </button>
            </div>
          </>
        )}

        {view.mode !== 'list' && (
          <MacroEditor
            macro={view.mode === 'edit' ? view.macro : null}
            saving={saving}
            onCancel={() => setView({ mode: 'list' })}
            onSave={handleSave}
          />
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir macro"
        message={`Tem certeza que deseja excluir "${pendingDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loadingLabel="Excluindo..."
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
