import {
  Archive,
  AlertTriangle,
  Bell,
  Clock3,
  Forward,
  Hash,
  MessageCircle,
  NotebookPen,
  RotateCcw,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type {
  ConversationDetail,
  ConversationNote,
  ConversationStatus,
  ConversationTag,
  Message,
  QuickReply,
} from '../../types/domain'
import type { Macro } from '../../types/macro'
import { formatClock, formatRelativeTime } from '../../utils/dates'
import { getConversationPriority, getConversationPriorityLabel } from '../../utils/priority'
import { getSlaInfo } from '../../utils/sla'
import { getStatusLabel } from '../../utils/status'
import { StatusBadge } from '../shared/StatusBadge'
import { MessageSkeleton } from '../shared/Skeleton'
import { ConversationTags } from './ConversationTags'
import { MessageComposer } from './MessageComposer'

interface ChatPanelProps {
  conversation: ConversationDetail | null
  messages: Message[]
  notes: ConversationNote[]
  quickReplies: QuickReply[]
  macros?: Macro[]
  recentMacros?: Macro[]
  favoriteMacroIds?: string[]
  onTriggerMacro?(macro: Macro): void
  loading: boolean
  error: string
  hasMore: boolean
  typingLabel: string
  now: number
  sendingDisabled: boolean
  canTransfer: boolean
  canClose: boolean
  canArchive: boolean
  canDelete: boolean
  statusUpdating: boolean
  archiveUpdating: boolean
  tagsUpdating: boolean
  noteSubmitting: boolean
  currentAgentName: string
  onLoadOlder(): void
  onSend(body: string): void
  onRetry(message: Message): void
  onAddNote(note: string): void
  onTypingStart(): void
  onTypingStop(): void
  onStatusChange(status: ConversationStatus): void
  onArchive(): void
  onRestore(): void
  onTagsChange(tags: ConversationTag[]): void
  onOpenTransfer(): void
  onOpenClose(): void
  onOpenDelete(): void
  onRetryLoad(): void
}

type TimelineEntry =
  | { kind: 'message'; sortKey: number; message: Message }
  | { kind: 'note'; sortKey: number; note: ConversationNote }

function buildTimeline(messages: Message[], notes: ConversationNote[]): TimelineEntry[] {
  const messageEntries: TimelineEntry[] = messages.map((message) => ({
    kind: 'message',
    sortKey: new Date(message.createdAt).getTime(),
    message,
  }))
  const noteEntries: TimelineEntry[] = notes.map((note) => ({
    kind: 'note',
    sortKey: new Date(note.createdAt).getTime(),
    note,
  }))

  return [...messageEntries, ...noteEntries].sort((left, right) => left.sortKey - right.sortKey)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? 'C'
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]
  return `${first}${second ?? ''}`.toUpperCase()
}

export function ChatPanel({
  conversation,
  messages,
  notes,
  quickReplies,
  macros,
  recentMacros,
  favoriteMacroIds,
  onTriggerMacro,
  loading,
  error,
  hasMore,
  typingLabel,
  now,
  sendingDisabled,
  canTransfer,
  canClose,
  canArchive,
  canDelete,
  statusUpdating,
  archiveUpdating,
  tagsUpdating,
  noteSubmitting,
  currentAgentName,
  onLoadOlder,
  onSend,
  onRetry,
  onAddNote,
  onTypingStart,
  onTypingStop,
  onStatusChange,
  onArchive,
  onRestore,
  onTagsChange,
  onOpenTransfer,
  onOpenClose,
  onOpenDelete,
  onRetryLoad,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const previousMessageCountRef = useRef(0)
  const [noteFormOpen, setNoteFormOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const conversationKey = conversation?.id
  const timeline = buildTimeline(messages, notes)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120
    const previousCount = previousMessageCountRef.current
    const nextCount = timeline.length
    const firstLoad = previousCount === 0 && nextCount > 0
    const grew = nextCount > previousCount
    previousMessageCountRef.current = nextCount

    if (!grew) return

    if (nearBottom || firstLoad) {
      window.requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight
      })
      setNewMessageCount(0)
      return
    }

    setNewMessageCount((count) => count + 1)
  }, [timeline.length])

  useEffect(() => {
    previousMessageCountRef.current = 0
    setNewMessageCount(0)
    setNoteFormOpen(false)
    setNoteDraft('')
    window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }, [conversationKey])

  if (!conversation) {
    return (
      <section className="chat-column empty-chat" aria-label="Conversa">
        <div className="empty-state large">
          <span className="empty-state-icon" aria-hidden="true">
            <MessageCircle size={26} />
          </span>
          <h2>Bem-vindo ao Atendimento</h2>
          <p>
            Selecione um atendimento na lista ao lado para visualizar mensagens, dados do cliente e
            histórico operacional.
          </p>

          <div className="welcome-cards">
            <div className="welcome-card">
              <span className="welcome-card-icon chat" aria-hidden="true">
                <MessageCircle size={18} />
              </span>
              <div>
                <strong>Chat em tempo real</strong>
                <span>Converse com o cliente com atualização instantânea via WebSocket.</span>
              </div>
            </div>
            <div className="welcome-card">
              <span className="welcome-card-icon sla" aria-hidden="true">
                <Clock3 size={18} />
              </span>
              <div>
                <strong>Fila priorizada por SLA</strong>
                <span>Atendimentos ordenados por tempo de espera e prioridade.</span>
              </div>
            </div>
            <div className="welcome-card">
              <span className="welcome-card-icon transfer" aria-hidden="true">
                <Users size={18} />
              </span>
              <div>
                <strong>Transferência entre atendentes</strong>
                <span>Encaminhe conversas para outro atendente sem perder o histórico.</span>
              </div>
            </div>
            <div className="welcome-card">
              <span className="welcome-card-icon alert" aria-hidden="true">
                <Bell size={18} />
              </span>
              <div>
                <strong>Notificações instantâneas</strong>
                <span>Receba alertas sonoros e de sistema para novas mensagens.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const archived = Boolean(conversation.archivedAt)
  const actionsDisabled = statusUpdating || archiveUpdating || archived
  const sla = getSlaInfo(conversation, now)
  const priority = getConversationPriority(conversation, now)

  return (
    <section className="chat-column" aria-label="Conversa">
      <header className="chat-header">
        <div className="chat-customer">
          <span className="chat-avatar" aria-hidden="true">
            {conversation.customerName ? getInitials(conversation.customerName) : <UserRound size={18} />}
          </span>
          <div className="chat-title-block">
            <div className="chat-title-line">
              <h2>{conversation.customerName}</h2>
              <StatusBadge status={conversation.status} />
            </div>
            <p>
              {conversation.subject ?? conversation.customer.reason ?? 'Atendimento'}
            </p>
            <div className="chat-meta-row">
              <span>
                <Hash size={13} aria-hidden="true" />
                {conversation.ticketNumber ?? conversation.customer.ticketNumber ?? 'sem número'}
              </span>
              <span>
                <UserRound size={13} aria-hidden="true" />
                {conversation.assignedAgentName ?? 'Sem responsável'}
              </span>
              {!archived && conversation.status !== 'closed' && (
                <span className={`chat-priority ${priority}`}>
                  Prioridade {getConversationPriorityLabel(priority)}
                </span>
              )}
              {sla && (
                <span className={`chat-sla ${sla.tone}`}>
                  Cliente aguardando há {sla.label}
                </span>
              )}
              {conversation.archivedAt && (
                <span className="chat-sla archived">
                  Arquivada {formatRelativeTime(conversation.archivedAt)}
                </span>
              )}
              {Boolean(conversation.customerHistory?.recentCount) && (
                <span className="chat-reincidente" title="Cliente com atendimentos recentes">
                  <AlertTriangle size={13} aria-hidden="true" />
                  Reincidente: {conversation.customerHistory?.recentCount} nos últimos 30 dias
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConversationTags
        selectedTags={conversation.tags ?? []}
        disabled={archived}
        updating={tagsUpdating}
        onChange={onTagsChange}
      />

      <div className="chat-actions">
        <button
          type="button"
          className="secondary-action"
          onClick={() => onStatusChange('waiting_customer')}
          disabled={actionsDisabled || conversation.status === 'closed'}
        >
          <Clock3 size={16} aria-hidden="true" />
          Aguardar cliente
        </button>
        {canTransfer && (
          <button
            type="button"
            className="secondary-action"
            onClick={onOpenTransfer}
            disabled={actionsDisabled || conversation.status === 'closed'}
          >
            <Forward size={16} aria-hidden="true" />
            Transferir atendimento
          </button>
        )}
        {canClose && (
          <button
            type="button"
            className="secondary-action"
            onClick={onOpenClose}
            disabled={actionsDisabled || conversation.status === 'closed'}
          >
            <Archive size={16} aria-hidden="true" />
            Encerrar atendimento
          </button>
        )}
        {canArchive && (
          <button
            type="button"
            className={archived ? 'secondary-action' : 'secondary-action danger-secondary'}
            onClick={archived ? onRestore : onArchive}
            disabled={statusUpdating || archiveUpdating}
          >
            {archived ? <RotateCcw size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
            {archived
              ? archiveUpdating
                ? 'Restaurando...'
                : 'Restaurar conversa'
              : archiveUpdating
                ? 'Arquivando...'
                : 'Arquivar conversa'}
          </button>
        )}
        {canDelete && archived && (
          <button
            type="button"
            className="secondary-action danger-secondary"
            onClick={onOpenDelete}
            disabled={statusUpdating}
          >
            <Trash2 size={16} aria-hidden="true" />
            Excluir conversa
          </button>
        )}
        <button
          type="button"
          className={noteFormOpen ? 'secondary-action active' : 'secondary-action'}
          onClick={() => setNoteFormOpen((open) => !open)}
        >
          <NotebookPen size={16} aria-hidden="true" />
          Nota interna
        </button>
      </div>

      {noteFormOpen && (
        <form
          className="internal-note-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!noteDraft.trim()) return
            onAddNote(noteDraft.trim())
            setNoteDraft('')
          }}
        >
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Registre uma observação visível apenas para a equipe. Não é enviada ao cliente."
            rows={2}
          />
          <button type="submit" className="primary-action" disabled={noteSubmitting || !noteDraft.trim()}>
            {noteSubmitting ? 'Salvando...' : 'Adicionar nota'}
          </button>
        </form>
      )}

      <div className="messages-scroll" ref={scrollRef}>
        {loading && <MessageSkeleton />}

        {!loading && error && (
          <div className="empty-state">
            <p>{error}</p>
            <button type="button" className="secondary-action" onClick={onRetryLoad}>
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && hasMore && (
          <button type="button" className="load-older" onClick={onLoadOlder}>
            Carregar mensagens anteriores
          </button>
        )}

        {!loading &&
          !error &&
          timeline.map((entry) => {
            if (entry.kind === 'note') {
              const note = entry.note
              return (
                <article className="message-bubble internal-note" key={`note-${note.id}`}>
                  <header>
                    <strong>
                      <NotebookPen size={13} aria-hidden="true" /> Nota interna · {note.agentName}
                    </strong>
                    <span>{formatClock(note.createdAt)}</span>
                  </header>
                  <p>{note.note}</p>
                </article>
              )
            }

            const message = entry.message
            return (
              <article
                className={`message-bubble ${message.authorType} ${
                  message.status === 'failed' ? 'failed' : ''
                }`}
                key={message.clientMessageId ?? message.id}
              >
                <header>
                  <strong>{message.authorName}</strong>
                  <span>{formatClock(message.createdAt)}</span>
                </header>
                <p>{message.body}</p>
                {message.authorType === 'agent' && message.status && (
                  <footer>
                    {message.status === 'failed' ? (
                      <button type="button" onClick={() => onRetry(message)}>
                        <RotateCcw size={13} aria-hidden="true" />
                        Tentar novamente
                      </button>
                    ) : (
                      getStatusLabel(message.status === 'sending' ? 'waiting_agent' : 'open')
                        .replace('Aguardando atendente', 'Enviando...')
                        .replace('Em atendimento', 'Enviada')
                    )}
                  </footer>
                )}
              </article>
            )
          })}
      </div>

      {newMessageCount > 0 && (
        <button
          type="button"
          className="new-messages-pill"
          onClick={() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            setNewMessageCount(0)
          }}
        >
          ↓ {newMessageCount} novas mensagens
        </button>
      )}

      <div className="typing-line" aria-live="polite">
        {typingLabel}
      </div>

      <MessageComposer
        disabled={sendingDisabled || conversation.status === 'closed' || archived}
        agentName={currentAgentName}
        quickReplies={quickReplies}
        macros={macros}
        recentMacros={recentMacros}
        favoriteMacroIds={favoriteMacroIds}
        onTriggerMacro={onTriggerMacro}
        onSend={onSend}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
      />
    </section>
  )
}
