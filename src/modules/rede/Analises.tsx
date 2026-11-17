import { Fragment, useState } from "react";
import { ChevronDown, Clipboard, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../../components/ui/button";
import { Badge, EmptyState, Segmented, Skeleton } from "../../components/ui/primitives";
import { errorMessage } from "../../services/api";
import {
  duracaoTexto,
  useInstaveis,
  useNaoAutorizadas,
  useNomesClientes,
  useRankingPons,
  useSinalCritico,
  type ClienteInstavel,
  type PonRanking,
  type PonSinal,
} from "../../services/redeOlt";
import { Activity, ShieldAlert } from "lucide-react";

export type AbaRede = "incidentes" | "sinal" | "instaveis" | "pons" | "autorizar";
export const ABAS_REDE: readonly (readonly [AbaRede, string])[] = [
  ["incidentes", "Incidentes"],
  ["sinal", "Sinal crítico"],
  ["instaveis", "Quedas repetidas"],
  ["pons", "PONs problemáticas"],
  ["autorizar", "A autorizar"],
];

const dbmTexto = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")} dBm`);
const horaCurta = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const local = (olt: string, slot: string, pon: string) => `${olt} · ${slot}/${pon}`;

function CopiarContratos({ contratos }: { contratos: string[] }) {
  const [copiado, setCopiado] = useState(false);
  if (!contratos.length) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await window.desktop?.copyText(contratos.join("\n"));
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
    >
      <Clipboard size={14} /> {copiado ? "Contratos copiados" : "Copiar contratos"}
    </Button>
  );
}

function Carregando({ texto }: { texto: string }) {
  return (
    <div className="rede-lista" aria-busy="true">
      <p className="muted">{texto}</p>
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}

function Falha({ erro, refazer }: { erro: unknown; refazer: () => void }) {
  return (
    <EmptyState icon={ShieldAlert} tone="warn" title="Não foi possível consultar a rede" action={<Button onClick={refazer}>Tentar de novo</Button>}>
      {errorMessage(erro)}
    </EmptyState>
  );
}

function LinhaPonSinal({ p, aberta, alternar }: { p: PonSinal; aberta: boolean; alternar: () => void }) {
  const nomes = useNomesClientes(aberta ? p.clientes.slice(0, 60).map((c) => c.contrato) : []);
  return (
    <Fragment>
      <tr className="rede-linha-clicavel" onClick={alternar}>
        <td>
          <button type="button" className="rede-linha-botao" aria-expanded={aberta} onClick={(e) => { e.stopPropagation(); alternar(); }}>
            <ChevronDown size={14} className={clsx("rede-seta", aberta && "aberta")} /> {local(p.olt, p.slot, p.pon)}
          </button>
        </td>
        <td><strong>{p.criticos}</strong> de {p.total} <span className="muted">({p.pctCriticos}%)</span></td>
        <td>{p.avisos}</td>
      </tr>
      {aberta ? (
        <tr>
          <td colSpan={3}>
            <div className="rede-clientes">
              <div className="rede-clientes-topo">
                <span>{p.clientes.length} cliente{p.clientes.length === 1 ? "" : "s"} com sinal crítico (mais fracos primeiro)</span>
                <CopiarContratos contratos={p.clientes.map((c) => c.contrato)} />
              </div>
              <table className="rede-tabela">
                <thead><tr><th>Contrato</th><th>Cliente</th><th>Sinal na ONU</th><th>Sinal na OLT</th><th>Série da ONU</th></tr></thead>
                <tbody>
                  {p.clientes.map((c) => (
                    <tr key={`${c.contrato}-${c.serie}`}>
                      <td>{c.contrato}</td>
                      <td>{nomes.data?.[c.contrato] || "—"}</td>
                      <td>{dbmTexto(c.rxOnu)}</td>
                      <td>{dbmTexto(c.rxOlt)}</td>
                      <td>{c.serie || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {p.clientes.length > 60 ? <p className="muted">Nomes mostrados só para os 60 primeiros; os contratos de todos estão em "Copiar contratos".</p> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

const LIMITES = [-25, -26, -27, -28, -30] as const;
function PainelSinal() {
  const [dbm, setDbm] = useState<number>(-27);
  const [aberta, setAberta] = useState<string | null>(null);
  const q = useSinalCritico(dbm, true);
  if (q.isPending) return <Carregando texto="Lendo o sinal de todos os clientes (a primeira leitura leva cerca de 20 segundos)…" />;
  if (q.isError) return <Falha erro={q.error} refazer={() => void q.refetch()} />;
  const d = q.data;
  if (!d.configurada) return <EmptyState icon={ShieldAlert} tone="warn" title="OLT Cloud ainda não configurada">O servidor do Chat precisa das credenciais da OLT Cloud.</EmptyState>;
  const pons = d.pons ?? [];
  return (
    <section className="rede-analise" aria-label="Sinal crítico">
      <div className="rede-analise-topo">
        <label>
          Sinal da ONU pior que{" "}
          <select value={dbm} onChange={(e) => setDbm(Number(e.target.value))} aria-label="Limite de sinal em dBm">
            {LIMITES.map((l) => <option key={l} value={l}>{String(l).replace(".", ",")} dBm</option>)}
          </select>
        </label>
        <span className="muted">
          {d.totalClientes ?? 0} cliente{d.totalClientes === 1 ? "" : "s"} em {d.totalPons ?? 0} PON{d.totalPons === 1 ? "" : "s"}
          {d.atualizadoEm ? ` · lido às ${horaCurta(d.atualizadoEm)}` : ""}
        </span>
        <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => void q.refetch()}>
          <RefreshCw size={15} className={clsx(q.isFetching && "girando")} /> Atualizar
        </Button>
      </div>
      <p className="muted rede-nota">Só clientes online e com contrato. Útil para agendar visita preventiva: PONs com muita gente fraca costumam ter problema em fibra, conector ou splitter.</p>
      {!pons.length ? (
        <EmptyState icon={Activity} tone="ok" title="Nenhum cliente com sinal crítico">Com esse limite, não há ninguém fraco agora.</EmptyState>
      ) : (
        <div className="panel">
          <table className="rede-tabela">
            <thead><tr><th>OLT · slot/PON</th><th>Sinal crítico</th><th>Em atenção</th></tr></thead>
            <tbody>
              {pons.map((p) => {
                const chave = `${p.olt}|${p.slot}|${p.pon}`;
                return <LinhaPonSinal key={chave} p={p} aberta={aberta === chave} alternar={() => setAberta(aberta === chave ? null : chave)} />;
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PainelInstaveis() {
  const q = useInstaveis(true);
  const lista = q.data?.clientes ?? [];
  const nomes = useNomesClientes(lista.slice(0, 60).map((c) => c.contrato));
  if (q.isPending) return <Carregando texto="Conferindo o histórico de quedas dos clientes (pode levar até 30 segundos)…" />;
  if (q.isError) return <Falha erro={q.error} refazer={() => void q.refetch()} />;
  const d = q.data;
  if (!d.configurada) return <EmptyState icon={ShieldAlert} tone="warn" title="OLT Cloud ainda não configurada">O servidor do Chat precisa das credenciais da OLT Cloud.</EmptyState>;
  return (
    <section className="rede-analise" aria-label="Quedas repetidas">
      <div className="rede-analise-topo">
        <span className="muted">
          {lista.length} cliente{lista.length === 1 ? "" : "s"} com {d.minimoQuedas ?? 3} quedas ou mais nas últimas 24 h
          {d.atualizadoEm ? ` · lido às ${horaCurta(d.atualizadoEm)}` : ""}
        </span>
        <CopiarContratos contratos={lista.map((c) => c.contrato)} />
        <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => void q.refetch()}>
          <RefreshCw size={15} className={clsx(q.isFetching && "girando")} /> Atualizar
        </Button>
      </div>
      <p className="muted rede-nota">Conexão que "pisca": cai e volta várias vezes. Costuma ser conector sujo, fibra dobrada ou energia instável na casa do cliente. {d.verificados ? `${d.verificados} clientes com queda recente foram conferidos.` : ""}</p>
      {!lista.length ? (
        <EmptyState icon={Activity} tone="ok" title="Nenhum cliente instável">Ninguém caiu repetidas vezes nas últimas 24 horas.</EmptyState>
      ) : (
        <div className="panel">
          <table className="rede-tabela">
            <thead><tr><th>Contrato</th><th>Cliente</th><th>Quedas 24 h</th><th>Quedas 7 dias</th><th>Agora</th><th>OLT · slot/PON</th><th>Última queda</th></tr></thead>
            <tbody>
              {lista.map((c: ClienteInstavel) => (
                <tr key={`${c.contrato}-${c.serie}`}>
                  <td>{c.contrato}</td>
                  <td>{nomes.data?.[c.contrato] || "—"}</td>
                  <td><Badge tone={c.quedas24h >= 8 ? "crit" : "warn"}>{c.quedas24h}</Badge></td>
                  <td>{c.quedas7d}</td>
                  <td>{c.status || "—"}</td>
                  <td>{local(c.olt, c.slot, c.pon)}</td>
                  <td>{c.ultimas[0] ? dataHora(c.ultimas[0]) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PainelPons() {
  const [janela, setJanela] = useState<"semana" | "mes">("semana");
  const q = useRankingPons(true);
  if (q.isPending) return <Carregando texto="Somando as quedas de cada PON no último mês (pode levar até 30 segundos)…" />;
  if (q.isError) return <Falha erro={q.error} refazer={() => void q.refetch()} />;
  const d = q.data;
  if (!d.configurada) return <EmptyState icon={ShieldAlert} tone="warn" title="OLT Cloud ainda não configurada">O servidor do Chat precisa das credenciais da OLT Cloud.</EmptyState>;
  const lista: PonRanking[] = (janela === "semana" ? d.semana : d.mes) ?? [];
  return (
    <section className="rede-analise" aria-label="PONs problemáticas">
      <div className="rede-analise-topo">
        <Segmented
          label="Período"
          value={janela}
          options={[["semana", "Últimos 7 dias"], ["mes", "Últimos 30 dias"]] as const}
          onChange={setJanela}
        />
        <span className="muted">{d.atualizadoEm ? `Lido às ${horaCurta(d.atualizadoEm)}` : ""}</span>
        <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => void q.refetch()}>
          <RefreshCw size={15} className={clsx(q.isFetching && "girando")} /> Atualizar
        </Button>
      </div>
      <p className="muted rede-nota">
        Quedas de PON por período (alertas da mesma PON no mesmo evento contam uma vez). Para decidir onde mexer em fibra, conector ou splitter.
        {d.cobreDesde ? ` Histórico lido desde ${new Date(d.cobreDesde).toLocaleDateString("pt-BR")}.` : ""}
      </p>
      {!lista.length ? (
        <EmptyState icon={Activity} tone="ok" title="Nenhuma queda de PON no período">Não houve queda de PON nesse período.</EmptyState>
      ) : (
        <div className="panel">
          <table className="rede-tabela">
            <thead><tr><th>#</th><th>OLT · slot/PON</th><th>Quedas</th><th>Tempo fora do ar</th><th>Máx. de clientes afetados</th><th>Última queda</th></tr></thead>
            <tbody>
              {lista.map((p, n) => {
                const r = janela === "semana" ? p.semana : p.mes;
                return (
                  <tr key={p.chave}>
                    <td>{n + 1}</td>
                    <td>{p.olt}{p.slotPon ? ` · ${p.slotPon}` : p.pon ? ` · PON ${p.pon}` : ""}</td>
                    <td><Badge tone={r.quedas >= 10 ? "crit" : r.quedas >= 4 ? "warn" : "neutral"}>{r.quedas}</Badge></td>
                    <td>{duracaoTexto(r.minutos)}</td>
                    <td>{r.maxAfetados}</td>
                    <td>{dataHora(p.ultima)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PainelAutorizar() {
  const q = useNaoAutorizadas(true);
  if (q.isPending) return <Carregando texto="Consultando as OLTs…" />;
  if (q.isError) return <Falha erro={q.error} refazer={() => void q.refetch()} />;
  const d = q.data;
  if (!d.configurada) return <EmptyState icon={ShieldAlert} tone="warn" title="OLT Cloud ainda não configurada">O servidor do Chat precisa das credenciais da OLT Cloud.</EmptyState>;
  const lista = d.itens ?? [];
  return (
    <section className="rede-analise" aria-label="ONUs aguardando autorização">
      <div className="rede-analise-topo">
        <span className="muted">
          {lista.length} ONU{lista.length === 1 ? "" : "s"} aguardando autorização
          {d.atualizadoEm ? ` · lido às ${horaCurta(d.atualizadoEm)}` : ""}
        </span>
        <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => void q.refetch()}>
          <RefreshCw size={15} className={clsx(q.isFetching && "girando")} /> Atualizar
        </Button>
      </div>
      <p className="muted rede-nota">Equipamentos que o técnico já ligou na fibra e que ainda precisam ser liberados na OLT. Você recebe um aviso quando aparece uma nova. Esta tela só mostra: a autorização é feita na OLT Cloud.</p>
      {!lista.length ? (
        <EmptyState icon={Activity} tone="ok" title="Nenhuma ONU esperando">Todas as ONUs ligadas já foram autorizadas.</EmptyState>
      ) : (
        <div className="panel">
          <table className="rede-tabela">
            <thead><tr><th>OLT · slot/PON</th><th>Série da ONU</th><th>Modelo</th><th>Aguardando desde</th></tr></thead>
            <tbody>
              {lista.map((o) => (
                <tr key={o.serie}>
                  <td>{local(o.olt, o.slot, o.pon)}</td>
                  <td>{o.serie}</td>
                  <td>{o.modelo || "—"}</td>
                  <td>{o.vistoDesde ? dataHora(o.vistoDesde) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Analises({ aba }: { aba: Exclude<AbaRede, "incidentes"> }) {
  return aba === "sinal" ? <PainelSinal /> : aba === "instaveis" ? <PainelInstaveis /> : aba === "autorizar" ? <PainelAutorizar /> : <PainelPons />;
}
