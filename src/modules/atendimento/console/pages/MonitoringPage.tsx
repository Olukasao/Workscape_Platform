import {
  AlertTriangle,
  Clock3,
  Eye,
  Headset,
  Inbox,
  MessageCircle,
  Search,
  TimerReset,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgentStatusDot, type AgentDotStatus } from '../components/shared/AgentStatusDot'
import { HourlyBarChart } from '../components/shared/HourlyBarChart'
import { PageShell } from '../components/layout/PageShell'
import { MetricCard } from '../components/shared/MetricCard'
import { SectionCard } from '../components/shared/SectionCard'
import { TrendAreaChart } from '../components/shared/TrendAreaChart'
import { auditApi } from '../services/api/auditApi'
import { monitoringApi } from '../services/api/monitoringApi'
import { chatSocket } from '../services/socket/socketService'
import type { ConversationSummary, MonitoringAgent, MonitoringOverview, MonitoringQueue } from '../types/domain'
import { formatHms } from '../utils/dates'
import { getAgentRoleLabel } from '../utils/agents'
import { getConversationTagLabel, conversationTagOptions } from '../utils/conversationTags'
import { getReadableError } from '../utils/errors'
import {
  addDays,
  bucketByHour,
  fetchConversationsInRange,
  isWithinDay,
  startOfDay,
  tallyByAgent,
  tallyTags,
} from '../utils/monitoringInsights'

const REFRESH_INTERVAL_MS = 30_000

const TAG_COLORS: Record<string, string> = {
  no_connection: 'var(--danger)',
  billing: 'var(--warning)',
  slowness: 'var(--info)',
  wifi: 'var(--accent-strong)',
  visit: 'var(--success)',
  cancellation: '#c77dff',
  sem_categoria: 'var(--text-muted)',
}

type CompareMode = 'yesterday' | '7d'

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return 'agora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`
}

function getTagLabel(tag: string): string {
  return tag === 'sem_categoria' ? 'Sem categoria' : getConversationTagLabel(tag as never)
}

function toAgentDotStatus(status: MonitoringAgent['attendanceStatus']): AgentDotStatus {
  return status === 'INVISIBLE' ? 'invisible' : 'online'
}

function percentDelta(
  current: number,
  previous: number,
  compareLabel: string,
): { direction: 'up' | 'down'; label: string } | null {
  if (previous === 0) {
    if (current === 0) return null
    return { direction: 'up', label: `novo vs. ${compareLabel}` }
  }
  const delta = Math.round(((current - previous) / previous) * 100)
  if (delta === 0) return null
  return { direction: delta > 0 ? 'up' : 'down', label: `${Math.abs(delta)}% vs. ${compareLabel}` }
}

export function MonitoringPage() {
  const [overview, setOverview] = useState<MonitoringOverview | null>(null)
  const [queues, setQueues] = useState<MonitoringQueue[]>([])
  const [agents, setAgents] = useState<MonitoringAgent[]>([])
  const [todaysConversations, setTodaysConversations] = useState<ConversationSummary[]>([])
  const [compareConversations, setCompareConversations] = useState<ConversationSummary[]>([])
  const [transfersByAgent, setTransfersByAgent] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<MonitoringAgent | null>(null)

  const [compareMode, setCompareMode] = useState<CompareMode>('yesterday')
  const [queueChartTag, setQueueChartTag] = useState('all')
  const [agentSearch, setAgentSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const refreshingRef = useRef(false)

  const load = useCallback(async (silent = false) => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    if (!silent) setLoading(true)
    setError('')

    const now = new Date()
    const todayStart = startOfDay(now)
    const compareStart = compareMode === 'yesterday' ? addDays(todayStart, -1) : addDays(todayStart, -7)
    const compareEnd = addDays(compareStart, 1)

    try {
      const [overviewData, queuesData, agentsData, rangeConversations, transferLogs] = await Promise.all([
        monitoringApi.getOverview(),
        monitoringApi.getQueues(),
        monitoringApi.getAgents(),
        fetchConversationsInRange(compareStart.toISOString(), now.toISOString()),
        // "Transferidos" is an enrichment on top of the core snapshot above — if the
        // audit endpoint rejects this query, the dashboard should still render with
        // that column blank rather than failing outright.
        auditApi
          .list({ action: 'transfer', dateFrom: todayStart.toISOString(), perPage: 300 })
          .catch(() => ({ data: [], pagination: { hasMore: false } })),
      ])

      setOverview(overviewData)
      setQueues(queuesData)
      setAgents(agentsData)
      setTodaysConversations(
        rangeConversations.filter((item) => isWithinDay(item.createdAt, todayStart, now)),
      )
      setCompareConversations(
        rangeConversations.filter((item) => isWithinDay(item.createdAt, compareStart, compareEnd)),
      )

      const transferTally = new Map<string, number>()
      for (const entry of transferLogs.data) {
        if (!entry.agentId) continue
        transferTally.set(entry.agentId, (transferTally.get(entry.agentId) ?? 0) + 1)
      }
      setTransfersByAgent(transferTally)
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível carregar o monitoramento.'))
    } finally {
      if (!silent) setLoading(false)
      refreshingRef.current = false
    }
  }, [compareMode])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => void load(true), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!selectedAgent) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedAgent(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedAgent])

  useEffect(() => {
    const events = [
      'conversation_created',
      'conversation_updated',
      'conversation_assigned',
      'conversation_transferred',
      'conversation_closed',
      'user:status_changed',
    ] as const

    let debounceTimer: number | null = null
    const scheduleRefresh = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => void load(true), 1500)
    }

    const offs = events.map((event) => chatSocket.on(event, scheduleRefresh))
    return () => {
      offs.forEach((off) => off())
      if (debounceTimer) window.clearTimeout(debounceTimer)
    }
  }, [load])

  const queueTagOptions = useMemo(() => {
    const present = new Set(queues.map((queue) => queue.tag))
    return conversationTagOptions.filter((option) => present.has(option.id))
  }, [queues])

  const queueFilteredConversations = useMemo(() => {
    if (queueChartTag === 'all') return todaysConversations
    return todaysConversations.filter((item) =>
      queueChartTag === 'sem_categoria' ? !item.tags?.length : item.tags?.includes(queueChartTag as never),
    )
  }, [todaysConversations, queueChartTag])

  const queuePeaksData = useMemo(
    () => bucketByHour(queueFilteredConversations, (item) => item.createdAt),
    [queueFilteredConversations],
  )

  const newTicketsData = useMemo(() => bucketByHour(todaysConversations, (item) => item.createdAt), [todaysConversations])
  const closedTicketsData = useMemo(
    () =>
      bucketByHour(
        todaysConversations.filter((item) => item.status === 'closed'),
        (item) => item.closedAt ?? item.updatedAt,
      ),
    [todaysConversations],
  )

  const tagTally = useMemo(() => tallyTags(todaysConversations), [todaysConversations])
  const tagRows = useMemo(
    () =>
      [...tagTally.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count, color: TAG_COLORS[tag] ?? 'var(--accent)' })),
    [tagTally],
  )
  const tagTotal = tagRows.reduce((sum, row) => sum + row.count, 0)
  const [showAllTags, setShowAllTags] = useState(false)
  const visibleTagRows = showAllTags ? tagRows : tagRows.slice(0, 8)

  const attendedByAgent = useMemo(() => tallyByAgent(todaysConversations), [todaysConversations])

  const totalNow = todaysConversations.length
  const totalCompare = compareConversations.length
  const newNow = todaysConversations.filter((item) => item.status === 'new').length
  const newCompare = compareConversations.filter((item) => item.status === 'new').length
  const closedNow = todaysConversations.filter((item) => item.status === 'closed').length
  const closedCompare = compareConversations.filter((item) => item.status === 'closed').length

  const roleOptions = useMemo(() => {
    const roles = new Set(agents.map((agent) => agent.role))
    return [...roles]
  }, [agents])

  const filteredAgents = useMemo(() => {
    const search = agentSearch.trim().toLowerCase()
    return agents.filter((agent) => {
      if (roleFilter !== 'all' && agent.role !== roleFilter) return false
      if (search && !agent.name.toLowerCase().includes(search)) return false
      return true
    })
  }, [agents, agentSearch, roleFilter])

  const compareLabel = compareMode === 'yesterday' ? 'ontem' : '7 dias atrás'

  return (
    <PageShell
      active="monitoramento"
      title="Monitoramento"
      subtitle="Monitore em tempo real os agentes e atendimentos da sua operação."
      headerExtra={
        <div className="ops-header-filters">
          <label className="ops-header-filter">
            <span>Comparar com</span>
            <select
              className="select-input"
              value={compareMode}
              onChange={(event) => setCompareMode(event.target.value as CompareMode)}
            >
              <option value="yesterday">Ontem</option>
              <option value="7d">7 dias atrás</option>
            </select>
          </label>
          <label className="ops-header-filter">
            <span>Operação</span>
            <select className="select-input" value="acessanet" disabled>
              <option value="acessanet">Acessanet</option>
            </select>
          </label>
        </div>
      }
    >
      {loading && (
        <div className="ops-skeleton">
          <div className="ops-kpi-row">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="metric-card skeleton-block" key={index} />
            ))}
          </div>
          <div className="ops-charts-row">
            <div className="section-card skeleton-block tall" />
            <div className="section-card skeleton-block tall" />
          </div>
          <div className="section-card skeleton-block" />
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

      {!loading && !error && overview && (
        <>
          <div className="ops-kpi-row">
            <MetricCard label="Em Atendimento" value={overview.activeNow} icon={<Headset size={16} aria-hidden="true" />} accent />
            <MetricCard label="Em Fila" value={overview.waitingForAgent} icon={<Clock3 size={16} aria-hidden="true" />} />
            <MetricCard
              label="Total"
              value={totalNow}
              trend={percentDelta(totalNow, totalCompare, compareLabel) ?? undefined}
            />
            <MetricCard
              label="Novos"
              value={newNow}
              trend={percentDelta(newNow, newCompare, compareLabel) ?? undefined}
            />
            <MetricCard
              label="Finalizados"
              value={closedNow}
              trend={percentDelta(closedNow, closedCompare, compareLabel) ?? undefined}
            />
          </div>

          <div className="ops-kpi-row secondary">
            <MetricCard label="T. Médio Atend." value={formatHms(overview.avgHandleSeconds)} icon={<TimerReset size={16} aria-hidden="true" />} />
            <MetricCard label="T. Médio Fila" value={formatHms(overview.avgWaitSeconds)} icon={<Clock3 size={16} aria-hidden="true" />} />
            <MetricCard label="Maior Espera Atual" value={formatHms(overview.longestWaitSeconds)} icon={<AlertTriangle size={16} aria-hidden="true" />} />
          </div>

          <div className="ops-charts-row">
            <SectionCard
              title="Picos de filas"
              subtitle="Hora a hora"
              headerRight={
                <select className="select-input compact" value={queueChartTag} onChange={(event) => setQueueChartTag(event.target.value)}>
                  <option value="all">Todas as filas</option>
                  {queueTagOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            >
              <HourlyBarChart data={queuePeaksData} emptyLabel="Nenhum ticket hoje para esta fila." />
            </SectionCard>

            <SectionCard
              title="Novos tickets"
              subtitle="Hora a hora"
              headerRight={
                <span className="ops-mini-indicator">
                  <MessageCircle size={13} aria-hidden="true" />
                  WhatsApp · Hoje: {totalNow}
                </span>
              }
            >
              <TrendAreaChart
                series={[
                  { label: 'Novos', color: 'var(--accent-strong)', data: newTicketsData },
                  { label: 'Finalizados', color: 'var(--success)', data: closedTicketsData, fill: false },
                ]}
                emptyLabel="Nenhum ticket registrado hoje."
              />
            </SectionCard>
          </div>

          <SectionCard title="Tabulações do dia" subtitle="Quantidade de tags aplicadas hoje">
            {tagRows.length === 0 ? (
              <p className="chart-empty">Nenhuma tabulação registrada hoje.</p>
            ) : (
              <div className="tabulations-layout">
                <div className="tabulations-bars">
                  {visibleTagRows.map((row) => (
                    <div className="tabulations-bar-col" key={row.tag}>
                      <div className="tabulations-bar-track">
                        <div
                          className="tabulations-bar-fill"
                          style={{
                            height: `${Math.max(4, (row.count / (tagRows[0]?.count || 1)) * 100)}%`,
                            background: row.color,
                          }}
                        />
                      </div>
                      <span className="tabulations-bar-value">{row.count}</span>
                      <span className="tabulations-bar-label">{getTagLabel(row.tag)}</span>
                    </div>
                  ))}
                </div>
                <div className="tabulations-legend">
                  <div className="tabulations-legend-total">
                    <span>Total geral</span>
                    <strong>{tagTotal}</strong>
                  </div>
                  <ul>
                    {(showAllTags ? tagRows : tagRows.slice(0, 8)).map((row) => (
                      <li key={row.tag}>
                        <span className="tabulations-legend-dot" style={{ background: row.color }} aria-hidden="true" />
                        <span className="tabulations-legend-name">{getTagLabel(row.tag)}</span>
                        <span className="tabulations-legend-count">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                  {tagRows.length > 8 && (
                    <button type="button" className="secondary-action compact" onClick={() => setShowAllTags((current) => !current)}>
                      {showAllTags ? 'Mostrar menos' : `Mostrar todas (${tagRows.length})`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Agentes"
            headerRight={
              <div className="ops-agents-controls">
                <div className="ops-status-pills">
                  <span className="ops-status-pill">
                    <span className="status-dot online" aria-hidden="true" /> {overview.agentsOnline} online
                  </span>
                  <span className="ops-status-pill">
                    <span className="status-dot invisible" aria-hidden="true" /> {overview.agentsInvisible} pausa
                  </span>
                  <span className="ops-status-pill">
                    <span className="status-dot offline" aria-hidden="true" /> {overview.agentsOffline} desconectado
                  </span>
                </div>
                <select className="select-input compact" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="all">Todos os perfis</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {getAgentRoleLabel(role)}
                    </option>
                  ))}
                </select>
                <div className="search-box compact">
                  <Search size={14} aria-hidden="true" />
                  <input
                    value={agentSearch}
                    onChange={(event) => setAgentSearch(event.target.value)}
                    placeholder="Digite para buscar"
                  />
                </div>
              </div>
            }
          >
            {filteredAgents.length === 0 ? (
              <div className="empty-state">
                <Inbox size={26} aria-hidden="true" />
                <p>Nenhum agente encontrado com os filtros aplicados.</p>
              </div>
            ) : (
              <div className="ops-table-scroll">
                <table className="ops-agents-table">
                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>Tempo</th>
                      <th>Perfil</th>
                      <th>Em atendimento</th>
                      <th>Atendidos</th>
                      <th>Transferidos</th>
                      <th>TMA</th>
                      <th>TMR</th>
                      <th>Logado</th>
                      <th>Pausa total</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr key={agent.id}>
                        <td>
                          <span className="ops-agent-cell">
                            <span className="ops-agent-avatar">{agent.name.charAt(0).toUpperCase()}</span>
                            <span>
                              <strong>{agent.name}</strong>
                              <AgentStatusDot
                                status={toAgentDotStatus(agent.attendanceStatus)}
                                label={agent.attendanceStatus === 'INVISIBLE' ? 'Pausa' : 'Online'}
                              />
                            </span>
                          </span>
                        </td>
                        <td>{formatHms(agent.statusSinceSeconds)}</td>
                        <td>
                          <span className="tag-chip compact">{getAgentRoleLabel(agent.role)}</span>
                        </td>
                        <td>{agent.activeConversations}</td>
                        <td>{attendedByAgent.get(agent.id) ?? 0}</td>
                        <td>{transfersByAgent.get(agent.id) ?? 0}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>
                          <button
                            type="button"
                            className="icon-action"
                            data-tooltip="Visualizar agente"
                            onClick={() => setSelectedAgent(agent)}
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

      {selectedAgent && (
        <div className="drawer-backdrop" role="presentation" onClick={() => setSelectedAgent(null)}>
          <aside className="audit-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="audit-drawer-header">
              <div>
                <h2>{selectedAgent.name}</h2>
                <AgentStatusDot
                  status={toAgentDotStatus(selectedAgent.attendanceStatus)}
                  label={selectedAgent.attendanceStatus === 'INVISIBLE' ? 'Pausa' : 'Online'}
                />
              </div>
              <button type="button" className="icon-action" onClick={() => setSelectedAgent(null)} aria-label="Fechar">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <dl className="info-list">
              <div className="info-row">
                <dt>Perfil</dt>
                <dd>{getAgentRoleLabel(selectedAgent.role)}</dd>
              </div>
              <div className="info-row">
                <dt>Em atendimento agora</dt>
                <dd>{selectedAgent.activeConversations}</dd>
              </div>
              <div className="info-row">
                <dt>Atendidos hoje</dt>
                <dd>{attendedByAgent.get(selectedAgent.id) ?? 0}</dd>
              </div>
              <div className="info-row">
                <dt>Transferidos hoje</dt>
                <dd>{transfersByAgent.get(selectedAgent.id) ?? 0}</dd>
              </div>
              <div className="info-row">
                <dt>Tempo no status atual</dt>
                <dd>{formatHms(selectedAgent.statusSinceSeconds)}</dd>
              </div>
              <div className="info-row">
                <dt>Atendimento mais antigo</dt>
                <dd>{formatDuration(selectedAgent.oldestActiveSeconds)}</dd>
              </div>
              <div className="info-row">
                <dt>TMA / TMR / Logado / Pausa total</dt>
                <dd>Não disponível pela API atual</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </PageShell>
  )
}
