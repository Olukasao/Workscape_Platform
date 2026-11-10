import { useState, type FormEvent } from "react";
import { Network, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge, EmptyState, PageHeader, Panel, Skeleton } from "../components/ui/primitives";
import { errorMessage } from "../services/api";
import { useBuscaBgp, useMudancasBgp, usePeersBgp, useResumoBgp } from "../services/rotasBgp";

const milhar = (n = 0) => n.toLocaleString("pt-BR");
const dataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
const caminho = (asns: string[]) => (asns?.length ? asns.map((a) => `AS${a}`).join(" → ") : "—");

function Busca() {
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const busca = useBuscaBgp(q);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setQ(texto.trim());
  };
  const r = busca.data;
  return (
    <Panel title="Buscar IP, prefixo ou ASN" icon={Search}>
      <form onSubmit={enviar} style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: 8.8.8.8, 187.52.38.0/24 ou AS15169"
          aria-label="IP, prefixo ou ASN"
        />
        <Button type="submit" disabled={texto.trim().length < 2}>Buscar</Button>
      </form>
      <div style={{ marginTop: 12 }}>
        {busca.isFetching ? <Skeleton className="h-12" /> : null}
        {busca.isError ? <div className="inline-error" role="alert">{errorMessage(busca.error)}</div> : null}
        {r && !busca.isFetching ? (
          r.disponivel === false ? (
            <p className="muted">O coletor de rotas não respondeu agora.</p>
          ) : r.kind === "asn" ? (
            <p><strong>AS{String(r.query).replace(/^AS/i, "")}</strong> · {r.name || "Nome não encontrado"}</p>
          ) : r.found && r.route ? (
            <div style={{ display: "grid", gap: 4 }}>
              <p><strong>{r.route.prefix}/{r.route.prefixlen}</strong> · origem AS{r.route.origin_as} {r.route.iswithdrawn ? <Badge tone="crit">retirada</Badge> : <Badge tone="ok">ativa</Badge>}</p>
              <p className="muted">Caminho: {caminho(r.route.as_path)}</p>
              <p className="muted">Next-hop {r.route.nh} · peer {r.route.peername} · atualizada em {dataHora(r.route.lastmodified)}</p>
            </div>
          ) : (
            <p className="muted">Nenhuma rota encontrada para essa busca.</p>
          )
        ) : null}
      </div>
    </Panel>
  );
}

export default function RotasBgp() {
  const resumo = useResumoBgp();
  const peers = usePeersBgp();
  const mudancas = useMudancasBgp();
  const t = resumo.data?.totals;
  const fora = resumo.data && resumo.data.disponivel === false;

  return (
    <div className="page rede-page">
      <PageHeader
        icon={Network}
        title="Rotas · BGP"
        description="Sessões e rotas vistas pelo roteador de borda, em tempo real (OpenBMP)."
        meta={t?.last_update ? <span className="heading-meta">Última rota: {dataHora(t.last_update)}</span> : undefined}
      />
      {resumo.isError ? <div className="inline-error" role="alert">{errorMessage(resumo.error)}</div> : null}
      {fora ? <EmptyState title="Coletor de rotas indisponível">Não consegui falar com a VM do OpenBMP agora. Tente de novo em instantes.</EmptyState> : null}
      {resumo.isPending ? <Skeleton className="h-24" /> : null}

      {t ? (
        <div className="rede-resumo">
          <div><span>Roteadores no ar</span><strong>{t.routers_up}/{t.routers}</strong></div>
          <div data-tone={t.peers_up < t.peers ? "crit" : undefined}><span>Sessões BGP no ar</span><strong>{t.peers_up}/{t.peers}</strong></div>
          <div><span>Prefixos</span><strong>{milhar(t.prefixes)}</strong></div>
          <div><span>Atualizações por minuto</span><strong>{milhar(t.updates_last_minute)}</strong></div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 16 }}>
        <Busca />

        <Panel title="Sessões BGP (peers)" icon={Network}>
          {peers.isPending ? <Skeleton className="h-24" /> : null}
          {peers.data?.items?.length ? (
            <table className="rede-tabela">
              <thead><tr><th>Peer</th><th>IP</th><th>ASN</th><th>Operadora</th><th>Estado</th></tr></thead>
              <tbody>
                {peers.data.items.map((p) => (
                  <tr key={p.peer_hash_id}>
                    <td>{p.peername}</td>
                    <td>{p.peerip}</td>
                    <td>AS{p.peerasn}</td>
                    <td>{p.as_name || "—"}</td>
                    <td><Badge tone={p.peer_state === "up" ? "ok" : "crit"} dot>{p.peer_state === "up" ? "No ar" : "Caiu"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : peers.data && !peers.isPending ? <p className="muted">Nenhuma sessão encontrada.</p> : null}
        </Panel>

        <Panel title="Últimas mudanças de rota" icon={Network}>
          {mudancas.isPending ? <Skeleton className="h-24" /> : null}
          {mudancas.data?.items?.length ? (
            <table className="rede-tabela">
              <thead><tr><th>Hora</th><th>Prefixo</th><th>Evento</th><th>Origem</th><th>Caminho</th></tr></thead>
              <tbody>
                {mudancas.data.items.map((m) => (
                  <tr key={m.id}>
                    <td>{dataHora(m.lastmodified)}</td>
                    <td>{m.prefix}/{m.prefixlen}</td>
                    <td><Badge tone={m.event === "Advertised" ? "ok" : "warn"}>{m.event === "Advertised" ? "Anunciada" : "Retirada"}</Badge></td>
                    <td>{m.origin_as ? `AS${m.origin_as}` : "—"}</td>
                    <td className="muted">{caminho(m.as_path)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : mudancas.data && !mudancas.isPending ? <p className="muted">Nenhuma mudança recente.</p> : null}
        </Panel>
      </div>
    </div>
  );
}
