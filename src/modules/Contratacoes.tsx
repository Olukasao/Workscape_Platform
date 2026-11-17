import { useEffect, useState } from "react";
import { ClipboardCheck, Copy, ExternalLink, Search, WifiOff, X } from "lucide-react";
import {
  grupoDoStatus,
  STATUS_ROTULO,
  useContratacoes,
  type Contratacao,
  type ContratacaoAndamento,
  type GrupoContratacao,
} from "../services/contratacoes";
import { Button } from "../components/ui/button";
import {
  Badge,
  EmptyState,
  PageHeader,
  StatusDot,
} from "../components/ui/primitives";

// Painel administrativo do site: abre no navegador padrão (somente este endereço fixo) ou copia o link.
const PAINEL_CONTRATACOES = "https://acessanet.com.br/admin/contratacoes";

const norm = (v = "") =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function espera(iso?: string) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return { label: "—", minutos: 0 };
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  const label =
    min < 1
      ? "agora"
      : min < 60
        ? `${min} min`
        : min < 1440
          ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`
          : `${Math.floor(min / 1440)} dia(s)`;
  return { label, minutos: min };
}
const quando = (iso?: string) => {
  const d = new Date(iso || "");
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

export default function Contratacoes() {
  const { recebido, conectado, pendentes, itens, andamento, atualizadoEm, novos, limparNovos } =
    useContratacoes();
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<GrupoContratacao>("aguardando");
  const [copiado, setCopiado] = useState("");
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);
  // Ao sair da tela, os destaques de "novo" deixam de valer.
  useEffect(() => () => limparNovos(), [limparNovos]);
  const abrirPainel = () => {
    if (window.desktop) void window.desktop.openExternal("painel-contratacoes");
    else window.open(PAINEL_CONTRATACOES, "_blank", "noopener,noreferrer");
  };
  const copiar = async (texto: string, aviso: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(aviso);
      setTimeout(() => setCopiado(""), 2500);
    } catch {
      setCopiado(texto);
    }
  };
  const termo = norm(busca.trim());
  const doGrupo = (g: GrupoContratacao) =>
    andamento.filter((i: ContratacaoAndamento) => grupoDoStatus(i.status) === g);
  const contagem: Record<GrupoContratacao, number> = {
    aguardando: recebido ? pendentes : 0,
    atendimento: doGrupo("atendimento").length,
    cancelados: doGrupo("cancelados").length,
    encerrados: doGrupo("encerrados").length,
  };
  const base: ContratacaoAndamento[] =
    grupo === "aguardando" ? itens.map((i) => ({ ...i, status: "novo" })) : doGrupo(grupo);
  const lista = termo
    ? base.filter((i) =>
        norm([i.cliente, i.protocolo, i.plano, i.cidade, i.responsavel, i.motivo].filter(Boolean).join(" ")).includes(termo),
      )
    : base;
  const aguardando = grupo === "aguardando";
  const vazio = {
    aguardando: "Nenhum pedido aguardando atendimento.",
    atendimento: "Nenhum pedido em atendimento.",
    cancelados: "Nenhum pedido cancelado.",
    encerrados: "Nenhum pedido encerrado.",
  }[grupo];
  const maisAntigo = itens.reduce<Contratacao | null>(
    (acc, i) => (!acc || (i.criadoEm || "") < (acc.criadoEm || "") ? i : acc),
    null,
  );
  return (
    <div className="page contratacoes-page">
      <PageHeader
        icon={ClipboardCheck}
        title="Contratações do site"
        description="Pedidos de contratação feitos pelo site acessanet.com.br, do primeiro contato ao encerramento."
        meta={
          <span className={`connection ${conectado ? "online" : ""}`} role="status">
            <i />
            {!recebido
              ? "Aguardando o Chat Interno"
              : conectado
                ? `Site conectado${atualizadoEm ? ` · ${new Date(atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}`
                : "Site indisponível"}
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={abrirPainel}>
              <ExternalLink size={14} />
              Abrir painel no navegador
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copiar(PAINEL_CONTRATACOES, "Link do painel copiado.")}
            >
              <Copy size={14} />
              Copiar link
            </Button>
          </div>
        }
      />
      <div className="agenda-kpis">
        <div className="agenda-kpi" data-tone={pendentes ? "warn" : "ok"}>
          <span>Aguardando atendimento</span>
          <strong>{recebido ? pendentes : "—"}</strong>
          <small>{pendentes > itens.length ? `${itens.length} mais recentes listados` : "Pedidos pendentes no site"}</small>
        </div>
        <div className="agenda-kpi" data-tone="info">
          <span>Novos nesta sessão</span>
          <strong>{recebido ? novos.length : "—"}</strong>
          <small>Avisados em tempo real</small>
        </div>
        <div className="agenda-kpi" data-tone="crit">
          <span>Esperando há mais tempo</span>
          <strong>{maisAntigo ? espera(maisAntigo.criadoEm).label : "—"}</strong>
          <small>{maisAntigo?.cliente || "Sem pedidos pendentes"}</small>
        </div>
      </div>
      {recebido && !conectado ? (
        <p className="inline-error is-warn" role="status">
          <WifiOff size={15} />
          Sem conexão com o site agora. Mostrando a última lista recebida.
        </p>
      ) : null}
      {copiado ? (
        <p className="inline-success" role="status">
          {copiado}
        </p>
      ) : null}
      <section className="panel panel--flush" aria-label="Pedidos pendentes">
        <div className="contratacoes-toolbar contratacoes-grupos">
          <div className="segmented" role="group" aria-label="Filtrar por situação">
            {(
              [
                ["aguardando", "Aguardando"],
                ["atendimento", "Em atendimento"],
                ["cancelados", "Cancelados"],
                ["encerrados", "Encerrados"],
              ] as const
            ).map(([id, rotulo]) => (
              <button key={id} type="button" aria-pressed={grupo === id} onClick={() => setGrupo(id)}>
                {rotulo} <span className="muted">({recebido ? contagem[id] : "—"})</span>
              </button>
            ))}
          </div>
        </div>
        <div className="contratacoes-toolbar">
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="Buscar contratação"
              placeholder="Buscar cliente, protocolo, plano ou cidade"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca ? (
              <button type="button" className="search-clear" aria-label="Limpar busca" onClick={() => setBusca("")}>
                <X size={14} />
              </button>
            ) : null}
          </label>
          <span className="muted text-xs">{lista.length} pedido(s)</span>
        </div>
        {!recebido ? (
          <EmptyState icon={ClipboardCheck} title="Aguardando dados">
            A lista chega pelo Chat Interno assim que a conexão em tempo real é
            estabelecida.
          </EmptyState>
        ) : lista.length ? (
          <table className="contratacoes-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Plano</th>
                <th>Cidade</th>
                <th>Protocolo</th>
                <th>Pedido em</th>
                {aguardando ? <th>Esperando</th> : <th>Situação</th>}
                {grupo === "cancelados" ? <th>Motivo</th> : null}
                {!aguardando ? <th>Responsável</th> : null}
                {!aguardando ? <th>Atualizado em</th> : null}
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => {
                const e = espera(i.criadoEm);
                const tone = e.minutos >= 1440 ? "crit" : e.minutos >= 120 ? "warn" : "ok";
                return (
                  <tr key={i.id} className={novos.includes(i.id) ? "is-new" : ""}>
                    <td>
                      <span className="contratacoes-cliente">
                        <strong>{i.cliente || "Cliente não informado"}</strong>
                        {novos.includes(i.id) ? <Badge tone="live" dot>Novo</Badge> : null}
                      </span>
                    </td>
                    <td>{i.plano || "—"}</td>
                    <td>{i.cidade || "—"}</td>
                    <td className="mono">{i.protocolo || "—"}</td>
                    <td>{quando(i.criadoEm)}</td>
                    <td>
                      {aguardando ? (
                        <span className="contratacoes-espera" data-tone={tone}>
                          <StatusDot tone={tone} />
                          {e.label}
                        </span>
                      ) : (
                        <Badge tone={i.status === "cancelado" ? "crit" : i.status === "contratado" ? "ok" : "neutral"}>
                          {STATUS_ROTULO[i.status] || i.status}
                        </Badge>
                      )}
                    </td>
                    {grupo === "cancelados" ? <td className="contratacoes-motivo"><span title={i.motivo || undefined}>{i.motivo || "Sem motivo registrado"}</span></td> : null}
                    {!aguardando ? <td>{i.responsavel || "—"}</td> : null}
                    {!aguardando ? <td>{quando(i.atualizadoEm)}</td> : null}
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Copiar protocolo de ${i.cliente || "cliente"}`}
                        title="Copiar protocolo"
                        onClick={() => void copiar(i.protocolo || String(i.id), `Protocolo ${i.protocolo || i.id} copiado.`)}
                      >
                        <Copy size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState compact icon={ClipboardCheck} tone="ok" title={busca ? "Nenhum pedido corresponde à busca." : vazio}>
            {busca || !aguardando ? "" : "Novos pedidos aparecem aqui e geram uma notificação."}
          </EmptyState>
        )}
      </section>
    </div>
  );
}
