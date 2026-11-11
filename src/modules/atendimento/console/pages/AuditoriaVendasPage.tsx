import { useCallback, useEffect, useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { salesApi } from '../services/api/salesApi'
import type { Sale, SaleSummary } from '../types/domain'
import { formatDateTime } from '../utils/dates'
import { getReadableError } from '../utils/errors'

export function AuditoriaVendasPage() {
  const [summary, setSummary] = useState<SaleSummary | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [summaryData, salesData] = await Promise.all([salesApi.getSummary(), salesApi.list({ perPage: 100 })])
      setSummary(summaryData)
      setSales(salesData.data)
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível carregar a auditoria de vendas.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PageShell active="auditoria-vendas" title="Auditoria de vendas" subtitle="Registro e acompanhamento de vendas">
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && error && (
        <div className="empty-state">
          <p>{error}</p>
          <button type="button" className="secondary-action" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <section className="monitoring-stats">
            <div className="monitoring-stat-card">
              <div>
                <strong>{summary.countToday}</strong>
                <span>Vendas hoje</span>
              </div>
            </div>
            <div className="monitoring-stat-card">
              <div>
                <strong>{summary.countPeriod}</strong>
                <span>Vendas no período</span>
              </div>
            </div>
            <div className="monitoring-stat-card">
              <div>
                <strong>R$ {summary.valuePeriod.toFixed(2)}</strong>
                <span>Valor vendido</span>
              </div>
            </div>
            <div className="monitoring-stat-card">
              <div>
                <strong>R$ {summary.averageTicket.toFixed(2)}</strong>
                <span>Ticket médio</span>
              </div>
            </div>
          </section>

          <section className="monitoring-section">
            <h2>Vendas por produto</h2>
            {summary.byProduct.length === 0 && <p className="empty-state">Sem vendas neste período.</p>}
            <div className="quick-reply-list wide-list">
              {summary.byProduct.map((row) => (
                <div className="quick-reply-row" key={row.productType}>
                  <div className="quick-reply-row-info">
                    <strong>{row.productType}</strong>
                    <span>{row.count} venda(s)</span>
                    <span>R$ {row.value.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="monitoring-section">
            <h2>Todas as vendas</h2>
            {sales.length === 0 && <p className="empty-state">Nenhuma venda registrada.</p>}
            <div className="finalizados-table" role="table">
              <div className="finalizados-row finalizados-head" role="row">
                <span>Data</span>
                <span>Produto</span>
                <span>Plano</span>
                <span>Valor</span>
                <span>Status</span>
              </div>
              {sales.map((sale) => (
                <div className="finalizados-row" role="row" key={sale.id}>
                  <span>{formatDateTime(sale.createdAt)}</span>
                  <span>{sale.productType}</span>
                  <span>{sale.planName ?? '—'}</span>
                  <span>R$ {sale.value.toFixed(2)}</span>
                  <span>{sale.status}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  )
}
