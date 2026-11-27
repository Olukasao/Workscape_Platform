import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, History, Search, X } from "lucide-react";
import { clients, errorMessage } from "../../services/api";
import { useServers } from "../../stores/workspace";
import { Button } from "../../components/ui/button";
import { EmptyState, Segmented, Skeleton } from "../../components/ui/primitives";

// Porta de agenda-tecnicos/api/public/historico.html.
type Item = {
  id: number;
  criadoEm: string;
  usuario?: { id?: number; nome?: string } | null;
  tipo: string;
  titulo?: string;
  descricao?: string;
  referencia?: string;
  tecnico?: string;
  mudancas?: { campo: string; de: string; para: string }[];
  falha?: boolean;
  /** Computador de onde a ação foi feita (ajuda a achar quem não foi identificado). */
  ip?: string | null;
};
type Resposta = { total: number; items: Item[]; usuarios: string[] };

const TIPOS = [
  ["", "Todas"],
  ["troca", "Troca de técnico"],
  ["reagendamento", "Reagendamentos"],
  ["bloqueio", "Bloqueios"],
  ["ausencia", "Ausências"],
  ["horario", "Horários"],
  ["mapa", "Mapa"],
  ["financeira", "Agenda Comercial"],
] as const;
const POR_PAGINA = 80;
const fmtDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtLongo = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "2-digit",
  month: "long",
});
const hoje = () => fmtDia.format(new Date());
const diaDe = (iso: string) => fmtDia.format(new Date(iso));
function inicio(dias: string) {
  if (dias === "") return "";
  const d = new Date(`${hoje()}T12:00:00`);
  d.setDate(d.getDate() - Number(dias));
  return d.toISOString().slice(0, 10);
}
function rotuloDia(dia: string) {
  const ontem = new Date(`${hoje()}T12:00:00`);
  ontem.setDate(ontem.getDate() - 1);
  const texto = fmtLongo.format(new Date(`${dia}T12:00:00`));
  if (dia === hoje()) return `Hoje · ${texto}`;
  if (dia === ontem.toISOString().slice(0, 10)) return `Ontem · ${texto}`;
  return texto;
}
const matiz = (nome = "") => {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
const iniciais = (nome = "") =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export default function HistoricoAcoes({ active }: { active: boolean }) {
  const configured = !!useServers((s) => s.config.agenda);
  const query = useQueryClient();
  const [dias, setDias] = useState<"0" | "7" | "30" | "">("7");
  const [tipo, setTipo] = useState("");
  const [usuario, setUsuario] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [visiveis, setVisiveis] = useState(POR_PAGINA);
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtiva(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => setVisiveis(POR_PAGINA), [dias, tipo, usuario, buscaAtiva]);
  const key = ["agenda", "historico", dias, usuario, buscaAtiva];
  const dados = useQuery({
    queryKey: key,
    enabled: configured && active,
    refetchInterval: 30000,
    queryFn: async () => {
      const params: Record<string, string> = { limite: "1000" };
      const de = inicio(dias);
      if (de) params.de = de;
      if (usuario) params.usuario = usuario;
      if (buscaAtiva) params.busca = buscaAtiva;
      return (await clients.agenda.get("/agenda-tecnicos/historico", { params })).data as Resposta;
    },
  });
  // Invalida quando volta para a aba: dados frescos sem esperar o intervalo.
  useEffect(() => {
    if (active) void query.invalidateQueries({ queryKey: ["agenda", "historico"] });
  }, [active, query]);

  const itens = dados.data?.items || [];
  const contagens = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of itens) c[i.tipo] = (c[i.tipo] || 0) + 1;
    return c;
  }, [itens]);
  const trocas = itens.filter((i) => i.tipo === "troca" && i.titulo !== "Rejeitou sugestão de rota");
  const falhas = trocas.filter((i) => i.falha).length;
  const ranking = Object.entries(
    itens.reduce<Record<string, number>>((acc, i) => {
      if (i.usuario?.nome) acc[i.usuario.nome] = (acc[i.usuario.nome] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const lista = tipo ? itens.filter((i) => i.tipo === tipo) : itens;
  const mostrados = lista.slice(0, visiveis);
  const grupos = mostrados.reduce<[string, Item[]][]>((acc, i) => {
    const dia = diaDe(i.criadoEm);
    const ultimo = acc.at(-1);
    if (ultimo && ultimo[0] === dia) ultimo[1].push(i);
    else acc.push([dia, [i]]);
    return acc;
  }, []);

  if (!configured)
    return (
      <div className="panel">
        <EmptyState icon={History} title="Conecte sua agenda">
          Configure a URL do serviço em Configurações.
        </EmptyState>
      </div>
    );

  return (
    <div className="historico">
      <div className="agenda-kpis is-four">
        <div className="agenda-kpi" data-tone="info">
          <span>Ações no período</span>
          <strong>{dados.data ? itens.length : "—"}</strong>
          <small>{{ "0": "Hoje", "7": "Últimos 7 dias", "30": "Últimos 30 dias", "": "Todo o histórico" }[dias]}</small>
        </div>
        <div className="agenda-kpi" data-tone="info">
          <span>Trocas de técnico</span>
          <strong>{dados.data ? trocas.length : "—"}</strong>
          <small>{falhas ? `${falhas} com falha no SGP` : "Sem falhas"}</small>
        </div>
        <div className="agenda-kpi" data-tone="warn">
          <span>Bloqueios e ausências</span>
          <strong>{dados.data ? (contagens.bloqueio || 0) + (contagens.ausencia || 0) : "—"}</strong>
        </div>
        <div className="agenda-kpi" data-tone="neutral">
          <span>Quem mais alterou</span>
          <strong>{ranking[0]?.[0]?.split(/\s+/)[0] || "–"}</strong>
          <small>
            {ranking[0]
              ? `${ranking[0][1]} ações · ${ranking.length} pessoa(s) no período`
              : "Ninguém identificado"}
          </small>
        </div>
      </div>
      <div className="historico-filtros panel">
        <Segmented
          label="Período"
          value={dias}
          options={[
            ["0", "Hoje"],
            ["7", "7 dias"],
            ["30", "30 dias"],
            ["", "Tudo"],
          ]}
          onChange={setDias}
        />
        <select aria-label="Usuário" value={usuario} onChange={(e) => setUsuario(e.target.value)}>
          <option value="">Todos os usuários</option>
          <option value="__sem__">Não identificado</option>
          {(dados.data?.usuarios || []).map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <label className="search-box">
          <Search size={15} />
          <input
            aria-label="Buscar no histórico"
            placeholder="Buscar por OS, técnico ou descrição…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca ? (
            <button type="button" className="search-clear" aria-label="Limpar busca" onClick={() => setBusca("")}>
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>
      <div className="historico-tipos" role="group" aria-label="Tipo de ação">
        {TIPOS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-tipo={id}
            aria-pressed={tipo === id}
            onClick={() => setTipo(id)}
          >
            {id ? <i aria-hidden="true" /> : null}
            {label}
            <b>{id ? contagens[id] || 0 : itens.length}</b>
          </button>
        ))}
      </div>
      {lista.length ? (
        <p className="historico-resumo" aria-live="polite">
          {lista.length} ação(ões)
          {lista.length > mostrados.length ? ` · mostrando ${mostrados.length}` : ""}
        </p>
      ) : null}
      {dados.isPending ? (
        <div className="historico-lista">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : dados.isError && !itens.length ? (
        <div className="panel">
          <EmptyState icon={History} tone="warn" title="Não foi possível carregar o histórico">
            {errorMessage(dados.error)} Verifique a conexão e tente novamente.
          </EmptyState>
        </div>
      ) : !mostrados.length ? (
        <div className="panel">
          <EmptyState icon={History} title="Nenhuma ação encontrada">
            Tente outro período, usuário ou busca.
          </EmptyState>
        </div>
      ) : (
        <div className="historico-lista">
          {grupos.map(([dia, lista]) => (
            <section key={dia} className="historico-dia">
              <h3>{rotuloDia(dia)}</h3>
              {lista.map((item) => {
                const nome = item.usuario?.nome;
                const acao = item.titulo
                  ? item.titulo.charAt(0).toLowerCase() + item.titulo.slice(1)
                  : "";
                return (
                  <article
                    key={item.id}
                    className={`historico-evento ${item.falha ? "is-falha" : ""}`}
                    data-tipo={item.tipo}
                  >
                    <time dateTime={item.criadoEm}>{fmtHora.format(new Date(item.criadoEm))}</time>
                    <span
                      className={`historico-avatar ${nome ? "" : "is-anon"}`}
                      style={{ "--h": matiz(nome) } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      {nome ? iniciais(nome) : "?"}
                    </span>
                    <div className="historico-corpo">
                      <div className="historico-linha">
                        <p>
                          {nome ? <b>{nome}</b> : <span className="muted" title="A sessão desse computador estava vencida ou a ação veio de uma página sem login.">Usuário não identificado{item.ip ? ` (computador ${item.ip.replace(/^::ffff:/, "")})` : ""}</span>} {acao}
                        </p>
                        {item.referencia ? <span className="historico-ref">{item.referencia}</span> : null}
                        {item.falha ? <span className="historico-falha">Falha no SGP</span> : null}
                      </div>
                      {item.descricao ? <p className="historico-desc">{item.descricao}</p> : null}
                      {item.mudancas?.length ? (
                        <div className="historico-mudancas">
                          {item.mudancas.map((m, i) => (
                            <span key={i}>
                              <span>{m.campo}</span>
                              <s>{m.de}</s>
                              <ArrowRight size={12} />
                              <strong>{m.para}</strong>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
          {lista.length > mostrados.length ? (
            <div className="historico-mais">
              <Button variant="outline" onClick={() => setVisiveis((v) => v + POR_PAGINA)}>
                Mostrar mais
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
