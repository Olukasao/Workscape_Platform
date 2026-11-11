import { Hash, RotateCcw, Search, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { StatusBadge } from '../components/shared/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import { conversationsApi } from '../services/api/conversationsApi'
import type { ConversationSummary, Message } from '../types/domain'
import { getCloseReasonLabel } from '../utils/closeReasons'
import { getConversationTagLabel } from '../utils/conversationTags'
import { formatDateTime } from '../utils/dates'
import { getReadableError } from '../utils/errors'
import { canReopenConversation } from '../utils/security'

type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'all'

function periodToDateFrom(preset: PeriodPreset): string | undefined {
  const now = new Date()
  if (preset === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  }
  if (preset === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    return start.toISOString()
  }
  if (preset === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString()
  if (preset === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString()
  return undefined
}

function periodToDateTo(preset: PeriodPreset): string | undefined {
  if (preset !== 'yesterday') return undefined
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

function durationLabel(startIso: string, endIso?: string | null): string {
  if (!endIso) return '—'
  const durationMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (!Number.isFinite(durationMs) || durationMs < 0) return '—'
  const minutes = Math.round(durationMs / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`
}

export function FinalizadosPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ConversationSummary | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [reopenTarget, setReopenTarget] = useState<ConversationSummary | null>(null)
  const [reopening, setReopening] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  const reopenAllowed = canReopenConversation(user?.role)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await conversationsApi.list({
        filter: 'closed',
        search: debouncedSearch || undefined,
        perPage: 50,
        dateFrom: periodToDateFrom(period),
        dateTo: periodToDateTo(period),
      })
      setItems(response.data)
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível carregar os atendimentos encerrados.'))
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, period])

  useEffect(() => {
    void load()
  }, [load])

  async function openConversation(conversation: ConversationSummary) {
    setSelected(conversation)
    setMessages([])
    setMessagesLoading(true)

    try {
      const page = await conversationsApi.getMessages(conversation.id, { perPage: 100 })
      setMessages(page.data)
    } catch (err) {
      setActionMessage(getReadableError(err, 'Não foi possível carregar a conversa.'))
    } finally {
      setMessagesLoading(false)
    }
  }

  async function confirmReopen() {
    if (!reopenTarget) return
    setReopening(true)

    try {
      await conversationsApi.reopen(reopenTarget.id)
      setActionMessage(`Atendimento de ${reopenTarget.customerName} reaberto.`)
      setReopenTarget(null)
      setSelected(null)
      void load()
    } catch (err) {
      setActionMessage(getReadableError(err, 'Não foi possível reabrir o atendimento.'))
    } finally {
      setReopening(false)
    }
  }

  const periodOptions: Array<{ id: PeriodPreset; label: string }> = useMemo(
    () => [
      { id: 'today', label: 'Hoje' },
      { id: 'yesterday', label: 'Ontem' },
      { id: '7d', label: '7 dias' },
      { id: '30d', label: '30 dias' },
      { id: 'all', label: 'Tudo' },
    ],
    [],
  )

  return (
    <PageShell active="finalizados" title="Finalizados" subtitle="Arquivo completo de atendimentos encerrados">
      {actionMessage && (
        <div className="toast" role="status">
          {actionMessage}
          <button type="button" onClick={() => setActionMessage('')} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}

      <div className="finalizados-filters">
        <div className="queue-controls">
          {periodOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={period === option.id ? 'tag-chip selected' : 'tag-chip'}
              onClick={() => setPeriod(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, chamado, contrato ou categoria..."
          />
        </div>
      </div>

      {loading && <p className="empty-state">Carregando atendimentos...</p>}

      {!loading && error && (
        <div className="empty-state">
          <p>{error}</p>
          <button type="button" className="secondary-action" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="empty-state">Nenhum atendimento encerrado encontrado neste período.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="finalizados-table" role="table">
          <div className="finalizados-row finalizados-head" role="row">
            <span>Cliente</span>
            <span>Chamado</span>
            <span>Atendente</span>
            <span>Categorias</span>
            <span>Duração</span>
            <span>Encerrado em</span>
            <span>Motivo</span>
          </div>
          {items.map((item) => (
            <button
              type="button"
              className="finalizados-row"
              role="row"
              key={item.id}
              onClick={() => void openConversation(item)}
            >
              <span>{item.customerName}</span>
              <span>{item.ticketNumber ? `#${item.ticketNumber}` : '—'}</span>
              <span>{item.assignedAgentName ?? 'Sem responsável'}</span>
              <span className="detail-tags">
                {(item.tags ?? []).map((tag) => (
                  <span className="tag-chip compact" key={tag}>
                    {getConversationTagLabel(tag)}
                  </span>
                ))}
              </span>
              <span>{durationLabel(item.createdAt, item.closedAt)}</span>
              <span>{item.closedAt ? formatDateTime(item.closedAt) : '—'}</span>
              <span>{getCloseReasonLabel(item.closeReason) ?? '—'}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <section
            className="modal-panel wide-panel finalizado-detail"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{selected.customerName}</h2>
            <div className="chat-meta-row">
              <span>
                <Hash size={13} aria-hidden="true" />
                {selected.ticketNumber ?? 'sem número'}
              </span>
              <span>
                <UserRound size={13} aria-hidden="true" />
                {selected.assignedAgentName ?? 'Sem responsável'}
              </span>
              <StatusBadge status={selected.status} />
            </div>

            <dl className="info-list">
              <div className="info-row">
                <dt>Início</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
              <div className="info-row">
                <dt>Encerramento</dt>
                <dd>{selected.closedAt ? formatDateTime(selected.closedAt) : '—'}</dd>
              </div>
              <div className="info-row">
                <dt>Motivo</dt>
                <dd>{getCloseReasonLabel(selected.closeReason) ?? 'Não informado'}</dd>
              </div>
              {selected.closeReasonNote && (
                <div className="info-row">
                  <dt>Observação</dt>
                  <dd>{selected.closeReasonNote}</dd>
                </div>
              )}
            </dl>

            <div className="finalizado-transcript">
              {messagesLoading && <p className="empty-state">Carregando conversa...</p>}
              {!messagesLoading &&
                messages.map((message) => (
                  <article className={`message-bubble ${message.authorType}`} key={message.id}>
                    <header>
                      <strong>{message.authorName}</strong>
                      <span>{formatDateTime(message.createdAt)}</span>
                    </header>
                    <p>{message.body}</p>
                  </article>
                ))}
              {!messagesLoading && messages.length === 0 && (
                <p className="empty-state">Nenhuma mensagem registrada.</p>
              )}
            </div>

            <div className="modal-actions">
              {reopenAllowed && (
                <button type="button" className="secondary-action" onClick={() => setReopenTarget(selected)}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Reabrir atendimento
                </button>
              )}
              <button type="button" className="secondary-action" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(reopenTarget)}
        title="Reabrir atendimento"
        message={`Deseja reabrir o atendimento de ${reopenTarget?.customerName ?? 'este cliente'}? Ele voltará para a fila ativa.`}
        confirmLabel="Reabrir"
        loadingLabel="Reabrindo..."
        loading={reopening}
        onCancel={() => setReopenTarget(null)}
        onConfirm={() => void confirmReopen()}
      />
    </PageShell>
  )
}
