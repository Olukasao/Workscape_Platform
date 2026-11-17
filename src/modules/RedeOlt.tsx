import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronDown, Clipboard, EyeOff, Eye, MessageSquareText, RadioTower, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../components/ui/button";
import { Badge, EmptyState, PageHeader, Segmented, Skeleton, type Tone } from "../components/ui/primitives";
import Analises, { ABAS_REDE, type AbaRede } from "./rede/Analises";
import { errorMessage } from "../services/api";
import BotaoDestacar from "../components/BotaoDestacar";
import { textoParaAtendimento } from "./rede/explicacao";
import {
  carregarBairros,
  carregarClientesAfetados,
  haQuanto,
  tipoRotulo,
  TIPO_TOM,
  useIgnorados,
  useIncidentesFiltrados,
  usePanoramaRede,
  type IncidenteRede,
  type PanoramaRede,
} from "../services/redeOlt";

const TOM: Record<string, Tone> = TIPO_TOM;
const milhar = (n = 0) => n.toLocaleString("pt-BR");
const horaCurta = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function Local({ i }: { i: IncidenteRede }) {
  const partes = [i.olt, i.slotPon ? `Slot ${i.slotPon}` : "", i.pon ? `PON ${i.pon}` : "", i.cto].filter(Boolean);
  return <>{partes.join(" · ") || "Local não informado"}</>;
}

function Afetados({ i }: { i: IncidenteRede }) {
  const ativos = i.dispositivosAtivos, total = i.totalDispositivos;
  if (ativos === null) return <span className="rede-afetados-sem">Clientes afetados não informado</span>;
  const pct = total && total > 0 ? Math.min(100, Math.round((ativos / total) * 100)) : null;
  return (
    <div className="rede-afetados">
      <strong>{ativos}</strong>
      <span>{total ? `de ${total} clientes` : "clientes afetados"}</span>
      {i.semContrato ? <small className="muted" title="Equipamentos desta queda que não têm contrato cadastrado">+{i.semContrato} sem contrato</small> : null}
      {pct !== null ? (
        <div className="rede-barra" role="img" aria-label={`${pct}% dos clientes afetados`}>
          <i style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Onde estão os clientes afetados: por bairro e por estado. "Sem energia" aponta energia; "LOSS" aponta fibra. */
function PorBairro({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["rede", "bairros", id], queryFn: () => carregarBairros(id), staleTime: 60000, retry: 0 });
  if (q.isPending) return <div className="rede-bairros muted">Buscando o bairro dos clientes no SGP…</div>;
  if (q.isError || !q.data?.configurada || !q.data.total) return null;
  const d = q.data;
  const maior = Math.max(1, ...d.bairros.map((b) => b.clientes));
  return (
    <div className="rede-bairros" aria-label="Clientes afetados por bairro">
      <div className="rede-bairros-topo">
        <strong>Por bairro</strong>
        <span className="muted">
          {d.semEnergia} sem energia · {d.loss} em LOSS (fibra){d.semContrato ? ` · ${d.semContrato} sem contrato (fora da conta)` : ""}
        </span>
      </div>
      {d.leitura ? <p className="rede-bairros-leitura">{d.leitura}</p> : null}
      <ul>
        {d.bairros.map((b) => (
          <li key={`${b.bairro}|${b.cidade}`}>
            <span className="rede-bairro-nome" title={b.cidade || undefined}>{b.bairro}</span>
            <div className="rede-barra" role="img" aria-label={`${b.clientes} clientes (${b.pct}%)`}><i style={{ width: `${Math.round((b.clientes / maior) * 100)}%` }} /></div>
            <span className="rede-bairro-n">{b.clientes}</span>
            <span className="muted rede-bairro-estado">{b.semEnergia ? `${b.semEnergia} s/ energia` : ""}{b.semEnergia && b.loss ? " · " : ""}{b.loss ? `${b.loss} LOSS` : ""}</span>
          </li>
        ))}
      </ul>
      {d.consultados < d.total ? <p className="muted">Bairros de {d.consultados} dos {d.total} clientes.</p> : null}
    </div>
  );
}

function ClientesAfetados({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["rede", "clientes", id], queryFn: () => carregarClientesAfetados(id), staleTime: 20000, retry: 1 });
  const [copiado, setCopiado] = useState(false);
  if (q.isPending) return <div className="rede-clientes"><Skeleton className="h-20" /></div>;
  if (q.isError) return <div className="rede-clientes inline-error" role="alert">{errorMessage(q.error)}</div>;
  const lista = q.data.clientes;
  if (!lista.length) return <div className="rede-clientes muted">Nenhum cliente offline encontrado nesta PON agora.</div>;
  const contratos = lista.map((c) => c.contrato).filter(Boolean).join("\n");
  return (
    <div className="rede-clientes">
      <PorBairro id={id} />
      <div className="rede-clientes-topo">
        <span>
          {q.data.total} cliente{q.data.total === 1 ? "" : "s"} offline
          {q.data.total > q.data.exibidos ? ` (mostrando ${q.data.exibidos})` : ""}
        </span>
        {contratos ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await window.desktop?.copyText(contratos);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
          >
            <Clipboard size={14} /> {copiado ? "Contratos copiados" : "Copiar contratos"}
          </Button>
        ) : null}
      </div>
      <table className="rede-tabela">
        <thead>
          <tr><th>Contrato</th><th>Cliente</th><th>Série da ONU</th><th>Última queda</th></tr>
        </thead>
        <tbody>
          {lista.map((c, n) => (
            <tr key={`${c.contrato}-${c.serie}-${n}`}>
              <td>{c.contrato || "—"}</td>
              <td>{c.nome || "—"}</td>
              <td>{c.serie || "—"}</td>
              <td>{dataHora(c.ultimaQueda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Panorama({ p }: { p: PanoramaRede }) {
  const afetados = (p.semEnergia ?? 0) + (p.loss ?? 0);
  const pct = p.total ? ((afetados / p.total) * 100).toFixed(1).replace(".", ",") : "0";
  const maior = Math.max(1, ...(p.porOlt || []).map((o) => o.semEnergia + o.loss));
  return (
    <section className="panel rede-panorama" aria-labelledby="rede-panorama-titulo">
      <div className="rede-panorama-topo">
        <h2 id="rede-panorama-titulo">Panorama da rede agora</h2>
        <span className="muted">{milhar(afetados)} de {milhar(p.total)} clientes afetados ({pct}%)</span>
      </div>
      <div className="rede-resumo">
        <div data-tone="warn"><span>Sem energia</span><strong>{milhar(p.semEnergia)}</strong></div>
        <div data-tone="crit"><span>LOSS (sem sinal)</span><strong>{milhar(p.loss)}</strong></div>
        <div><span>Online</span><strong>{milhar(p.online)}</strong></div>
        <div><span>PONs com clientes afetados</span><strong>{milhar(p.totalPons)}</strong></div>
      </div>
      {p.porOlt?.length ? (
        <div className="rede-olts">
          <h3>Por OLT</h3>
          <ul>
            {p.porOlt.map((o) => (
              <li key={o.olt}>
                <span className="rede-olt-nome">{o.olt}</span>
                <div className="rede-olt-barra" role="img" aria-label={`${o.semEnergia} sem energia e ${o.loss} em LOSS`}>
                  <i className="energia" style={{ width: `${(o.semEnergia / maior) * 100}%` }} />
                  <i className="loss" style={{ width: `${(o.loss / maior) * 100}%` }} />
                </div>
                <span className="rede-olt-num">{milhar(o.semEnergia)} <small>energia</small> · {milhar(o.loss)} <small>LOSS</small></span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {p.pons?.length ? (
        <div className="rede-olts">
          <h3>PONs mais afetadas</h3>
          <ul className="rede-pons">
            {p.pons.slice(0, 8).map((x) => (
              <li key={`${x.olt}-${x.slot}-${x.pon}`}>
                <span>{x.olt} · Slot {x.slot} · PON {x.pon}</span>
                <span className="rede-olt-num">{milhar(x.semEnergia)} <small>energia</small> · {milhar(x.loss)} <small>LOSS</small></span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function RedeOlt() {
  const { q, visiveis, ignorados } = useIncidentesFiltrados();
  const { ignorar, restaurar } = useIgnorados();
  const [verIgnorados, setVerIgnorados] = useState(false);
  const [aba, setAba] = useState<AbaRede>("incidentes");
  const panorama = usePanoramaRede(!!q.data?.configurada && !q.data?.negado);
  const client = useQueryClient();
  const [aberto, setAberto] = useState<string | null>(null);
  const [explicando, setExplicando] = useState<string | null>(null);
  const [copiadoTexto, setCopiadoTexto] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const dados = q.data;
  const incidentes = verIgnorados ? ignorados : visiveis;
  const por = (tipo: string) => visiveis.filter((i) => i.tipo === tipo).length;
  const afetados = visiveis.reduce((s, i) => s + (i.dispositivosAtivos ?? 0), 0);

  return (
    <div className="page rede-page">
      <PageHeader
        icon={RadioTower}
        title="Rede · Incidentes"
        description="Quedas de PON, CTO e energia na OLT Cloud, em tempo real."
        meta={dados?.atualizadoEm ? <span className="heading-meta">Atualizado às {horaCurta(dados.atualizadoEm)}</span> : undefined}
        actions={
          <>
          <BotaoDestacar kind="rede" />
          {window.desktop ? (
            <Button
              variant="ghost"
              size="sm"
              title="Mostra um aviso de exemplo, como o que aparece quando cai uma PON"
              onClick={() => void window.desktop?.notify({ title: "Queda de PON (teste)", body: "OLT Exemplo · slot 1 · PON 3 — 24 de 40 clientes afetados", target: "/rede", kind: "system", context: "Rede · OLT", tone: "crit" })}
            >
              <ShieldAlert size={15} /> Testar aviso
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => void client.invalidateQueries({ queryKey: ["rede"] })}>
            <RefreshCw size={15} className={clsx(q.isFetching && "girando")} /> Atualizar
          </Button>
          </>
        }
      />
      <div className="rede-abas">
        <Segmented label="Análises da rede" value={aba} options={ABAS_REDE} onChange={setAba} />
      </div>
      {aba !== "incidentes" ? (
        <Analises aba={aba} />
      ) : q.isPending ? (
        <div className="rede-lista"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : dados?.negado ? (
        <EmptyState icon={ShieldAlert} tone="warn" title="Sem acesso à rede">
          Seu usuário não tem permissão para ver os incidentes de rede. Peça acesso ao administrador.
        </EmptyState>
      ) : q.isError ? (
        <EmptyState icon={ShieldAlert} tone="warn" title="Não foi possível consultar a rede" action={<Button onClick={() => void q.refetch()}>Tentar de novo</Button>}>
          {errorMessage(q.error)}
        </EmptyState>
      ) : !dados?.configurada ? (
        <EmptyState icon={ShieldAlert} tone="warn" title="OLT Cloud ainda não configurada">
          O servidor do Chat precisa das credenciais da OLT Cloud (OLTCLOUD_BASE_URL e OLTCLOUD_TOKEN, ou OLTCLOUD_USERNAME e OLTCLOUD_PASSWORD) para mostrar os incidentes.
        </EmptyState>
      ) : (
        <>
          {panorama.data?.configurada ? <Panorama p={panorama.data} /> : null}
          <h2 className="rede-secao">Alertas ativos da OLT Cloud</h2>
          <div className="rede-resumo" aria-label="Resumo">
            <div><span>Incidentes ativos</span><strong>{visiveis.length}</strong></div>
            <div data-tone="crit"><span>Quedas de PON</span><strong>{por("pon_loss") + por("pon_down")}</strong></div>
            <div data-tone="warn"><span>Quedas de CTO</span><strong>{por("cto_loss")}</strong></div>
            <div data-tone="info"><span>Sem energia</span><strong>{por("no_power") + por("cto_no_power") + por("pon_no_power")}</strong></div>
            <div><span>Clientes afetados</span><strong>{afetados}</strong></div>
          </div>
          {ignorados.length || verIgnorados ? (
            <div className="rede-ignorados-barra">
              <Button variant={verIgnorados ? "soft" : "outline"} size="sm" aria-pressed={verIgnorados} onClick={() => setVerIgnorados((v) => !v)}>
                {verIgnorados ? <Eye size={15} /> : <EyeOff size={15} />} Ignorados ({ignorados.length})
              </Button>
              {verIgnorados ? <span className="muted">Estes alertas não entram nos contadores nem no número do menu. Restaure para voltar a vê-los.</span> : null}
            </div>
          ) : null}
          {!incidentes.length ? (
            verIgnorados ? (
              <EmptyState icon={Eye} title="Nenhum alerta ignorado">
                Quando você ignorar um alerta, ele aparece aqui para poder ser restaurado.
              </EmptyState>
            ) : (
            <EmptyState icon={Activity} tone="ok" title="Nenhum alerta ativo">
              A OLT Cloud não tem alertas abertos neste momento. Esta tela atualiza sozinha e você recebe um aviso quando cair uma PON ou quando muitos clientes ficarem sem energia de uma vez.
            </EmptyState>
            )
          ) : (
            <ul className="rede-lista">
              {incidentes.map((i) => {
                const aberta = aberto === i.id;
                return (
                  <li key={i.id} className={clsx("panel rede-card", `rede-${TOM[i.tipo] || "info"}`)}>
                    <div className="rede-card-topo">
                      <Badge tone={TOM[i.tipo] || "neutral"} dot>{tipoRotulo(i.tipo)}</Badge>
                      <span className="rede-quando" title={dataHora(i.inicio)}>{haQuanto(i.inicio, agora)}</span>
                    </div>
                    <h2><Local i={i} /></h2>
                    {i.descricao ? <p className="rede-desc">{i.descricao}</p> : null}
                    <div className="rede-card-base">
                      <Afetados i={i} />
                      <div className="rede-card-acoes">
                      {i.pon ? (
                        <Button variant={aberta ? "soft" : "outline"} size="sm" aria-expanded={aberta} onClick={() => setAberto(aberta ? null : i.id)}>
                          <Users size={15} /> Clientes afetados <ChevronDown size={14} className={clsx("rede-seta", aberta && "aberta")} />
                        </Button>
                      ) : null}
                      <Button variant={explicando === i.id ? "soft" : "outline"} size="sm" aria-expanded={explicando === i.id} title="Texto simples para o atendimento repassar ao cliente" onClick={() => { setCopiadoTexto(false); setExplicando(explicando === i.id ? null : i.id); }}>
                        <MessageSquareText size={15} /> Explicar para o atendimento
                      </Button>
                      {verIgnorados ? (
                        <Button variant="outline" size="sm" onClick={() => restaurar(i.id)}>
                          <Eye size={15} /> Restaurar
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" title="Tira este alerta da lista e dos contadores" onClick={() => ignorar(i.id)}>
                          <EyeOff size={15} /> Ignorar
                        </Button>
                      )}
                      </div>
                    </div>
                    {explicando === i.id ? (
                      <div className="rede-explicacao">
                        <p>{textoParaAtendimento(i, { panorama: panorama.data, agora })}</p>
                        <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(textoParaAtendimento(i, { panorama: panorama.data, agora })).then(() => setCopiadoTexto(true)).catch(() => {}); }}>
                          <Clipboard size={14} /> {copiadoTexto ? "Texto copiado" : "Copiar texto"}
                        </Button>
                      </div>
                    ) : null}
                    {aberta ? <ClientesAfetados id={i.id} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
