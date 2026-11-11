import { CircleDollarSign, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { salesApi, type CreateSaleInput } from '../services/api/salesApi'
import type { Sale, SaleStatus } from '../types/domain'
import { formatDateTime } from '../utils/dates'
import { getReadableError } from '../utils/errors'

const PRODUCT_TYPE_SUGGESTIONS = [
  'Novo contrato',
  'Upgrade',
  'Adicional',
  'Telefone',
  'Streaming',
  'Outro produto',
]

const STATUS_LABELS: Record<SaleStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

const emptyForm: CreateSaleInput = { productType: '', planName: '', value: 0, origin: '', note: '' }

export function VendasPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CreateSaleInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await salesApi.list({ perPage: 50 })
      setSales(response.data)
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível carregar as vendas.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.productType.trim() || !(form.value > 0)) return
    setSaving(true)
    setError('')

    try {
      const created = await salesApi.create(form)
      setSales((current) => [created, ...current])
      setForm(emptyForm)
      setFormOpen(false)
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível registrar a venda.'))
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(sale: Sale, status: SaleStatus) {
    setUpdatingId(sale.id)

    try {
      const updated = await salesApi.update(sale.id, { status })
      setSales((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível atualizar a venda.'))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <PageShell
      active="vendas"
      title="Vendas"
      subtitle="Registre contratações e acompanhe suas vendas"
      headerExtra={
        <button type="button" className="primary-action compact" onClick={() => setFormOpen((open) => !open)}>
          <Plus size={16} aria-hidden="true" />
          Registrar venda
        </button>
      }
    >
      {formOpen && (
        <form className="quick-reply-form" onSubmit={handleSubmit}>
          <div className="quick-reply-form-row">
            <label className="field-label">
              Produto
              <input
                className="select-input"
                list="product-type-suggestions"
                value={form.productType}
                onChange={(event) => setForm((current) => ({ ...current, productType: event.target.value }))}
                placeholder="Novo contrato"
              />
              <datalist id="product-type-suggestions">
                {PRODUCT_TYPE_SUGGESTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label className="field-label">
              Plano
              <input
                className="select-input"
                value={form.planName}
                onChange={(event) => setForm((current) => ({ ...current, planName: event.target.value }))}
                placeholder="700 Mega"
              />
            </label>
          </div>
          <div className="quick-reply-form-row">
            <label className="field-label">
              Valor (R$)
              <input
                className="select-input"
                type="number"
                min={0}
                step="0.01"
                value={form.value || ''}
                onChange={(event) => setForm((current) => ({ ...current, value: Number(event.target.value) }))}
              />
            </label>
            <label className="field-label">
              Origem
              <input
                className="select-input"
                value={form.origin}
                onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
                placeholder="Atendimento chat"
              />
            </label>
          </div>
          <label className="field-label">
            Observação
            <textarea
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              rows={2}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-action" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-action compact"
              disabled={saving || !form.productType.trim() || !(form.value > 0)}
            >
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      {loading && <p className="empty-state">Carregando vendas...</p>}

      {!loading && sales.length === 0 && (
        <div className="empty-state">
          <CircleDollarSign size={24} aria-hidden="true" />
          <p>Nenhuma venda registrada ainda.</p>
        </div>
      )}

      {!loading && sales.length > 0 && (
        <div className="quick-reply-list wide-list">
          {sales.map((sale) => (
            <div className="quick-reply-row" key={sale.id}>
              <div className="quick-reply-row-info">
                <strong>{sale.productType}</strong>
                {sale.planName && <span>{sale.planName}</span>}
                <span>R$ {sale.value.toFixed(2)}</span>
                <span className={`tag-chip compact sale-status-${sale.status}`}>{STATUS_LABELS[sale.status]}</span>
                <small>{formatDateTime(sale.createdAt)}</small>
              </div>
              {sale.status === 'pending' && (
                <div className="quick-reply-row-actions">
                  <button
                    type="button"
                    className="secondary-action compact"
                    disabled={updatingId === sale.id}
                    onClick={() => void changeStatus(sale, 'confirmed')}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="secondary-action danger-secondary compact"
                    disabled={updatingId === sale.id}
                    onClick={() => void changeStatus(sale, 'cancelled')}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
