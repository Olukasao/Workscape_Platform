import type { FormEvent } from 'react'
import {
  Archive,
  ArrowDownUp,
  FileSearch,
  MessageCircle,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import type {
  ConversationCounts,
  ConversationFilter,
  ConversationQueueSort,
  ConversationSummary,
  ConversationTagFilter,
  CustomerSearchResult,
} from '../../types/domain'
import { conversationTagOptions, getConversationTagLabel } from '../../utils/conversationTags'
import { conversationQueueSortOptions } from '../../utils/conversationQueue'
import { formatClock, formatRelativeTime } from '../../utils/dates'
import { getConversationPriority, getConversationPriorityLabel } from '../../utils/priority'
import { getSlaInfo } from '../../utils/sla'
import { StatusBadge } from '../shared/StatusBadge'
import { ConversationSkeleton } from '../shared/Skeleton'
import { ConversationFilters } from './ConversationFilters'

interface ConversationListProps {
  conversations: ConversationSummary[]
  counts: ConversationCounts | null
  listTotal: number | null
  filter: ConversationFilter
  selectedId?: string
  search: string
  tagFilter: ConversationTagFilter
  sort: ConversationQueueSort
  typingByConversation: Record<string, string>
  now: number
  loading: boolean
  error: string
  assigningId: string | null
  archiveActionId: string | null
  deletingId: string | null
  canDelete: boolean
  customerSearchCpf: string
  customerSearchResult: CustomerSearchResult | null
  customerSearchLoading: boolean
  customerSearchError: string
  customerChatStarting: boolean
  onCustomerSearchCpfChange(value: string): void
  onCustomerSearch(event: FormEvent<HTMLFormElement>): void
  onStartCustomerChat(): void
  onSearchChange(value: string): void
  onTagFilterChange(tag: ConversationTagFilter): void
  onSortChange(sort: ConversationQueueSort): void
  onFilterChange(filter: ConversationFilter): void
  onSelect(conversationId: string): void
  onAssign(conversationId: string): void
  onArchive(conversationId: string): void
  onRestore(conversationId: string): void
  onDelete(conversationId: string): void
  onRetry(): void
}

const filterLabels: Record<ConversationFilter, string> = {
  new: 'Novos',
  mine: 'Meus atendimentos',
  open: 'Em atendimento',
  waiting_customer: 'Aguardando cliente',
  closed: 'Encerrados',
  archived: 'Arquivados',
}

function pluralizeAttendance(count: number): string {
  return count === 1 ? 'atendimento' : 'atendimentos'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? 'C'
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]
  return `${first}${second ?? ''}`.toUpperCase()
}

export function ConversationList({
  conversations,
  counts,
  listTotal,
  filter,
  selectedId,
  search,
  tagFilter,
  sort,
  typingByConversation,
  now,
  loading,
  error,
  assigningId,
  archiveActionId,
  deletingId,
  canDelete,
  customerSearchCpf,
  customerSearchResult,
  customerSearchLoading,
  customerSearchError,
  customerChatStarting,
  onCustomerSearchCpfChange,
  onCustomerSearch,
  onStartCustomerChat,
  onSearchChange,
  onTagFilterChange,
  onSortChange,
  onFilterChange,
  onSelect,
  onAssign,
  onArchive,
  onRestore,
  onDelete,
  onRetry,
}: ConversationListProps) {
  const total = listTotal ?? conversations.length
  const categoryLabel = tagFilter === 'all' ? '' : ` • ${getConversationTagLabel(tagFilter)}`
  const activeContractId = customerSearchResult?.activeConversation?.customer.contractNumber
  const customerContract = customerSearchResult?.contracts.find(
    (contract) => contract.id === activeContractId,
  ) ?? customerSearchResult?.contracts[0]
  const customerAddress = customerContract
    ? [customerContract.addressLine, customerContract.city, customerContract.state]
        .filter(Boolean)
        .join(' • ')
    : ''

  return (
    <aside className="conversation-column" aria-label="Atendimentos">
      <div className="column-heading">
        <div className="column-title">
          <h2>Atendimentos</h2>
          <p>
            {total} {pluralizeAttendance(total)} em {filterLabels[filter].toLowerCase()}
            {categoryLabel}
          </p>
        </div>
      </div>

      <section className="customer-search-panel" aria-labelledby="customer-search-title">
        <div className="customer-search-title">
          <FileSearch size={17} aria-hidden="true" />
          <div>
            <h3 id="customer-search-title">Buscar cliente</h3>
            <p>Inicie um atendimento pelo CPF.</p>
          </div>
        </div>

        <form className="customer-search-form" onSubmit={onCustomerSearch}>
          <label className="sr-only" htmlFor="customer-cpf-search">
            CPF do cliente
          </label>
          <input
            id="customer-cpf-search"
            className="customer-search-field"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={customerSearchCpf}
            onChange={(event) => onCustomerSearchCpfChange(event.target.value)}
            placeholder="000.000.000-00"
            maxLength={14}
          />
          <button
            className="customer-search-button"
            type="submit"
            disabled={customerSearchLoading || customerChatStarting}
          >
            <Search size={16} aria-hidden="true" />
            Buscar
          </button>
        </form>

        {customerSearchLoading && (
          <p className="customer-search-feedback" role="status">Buscando cliente...</p>
        )}
        {!customerSearchLoading && customerSearchError && (
          <p className="customer-search-error" role="alert">{customerSearchError}</p>
        )}

        {!customerSearchLoading && customerSearchResult && (
          <article className="customer-search-result">
            <div className="customer-search-result-head">
              <strong>{customerSearchResult.customer.name}</strong>
              <span>CPF: {customerSearchResult.customer.maskedCpf}</span>
            </div>
            {customerContract && (
              <dl className="customer-search-details">
                <div><dt>Contrato</dt><dd>{customerContract.id}</dd></div>
                {customerContract.planName && <div><dt>Plano</dt><dd>{customerContract.planName}</dd></div>}
                {customerContract.status && <div><dt>Status</dt><dd>{customerContract.status}</dd></div>}
                {customerAddress && <div><dt>Endereço</dt><dd>{customerAddress}</dd></div>}
              </dl>
            )}
            {customerSearchResult.activeConversation && (
              <p className="customer-search-status">Este cliente já possui um atendimento ativo.</p>
            )}
            <button
              className="customer-start-action"
              type="button"
              onClick={onStartCustomerChat}
              disabled={customerChatStarting}
            >
              <MessageCircle size={17} aria-hidden="true" />
              {customerChatStarting
                ? 'Abrindo...'
                : customerSearchResult.activeConversation
                  ? 'ABRIR CHAT'
                  : 'INICIAR CHAT'}
            </button>
          </article>
        )}
      </section>

      <ConversationFilters activeFilter={filter} counts={counts} onChange={onFilterChange} />

      <div className="search-box">
        <Search size={17} aria-hidden="true" />
        <input
          aria-label="Buscar atendimentos"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar cliente, contrato ou chamado..."
        />
        {search && (
          <button
            className="search-clear"
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Limpar busca"
            title="Limpar busca"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="queue-controls">
        <label className="queue-sort">
          <ArrowDownUp size={16} aria-hidden="true" />
          <span className="sr-only">Ordenar fila</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ConversationQueueSort)}
            aria-label="Ordenar fila"
          >
            {conversationQueueSortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="category-filter" aria-label="Filtro por categoria">
          <button
            type="button"
            className={tagFilter === 'all' ? 'active' : ''}
            aria-pressed={tagFilter === 'all'}
            onClick={() => onTagFilterChange('all')}
          >
            Todas
          </button>
          {conversationTagOptions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={tagFilter === tag.id ? 'active' : ''}
              aria-pressed={tagFilter === tag.id}
              onClick={() => onTagFilterChange(tag.id)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      <div className="conversation-list" aria-live="polite">
        {loading && <ConversationSkeleton />}

        {!loading && error && (
          <div className="empty-state">
            <p>{error}</p>
            <button type="button" className="secondary-action" onClick={onRetry}>
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="empty-state">
            <p>{filter === 'new' ? 'Nenhum novo atendimento no momento.' : 'Nenhum atendimento encontrado.'}</p>
          </div>
        )}

        {!loading &&
          !error &&
          conversations.map((conversation) => {
            const typingName = typingByConversation[conversation.id]
            const archived = Boolean(conversation.archivedAt)
            const sla = getSlaInfo(conversation, now)
            const priority = getConversationPriority(conversation, now)
            const archiveBusy = archiveActionId === conversation.id
            const timeLabel = formatClock(conversation.lastMessageAt ?? conversation.updatedAt)
            const category = conversation.tags?.[0]

            return (
              <article
                className={`conversation-item ${
                  selectedId === conversation.id ? 'selected' : ''
                } ${conversation.unreadCount > 0 ? 'unread' : ''}`}
                key={conversation.id}
              >
                <button
                  type="button"
                  className="conversation-main"
                  onClick={() => onSelect(conversation.id)}
                >
                  <span className="conversation-topline">
                    <span className="conversation-avatar" aria-hidden="true">
                      {conversation.customerName ? getInitials(conversation.customerName) : <UserRound size={16} />}
                    </span>
                    <span className="conversation-title-block">
                      <strong>{conversation.customerName}</strong>
                      <small>
                        {conversation.assignedAgentName
                          ? conversation.assignedAgentName
                          : 'Sem responsável'}
                      </small>
                    </span>
                    <span className="conversation-time">
                      {timeLabel || formatRelativeTime(conversation.lastMessageAt ?? conversation.updatedAt)}
                    </span>
                    {conversation.unreadCount > 0 && (
                      <span className="unread-badge">{conversation.unreadCount}</span>
                    )}
                  </span>
                  <span className="conversation-subject">
                    {conversation.subject ?? `Chamado #${conversation.ticketNumber ?? 'sem número'}`}
                  </span>
                  {Boolean(conversation.tags?.length) && (
                    <span className="conversation-tags-compact">
                      {conversation.tags?.map((tag) => (
                        <span className="tag-chip compact" key={tag}>
                          {getConversationTagLabel(tag)}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className={`conversation-preview ${typingName ? 'typing' : ''}`}>
                    {archived
                      ? `Arquivada ${formatRelativeTime(conversation.archivedAt ?? conversation.updatedAt)}`
                      : typingName
                      ? `${typingName} está digitando...`
                      : conversation.lastMessage ?? 'Sem mensagens'}
                  </span>
                  <span className="conversation-meta">
                    <span className="conversation-meta-left">
                      {category && (
                        <span className="tag-chip compact">
                          {getConversationTagLabel(category)}
                        </span>
                      )}
                      {!archived && conversation.status !== 'closed' && (
                        <span className={`priority-badge ${priority}`}>
                          {getConversationPriorityLabel(priority)}
                        </span>
                      )}
                      {sla && <span className={`sla-badge ${sla.tone}`}>SLA {sla.label}</span>}
                      <StatusBadge status={conversation.status} />
                    </span>
                  </span>
                </button>
                <div className="conversation-item-actions">
                  {!archived &&
                    conversation.assignedAgentId === null &&
                    (conversation.status === 'new' || conversation.status === 'waiting_agent') && (
                      <button
                        className="assign-inline"
                        type="button"
                        disabled={
                          assigningId === conversation.id ||
                          archiveBusy ||
                          deletingId === conversation.id
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          onAssign(conversation.id)
                        }}
                      >
                        {assigningId === conversation.id ? 'Assumindo...' : 'Assumir'}
                      </button>
                    )}
                  <button
                    className={archived ? 'restore-inline' : 'conversation-archive'}
                    type="button"
                    disabled={archiveBusy || deletingId === conversation.id}
                    aria-label={
                      archived
                        ? `Restaurar conversa de ${conversation.customerName}`
                        : `Arquivar conversa de ${conversation.customerName}`
                    }
                    title={archived ? 'Restaurar conversa' : 'Arquivar conversa'}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (archived) {
                        onRestore(conversation.id)
                      } else {
                        onArchive(conversation.id)
                      }
                    }}
                  >
                    {archived ? (
                      <>
                        <RotateCcw size={15} aria-hidden="true" />
                        {archiveBusy ? 'Restaurando...' : 'Restaurar'}
                      </>
                    ) : (
                      <Archive size={16} aria-hidden="true" />
                    )}
                  </button>
                  {canDelete && archived && (
                    <button
                      className="conversation-delete"
                      type="button"
                      disabled={deletingId === conversation.id || archiveBusy}
                      aria-label={`Excluir definitivamente conversa de ${conversation.customerName}`}
                      title="Excluir definitivamente"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(conversation.id)
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
      </div>
    </aside>
  )
}
