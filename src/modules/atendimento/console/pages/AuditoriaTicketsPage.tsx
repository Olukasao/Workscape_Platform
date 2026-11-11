import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  IdCard,
  Inbox,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Tag,
  UserRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell'
import { SearchableSelect } from '../components/shared/SearchableSelect'
import { StatusBadge } from '../components/shared/StatusBadge'
import { agentsApi } from '../services/api/agentsApi'
import { auditApi } from '../services/api/auditApi'
import { conversationsApi } from '../services/api/conversationsApi'
import type {
  AgentOption,
  AuditLogEntry,
  ConversationFilter,
  ConversationQueueSort,
  ConversationSummary,
  ConversationTagFilter,
} from '../types/domain'
import { conversationTagOptions, getConversationTagLabel } from '../utils/conversationTags'
import { formatClock } from '../utils/dates'
import { getReadableError } from '../utils/errors'
import { maskDocument } from '../utils/security'

const ACTION_LABELS: Record<string, string> = {
  login: 'Login realizado',
  login_internal_chat: 'Login via chat interno',
  login_internal_chat_sso: 'Login via SSO do chat interno',
  logout: 'Logout',
  agent_created: 'Atendente criado',
  agent_disabled: 'Atendente desativado',
  attendance_status_changed: 'Alterou status de atendimento',
  start_customer_conversation: 'Ticket criado',
  assign: 'Assumiu o atendimento',
  transfer: 'Transferiu o atendimento',
  close: 'Ticket encerrado',
  reopen: 'Ticket reaberto',
  archive: 'Arquivou a conversa',
  restore: 'Restaurou a conversa',
  update_tags: 'Alterou tags',
  delete: 'Excluiu a conversa',
  note_added: 'Adicionou nota interna',
}

const STATUS_OPTIONS: Array<{ id: ConversationFilter; label: string }> = [
  { id: 'new', label: 'Novo' },
  { id: 'open', label: 'Em atendimento' },
  { id: 'waiting_customer', label: 'Aguardando cliente' },
  { id: 'closed', label: 'Finalizado' },
  { id: 'archived', label: 'Arquivado' },
]

const PER_PAGE_OPTIONS = [20, 50, 100]

interface FiltersState {
  dateFrom: string
  dateTo: string
  ticketNumber: string
  document: string
  phone: string
  originContact: string
  status: ConversationFilter
  tag: ConversationTagFilter
  agentId: string
}

const defaultFilters: FiltersState = {
  dateFrom: '',
  dateTo: '',
  ticketNumber: '',
  document: '',
  phone: '',
  originContact: '',
  status: 'closed',
  tag: 'all',
  agentId: '',
}

function isTechnicalName(name: string): boolean {
  return /^cliente(\s|$)/i.test(name) || name.startsWith('customer_')
}

function isAutomatedAgent(name: string): boolean {
  return /\bbot\b|\bia\b|\bassistente\b/i.test(name)
}

function toIsoStart(dateInput: string): string {
  return new Date(`${dateInput}T00:00:00`).toISOString()
}

function toIsoEnd(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59.999`).toISOString()
}

function formatDateShort(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date)
}

function describeAuditMetadata(entry: AuditLogEntry): string | null {
  if (!entry.metadata) return null

  if (entry.action === 'update_tags' && Array.isArray(entry.metadata.tags)) {
    return (entry.metadata.tags as string[]).join(', ')
  }
  if (entry.action === 'transfer' && entry.metadata.toAgentName) {
    return `Para ${entry.metadata.toAgentName as string}`
  }

  return null
}

function DateTimeCell({ value }: { value?: string }) {
  return (
    <span className="audit-cell-datetime">
      <strong>{formatDateShort(value)}</strong>
      <small>{formatClock(value)}</small>
    </span>
  )
}

export function AuditoriaTicketsPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState<FiltersState>(defaultFilters)
  const [applied, setApplied] = useState<FiltersState>(defaultFilters)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [sort, setSort] = useState<ConversationQueueSort>('newest')

  const [agents, setAgents] = useState<AgentOption[]>([])
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const [selectedTicket, setSelectedTicket] = useState<ConversationSummary | null>(null)
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')

  useEffect(() => {
    agentsApi
      .list()
      .then(setAgents)
      .catch(() => setAgents([]))
  }, [])

  useEffect(() => {
    if (!selectedTicket) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedTicket(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedTicket])

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (options.silent) setSearching(true)
      else setLoading(true)
      setError('')

      try {
        const response = await conversationsApi.list({
          filter: applied.status,
          tag: applied.tag,
          sort,
          page,
          perPage,
          dateFrom: applied.dateFrom ? toIsoStart(applied.dateFrom) : undefined,
          dateTo: applied.dateTo ? toIsoEnd(applied.dateTo) : undefined,
          ticketNumber: applied.ticketNumber || undefined,
          document: applied.document || undefined,
          phone: applied.phone || undefined,
          assignedAgentId: applied.agentId || undefined,
          search: applied.originContact || undefined,
        })
        setItems(response.data)
        setTotal(response.pagination.total)
        setHasMore(response.pagination.hasMore)
      } catch (err) {
        setError(getReadableError(err, 'Não foi possível carregar os tickets. Tente novamente.'))
      } finally {
        setLoading(false)
        setSearching(false)
      }
    },
    [applied, page, perPage, sort],
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  function handleFieldChange<K extends keyof FiltersState>(key: K, value: FiltersState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSearch() {
    setApplied(form)
    setPage(1)
  }

  function handleClear() {
    setForm(defaultFilters)
    setApplied(defaultFilters)
    setPage(1)
  }

  function toggleSort() {
    setSort((current) => (current === 'oldest' ? 'newest' : 'oldest'))
    setPage(1)
  }

  const agentOptions = useMemo(
    () => agents.map((agent) => ({ id: agent.id, label: agent.name })),
    [agents],
  )
  const tagOptions = useMemo(
    () => conversationTagOptions.map((tag) => ({ id: tag.id, label: tag.label })),
    [],
  )

  async function openAuditDrawer(ticket: ConversationSummary) {
    setSelectedTicket(ticket)
    setAuditEntries([])
    setAuditError('')
    setAuditLoading(true)

    try {
      const response = await auditApi.list({ targetType: 'conversation', targetId: ticket.id, perPage: 50 })
      setAuditEntries(response.data)
    } catch (err) {
      setAuditError(getReadableError(err, 'Não foi possível carregar o histórico de auditoria.'))
    } finally {
      setAuditLoading(false)
    }
  }

  const rangeStart = total ? (page - 1) * perPage + 1 : items.length > 0 ? (page - 1) * perPage + 1 : 0
  const rangeEnd = total ? Math.min(page * perPage, total) : (page - 1) * perPage + items.length

  return (
    <PageShell
      active="auditoria-ticket"
      title="Auditoria de Tickets"
      subtitle="Localize, filtre e analise conversas e tickets de atendimento."
    >
      <section className="audit-filters-card">
        <div className="audit-filters-head">
          <h2>
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filtros de Auditoria
          </h2>
          <button type="button" className="audit-clear-filters" onClick={handleClear}>
            <RefreshCcw size={14} aria-hidden="true" />
            Limpar filtros
          </button>
        </div>

        <div className="audit-filters-grid">
          <label className="audit-field">
            <span>Operação</span>
            <select className="select-input" value="acessanet" disabled>
              <option value="acessanet">Acessanet</option>
            </select>
          </label>

          <label className="audit-field">
            <span>Período</span>
            <div className="audit-date-range">
              <Calendar size={15} aria-hidden="true" />
              <input
                type="date"
                value={form.dateFrom}
                onChange={(event) => handleFieldChange('dateFrom', event.target.value)}
              />
              <span>–</span>
              <input
                type="date"
                value={form.dateTo}
                onChange={(event) => handleFieldChange('dateTo', event.target.value)}
              />
            </div>
          </label>

          <label className="audit-field">
            <span>ID do Ticket</span>
            <input
              className="text-input"
              value={form.ticketNumber}
              onChange={(event) => handleFieldChange('ticketNumber', event.target.value)}
              placeholder="Ex.: 28466768"
            />
          </label>

          <label className="audit-field">
            <span>CPF/CNPJ</span>
            <input
              className="text-input"
              value={form.document}
              onChange={(event) => handleFieldChange('document', event.target.value)}
              placeholder="Somente números"
            />
          </label>

          <label className="audit-field">
            <span>Telefone</span>
            <div className="audit-phone-field">
              <span className="audit-ddi">+55</span>
              <input
                className="text-input"
                value={form.phone}
                onChange={(event) => handleFieldChange('phone', event.target.value)}
                placeholder="DDD + número"
              />
            </div>
          </label>

          <label className="audit-field">
            <span>Contato de origem</span>
            <input
              className="text-input"
              value={form.originContact}
              onChange={(event) => handleFieldChange('originContact', event.target.value)}
              placeholder="Cliente, contrato ou categoria"
            />
          </label>

          <label className="audit-field">
            <span>Status</span>
            <select
              className="select-input"
              value={form.status}
              onChange={(event) => handleFieldChange('status', event.target.value as ConversationFilter)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="audit-field">
            <span>Tag</span>
            <SearchableSelect
              options={tagOptions}
              value={form.tag === 'all' ? '' : form.tag}
              onChange={(value) => handleFieldChange('tag', (value || 'all') as ConversationTagFilter)}
              placeholder="Todas as tags"
              emptyOptionLabel="Todas as tags"
            />
          </label>

          <label className="audit-field">
            <span>Atendente</span>
            <SearchableSelect
              options={agentOptions}
              value={form.agentId}
              onChange={(value) => handleFieldChange('agentId', value)}
              placeholder="Todos os atendentes"
              emptyOptionLabel="Todos os atendentes"
            />
          </label>

          <label className="audit-field">
            <span>Canal</span>
            <select className="select-input" value="whatsapp" disabled>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>

          <div className="audit-field audit-field-submit">
            <button type="button" className="primary-action audit-search-button" onClick={handleSearch}>
              {searching ? (
                <Loader2 size={16} className="spin-icon" aria-hidden="true" />
              ) : (
                <Search size={16} aria-hidden="true" />
              )}
              Buscar
            </button>
          </div>
        </div>
      </section>

      <section className="audit-table-card">
        <div className="audit-table-head">
          <h2>Lista de tickets</h2>
        </div>

        {loading && (
          <div className="skeleton-list" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="skeleton-row audit-skeleton-row" key={index}>
                <span className="skeleton-line w-45" />
                <span className="skeleton-line w-70" />
                <span className="skeleton-line w-45" />
                <span className="skeleton-line w-90" />
                <span className="skeleton-line w-70" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="empty-state">
            <AlertTriangle size={28} aria-hidden="true" />
            <p>{error}</p>
            <button type="button" className="secondary-action" onClick={() => void load()}>
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="empty-state">
            <Inbox size={28} aria-hidden="true" />
            <p>Nenhum ticket encontrado com os filtros aplicados.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="audit-table-scroll">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>
                    <button type="button" className="audit-sort-header" onClick={toggleSort}>
                      Atualizado em
                      {sort === 'oldest' ? (
                        <ArrowUp size={13} aria-hidden="true" />
                      ) : (
                        <ArrowDown size={13} aria-hidden="true" />
                      )}
                    </button>
                  </th>
                  <th>Ticket</th>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>CPF/CNPJ</th>
                  <th>Agente</th>
                  <th>Tag atual</th>
                  <th>Status</th>
                  <th>Canal</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const phone = item.ticketMetadata?.customer?.phone
                  const agentName = item.assignedAgentName
                  const primaryTag = item.tags?.[0]
                  const extraTags = (item.tags?.length ?? 0) - 1
                  const clientName = isTechnicalName(item.customerName) ? 'Sem identificação' : item.customerName

                  return (
                    <tr key={item.id}>
                      <td>
                        <DateTimeCell value={item.createdAt} />
                      </td>
                      <td>
                        <DateTimeCell value={item.updatedAt} />
                      </td>
                      <td>
                        <span className="audit-cell-ticket">
                          <MessageCircle size={14} aria-hidden="true" />
                          <strong>{item.ticketNumber ?? '—'}</strong>
                        </span>
                        <small>Acessanet</small>
                      </td>
                      <td className="audit-cell-truncate" title={clientName}>
                        {clientName}
                      </td>
                      <td className="audit-cell-truncate" title={phone ?? '—'}>
                        {phone ?? '—'}
                      </td>
                      <td>{maskDocument(item.customer?.document)}</td>
                      <td>
                        <span className="audit-cell-agent">
                          {agentName && isAutomatedAgent(agentName) ? (
                            <Bot size={14} aria-hidden="true" />
                          ) : (
                            <UserRound size={14} aria-hidden="true" />
                          )}
                          {agentName ?? 'Não atribuído'}
                        </span>
                      </td>
                      <td>
                        {primaryTag ? (
                          <span className="audit-cell-tag">
                            <Tag size={12} aria-hidden="true" />
                            {getConversationTagLabel(primaryTag)}
                            {extraTags > 0 && <small> +{extraTags}</small>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <span className="audit-cell-channel">
                          <MessageCircle size={14} aria-hidden="true" />
                          WhatsApp
                        </span>
                      </td>
                      <td>
                        <div className="audit-actions">
                          <button
                            type="button"
                            className="icon-action"
                            data-tooltip="Visualizar auditoria"
                            onClick={() => void openAuditDrawer(item)}
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-action"
                            data-tooltip="Abrir atendimento"
                            onClick={() => navigate(`/atendimento/${item.id}`)}
                          >
                            <MessageCircle size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="audit-pagination">
            <span className="audit-pagination-summary">
              {total !== undefined
                ? `${rangeStart}–${rangeEnd} de ${total.toLocaleString('pt-BR')} tickets`
                : `Mostrando ${items.length} tickets nesta página`}
            </span>

            <div className="audit-pagination-controls">
              <button
                type="button"
                className="secondary-action compact"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={15} aria-hidden="true" />
                Anterior
              </button>
              <span className="audit-pagination-page">Página {page}</span>
              <button
                type="button"
                className="secondary-action compact"
                disabled={!hasMore}
                onClick={() => setPage((current) => current + 1)}
              >
                Próximo
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>

            <label className="audit-per-page">
              <span>por página</span>
              <select
                className="select-input"
                value={perPage}
                onChange={(event) => {
                  setPerPage(Number(event.target.value))
                  setPage(1)
                }}
              >
                {PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>

      {selectedTicket && (
        <div className="drawer-backdrop" role="presentation" onClick={() => setSelectedTicket(null)}>
          <aside
            className="audit-drawer"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="audit-drawer-header">
              <div>
                <h2>Ticket #{selectedTicket.ticketNumber ?? selectedTicket.id}</h2>
                <StatusBadge status={selectedTicket.status} />
              </div>
              <button type="button" className="icon-action" onClick={() => setSelectedTicket(null)} aria-label="Fechar">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <dl className="info-list">
              <div className="info-row">
                <dt>Cliente</dt>
                <dd>
                  {isTechnicalName(selectedTicket.customerName) ? 'Sem identificação' : selectedTicket.customerName}
                </dd>
              </div>
              <div className="info-row">
                <dt>
                  <Phone size={13} aria-hidden="true" /> Telefone
                </dt>
                <dd>{selectedTicket.ticketMetadata?.customer?.phone ?? '—'}</dd>
              </div>
              <div className="info-row">
                <dt>
                  <IdCard size={13} aria-hidden="true" /> CPF/CNPJ
                </dt>
                <dd>{maskDocument(selectedTicket.customer?.document)}</dd>
              </div>
              <div className="info-row">
                <dt>Canal</dt>
                <dd>WhatsApp</dd>
              </div>
              <div className="info-row">
                <dt>Agente</dt>
                <dd>{selectedTicket.assignedAgentName ?? 'Não atribuído'}</dd>
              </div>
              <div className="info-row">
                <dt>Tags</dt>
                <dd className="detail-tags">
                  {(selectedTicket.tags ?? []).length > 0
                    ? selectedTicket.tags?.map((tag) => (
                        <span className="tag-chip compact" key={tag}>
                          {getConversationTagLabel(tag)}
                        </span>
                      ))
                    : '—'}
                </dd>
              </div>
              <div className="info-row">
                <dt>Criado em</dt>
                <dd>
                  {formatDateShort(selectedTicket.createdAt)} · {formatClock(selectedTicket.createdAt)}
                </dd>
              </div>
              <div className="info-row">
                <dt>Atualizado em</dt>
                <dd>
                  {formatDateShort(selectedTicket.updatedAt)} · {formatClock(selectedTicket.updatedAt)}
                </dd>
              </div>
            </dl>

            <h3 className="audit-drawer-subtitle">
              <ClipboardList size={15} aria-hidden="true" />
              Histórico da auditoria
            </h3>

            {auditLoading && <p className="empty-state">Carregando histórico...</p>}

            {!auditLoading && auditError && <p className="empty-state">{auditError}</p>}

            {!auditLoading && !auditError && auditEntries.length === 0 && (
              <p className="empty-state">Nenhum evento de auditoria registrado para este ticket.</p>
            )}

            {!auditLoading && !auditError && auditEntries.length > 0 && (
              <ol className="audit-drawer-timeline">
                {auditEntries.map((entry) => (
                  <li key={entry.id}>
                    <span className="audit-drawer-timeline-time">{formatClock(entry.createdAt)}</span>
                    <div className="audit-drawer-timeline-dot" aria-hidden="true" />
                    <div className="audit-drawer-timeline-body">
                      <strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong>
                      <span>{entry.agentName ?? 'Sistema'}</span>
                      {describeAuditMetadata(entry) && <small>{describeAuditMetadata(entry)}</small>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}
    </PageShell>
  )
}
