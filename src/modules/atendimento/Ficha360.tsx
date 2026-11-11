import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, MapPin, Receipt, Star, Wifi, WifiOff } from "lucide-react";
import { api } from "../../services/api";
import { dataCurta, type ClienteLigacao, type RespostaLigacao } from "../../services/clienteLigacao";

const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** GPON: acima de -25 dBm está folgado; até -28 pede atenção; abaixo disso a ONU costuma cair. */
const qualidade = (dbm: number) => (dbm >= -25 ? "boa" : dbm >= -28 ? "media" : "ruim");
const encerrado = (s: string) => /encerr|finaliz|conclu|cancel/i.test(s);

/** Ficha 360 do cliente ao lado da conversa: cadastro, financeiro, conexão, histórico de chamados e última avaliação. */
export default function Ficha360({ contrato }: { contrato: string }) {
  const q = useQuery({
    queryKey: ["atendimento", "ficha", contrato],
    queryFn: async () => (await api.get<RespostaLigacao>(`/clientes/ligacao/contrato/${encodeURIComponent(contrato)}`)).data,
    staleTime: 30_000,
    retry: 1,
  });
  if (q.isLoading) return <aside className="atd-ficha"><p className="muted atd-ficha-msg">Carregando ficha…</p></aside>;
  const c: ClienteLigacao | undefined = q.data?.cliente;
  if (q.isError || !c) return <aside className="atd-ficha"><p className="muted atd-ficha-msg">Não foi possível carregar a ficha deste cliente agora.</p></aside>;
  const f = c.financeiro;
  const cx = c.conexao;
  return (
    <aside className="atd-ficha" aria-label="Ficha do cliente">
      <header className="atd-ficha-cab">
        <span className="atd-avatar" aria-hidden="true">{(c.nome || "?").trim().charAt(0).toUpperCase()}</span>
        <div>
          <b>{c.nome || "Cliente"}</b>
          <small>Contrato {c.contrato}{c.clienteDesde ? ` · desde ${dataCurta(c.clienteDesde)}` : ""}</small>
        </div>
      </header>
      <div className="atd-ficha-chips">
        {c.situacao ? <span className={`atd-chip ${/ativ/i.test(c.situacao) ? "ok" : "alerta"}`}>{c.situacao}</span> : null}
        {c.plano ? <span className="atd-chip">{c.plano}</span> : null}
        {(c.etiquetas ?? []).map((e) => <span key={e} className="atd-chip">{e}</span>)}
      </div>

      <section className="atd-ficha-bloco">
        <h4><MapPin size={13} /> Endereço</h4>
        <p>{c.endereco?.linha ? [c.endereco.linha, c.endereco.bairro, c.endereco.cidade && `${c.endereco.cidade}${c.endereco.uf ? `/${c.endereco.uf}` : ""}`].filter(Boolean).join(" · ") : c.cidade || "—"}</p>
        {c.pop ? <small className="muted">POP {c.pop}</small> : null}
      </section>

      {f ? (
        <section className="atd-ficha-bloco">
          <h4><Receipt size={13} /> Financeiro</h4>
          {f.isento ? <p>Isento de cobrança</p> : (
            <>
              <p className={f.emAberto > 0 ? "atd-alerta" : ""}>{f.emAberto > 0 ? `${moeda(f.emAberto)} em aberto` : "Sem valores em aberto"}{f.titulosAReceber ? ` · ${f.titulosAReceber} título(s)` : ""}</p>
              <small className="muted">{f.vencimentoDia ? `Vence todo dia ${f.vencimentoDia}` : ""}{f.promessasMes ? ` · ${f.promessasMes} promessa(s) no mês` : ""}</small>
            </>
          )}
        </section>
      ) : null}

      {cx ? (
        <section className="atd-ficha-bloco">
          <h4>{cx.online ? <Wifi size={13} /> : <WifiOff size={13} />} Conexão</h4>
          <p className={cx.online ? "atd-ok" : "atd-alerta"}>{cx.online ? "Online" : "Offline"}{cx.modelo ? ` · ${cx.modelo}` : ""}</p>
          {cx.sinalOnuDbm !== null ? <small className={`atd-sinal ${qualidade(cx.sinalOnuDbm)}`}>Sinal da ONU {cx.sinalOnuDbm} dBm{cx.sinalOltDbm !== null ? ` · OLT ${cx.sinalOltDbm} dBm` : ""}</small> : null}
          {!cx.online && cx.ultimaQueda ? <small className="muted">Última queda: {dataCurta(cx.ultimaQueda)}</small> : null}
        </section>
      ) : null}

      {c.historico ? (
        <section className="atd-ficha-bloco">
          <h4><CalendarClock size={13} /> Histórico</h4>
          <p>{c.historico.ultimos30Dias} chamado(s) em 30 dias · {c.historico.abertos} aberto(s)</p>
          {c.historico.visitaAgendada ? <small className="atd-ok">Visita: {dataCurta(c.historico.visitaAgendada.data)} ({c.historico.visitaAgendada.tipo})</small> : null}
          {c.historico.assuntoMaisComum ? <small className="muted">Mais comum: {c.historico.assuntoMaisComum.tipo} ({c.historico.assuntoMaisComum.vezes}x)</small> : null}
        </section>
      ) : null}

      {c.chamados?.length ? (
        <section className="atd-ficha-bloco">
          <h4>Últimos chamados</h4>
          <ul className="atd-ficha-lista">
            {c.chamados.map((ch) => (
              <li key={ch.protocolo}>
                <span>{ch.tipo || "Chamado"}{ch.assunto ? ` · ${ch.assunto.slice(0, 60)}` : ""}</span>
                <small className={encerrado(ch.status) ? "muted" : "atd-alerta"}>{ch.status} · {dataCurta(ch.abertoEm)}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {c.ultimaAvaliacao ? (
        <section className="atd-ficha-bloco">
          <h4><Star size={13} /> Última avaliação</h4>
          <p>Nota {c.ultimaAvaliacao.nota}/5{c.ultimaAvaliacao.tecnico ? ` · ${c.ultimaAvaliacao.tecnico}` : ""}</p>
          {c.ultimaAvaliacao.comentario ? <small className="muted">“{c.ultimaAvaliacao.comentario}”</small> : null}
        </section>
      ) : c.mediaAvaliacoes ? null : null}
      {f && f.emAberto > 0 && !f.isento ? <p className="atd-ficha-aviso"><AlertTriangle size={13} /> Cliente com valor em aberto: confira antes de prometer prazo.</p> : null}
    </aside>
  );
}
