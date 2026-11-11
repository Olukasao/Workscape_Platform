import { AlertTriangle, Plus, Send, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { useAuth } from '../hooks/useAuth'
import { campaignsApi, type CampaignInput } from '../services/api/campaignsApi'
import type { AudienceEstimate, Campaign, CampaignChannel, ConversationTag } from '../types/domain'
import { conversationTagOptions } from '../utils/conversationTags'
import { formatDateTime } from '../utils/dates'
import { getReadableError } from '../utils/errors'
import { canSendCampaigns } from '../utils/security'

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'E-mail',
  chat: 'Chat',
}

const STATUS_LABELS: Record<Campaign['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  processing: 'Processando',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  error: 'Erro',
}

const emptyForm = {
  name: '',
  channel: 'whatsapp' as CampaignChannel,
  tag: '' as ConversationTag | '',
  messageBody: '',
  scheduledAt: '',
}

export function DisparosPage() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [audience, setAudience] = useState<AudienceEstimate | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendTarget, setSendTarget] = useState<Campaign | null>(null)
  const [sendResult, setSendResult] = useState('')

  const canSend = canSendCampaigns(user?.role)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await campaignsApi.list()
      setCampaigns(response.data)
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível carregar os disparos.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!formOpen) return
    setEstimating(true)
    const filter = form.tag ? { tags: [form.tag] } : null

    campaignsApi
      .estimateAudience(filter)
      .then(setAudience)
      .catch(() => setAudience(null))
      .finally(() => setEstimating(false))
  }, [formOpen, form.tag])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name.trim() || !form.messageBody.trim()) return
    setSaving(true)
    setError('')

    try {
      const input: CampaignInput = {
        name: form.name.trim(),
        channel: form.channel,
        audienceFilter: form.tag ? { tags: [form.tag] } : null,
        messageBody: form.messageBody.trim(),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      }
      const created = await campaignsApi.create(input)
      setCampaigns((current) => [created, ...current])
      setForm(emptyForm)
      setFormOpen(false)
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível criar o disparo.'))
    } finally {
      setSaving(false)
    }
  }

  async function cancelCampaign(campaign: Campaign) {
    try {
      const updated = await campaignsApi.cancel(campaign.id)
      setCampaigns((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível cancelar o disparo.'))
    }
  }

  async function confirmSend() {
    if (!sendTarget) return
    const result = await campaignsApi.send(sendTarget.id)
    if (result.ok) {
      setCampaigns((current) => current.map((item) => (item.id === result.campaign.id ? result.campaign : item)))
    } else {
      setSendResult(result.message)
    }
    setSendTarget(null)
  }

  return (
    <PageShell
      active="disparos"
      title="Disparos"
      subtitle="Central de campanhas e comunicados aos clientes"
      headerExtra={
        <button type="button" className="primary-action compact" onClick={() => setFormOpen((open) => !open)}>
          <Plus size={16} aria-hidden="true" />
          Novo disparo
        </button>
      }
    >
      {sendResult && (
        <div className="toast toast-warning" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          {sendResult}
          <button type="button" onClick={() => setSendResult('')} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}

      {formOpen && (
        <form className="quick-reply-form" onSubmit={handleSubmit}>
          <div className="quick-reply-form-row">
            <label className="field-label">
              Nome do disparo
              <input
                className="select-input"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Manutenção programada - Zona Norte"
              />
            </label>
            <label className="field-label">
              Canal
              <select
                className="select-input"
                value={form.channel}
                onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as CampaignChannel }))}
              >
                {Object.entries(CHANNEL_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-label">
            Público (categoria do atendimento, opcional)
            <select
              className="select-input"
              value={form.tag}
              onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value as ConversationTag | '' }))}
            >
              <option value="">Todos os clientes com atendimento registrado</option>
              {conversationTagOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="audience-estimate">
            <Users size={16} aria-hidden="true" />
            {estimating ? 'Calculando público...' : `Público estimado: ${audience?.count ?? 0} cliente(s)`}
          </div>

          <label className="field-label">
            Mensagem
            <textarea
              value={form.messageBody}
              onChange={(event) => setForm((current) => ({ ...current, messageBody: event.target.value }))}
              rows={4}
              placeholder={'Olá {{nome}}, identificamos manutenção na sua região.'}
            />
          </label>
          <p className="modal-subtitle">
            Variáveis disponíveis: {'{{nome}}'}, {'{{contrato}}'}
          </p>

          <label className="field-label">
            Agendamento (opcional — vazio envia manualmente quando confirmado)
            <input
              className="select-input"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="secondary-action" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-action compact"
              disabled={saving || !form.name.trim() || !form.messageBody.trim()}
            >
              {saving ? 'Salvando...' : 'Salvar rascunho'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      {loading && <p className="empty-state">Carregando disparos...</p>}

      {!loading && campaigns.length === 0 && (
        <div className="empty-state">
          <Send size={24} aria-hidden="true" />
          <p>Nenhum disparo criado ainda.</p>
          <p>Crie uma campanha para enviar comunicados aos clientes.</p>
          <button type="button" className="primary-action compact" onClick={() => setFormOpen(true)}>
            Criar disparo
          </button>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="quick-reply-list wide-list">
          {campaigns.map((campaign) => (
            <div className="quick-reply-row" key={campaign.id}>
              <div className="quick-reply-row-info">
                <strong>{campaign.name}</strong>
                <span className="tag-chip compact">{CHANNEL_LABELS[campaign.channel]}</span>
                <span className="tag-chip compact">{STATUS_LABELS[campaign.status]}</span>
                <span>{campaign.recipientsCount} destinatário(s)</span>
                {campaign.scheduledAt && <small>Agendado: {formatDateTime(campaign.scheduledAt)}</small>}
              </div>
              {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                <div className="quick-reply-row-actions">
                  {canSend && (
                    <button type="button" className="secondary-action compact" onClick={() => setSendTarget(campaign)}>
                      Enviar
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-action danger-secondary compact"
                    onClick={() => void cancelCampaign(campaign)}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(sendTarget)}
        title="Enviar disparo"
        message={`Você está prestes a enviar esta mensagem para ${sendTarget?.recipientsCount ?? 0} cliente(s). Deseja continuar?`}
        confirmLabel="Enviar"
        loadingLabel="Enviando..."
        loading={false}
        onCancel={() => setSendTarget(null)}
        onConfirm={() => void confirmSend()}
      />
    </PageShell>
  )
}
