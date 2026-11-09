import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { api, errorMessage } from "../services/api";

// Painel de saúde: o que está respondendo agora e quanto demora. Atualiza sozinho a cada 30 segundos.
interface Item { id: string; nome: string; estado: "ok" | "lento" | "falha"; ms: number; detalhe: string }
interface Saude { verificadoEm: string; geral: "ok" | "lento" | "falha"; falhas: number; lentos: number; ambienteTeste: boolean; itens: Item[] }
const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));
const ROTULO = { ok: "Respondendo", lento: "Lento", falha: "Fora do ar" } as const;

interface Indice { total: number; atualizadoEm: string | null; atualizando: boolean; erro: string | null }

/** Índice de telefones: só os números dos clientes, para achar o DDD quando a ligação é discada sem DDD. Atualiza sozinho toda madrugada. */
function IndiceTelefones() {
  const cliente = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "indice-telefones"],
    queryFn: async () => (await api.get<Indice>("/admin/telefones/indice")).data,
    refetchInterval: (query) => (query.state.data?.atualizando ? 4000 : 60_000),
  });
  const atualizar = useMutation({
    mutationFn: async () => (await api.post("/admin/telefones/indice/atualizar")).data,
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ["admin", "indice-telefones"] }),
  });
  const d = q.data;
  return (
    <div className="saude-indice">
      <div>
        <strong>Índice de telefones</strong>
        <small>{d ? `${d.total.toLocaleString("pt-BR")} números${d.atualizadoEm ? `, atualizado em ${new Date(d.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ", ainda não atualizado"}. Guarda só os números (sem nomes) para descobrir o DDD de ligações discadas sem DDD.` : "Carregando…"}</small>
        {d?.erro ? <small role="alert" className="form-error">{d.erro}</small> : null}
      </div>
      <button type="button" className="saude-atualizar" disabled={!!d?.atualizando || atualizar.isPending} onClick={() => atualizar.mutate()}>
        {d?.atualizando ? <><LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> Atualizando…</> : <><RefreshCw size={15} aria-hidden="true" /> Atualizar agora</>}
      </button>
    </div>
  );
}

export default function ControleSaude() {
  const q = useQuery({ queryKey: ["admin", "saude"], queryFn: async () => (await api.get<Saude>("/admin/saude")).data, refetchInterval: 30_000 });
  const d = q.data;
  const resumo = !d ? "" : d.geral === "ok" ? "Tudo respondendo." : d.falhas ? `${d.falhas} ${d.falhas === 1 ? "serviço fora do ar" : "serviços fora do ar"}${d.lentos ? ` e ${d.lentos} lento${d.lentos === 1 ? "" : "s"}` : ""}.` : `${d.lentos} ${d.lentos === 1 ? "serviço lento" : "serviços lentos"}.`;
  return (
    <section className="saude" aria-labelledby="saude-titulo">
      <header className="saude-topo">
        <div>
          <h2 id="saude-titulo">Saúde do Workspace</h2>
          <p className={`saude-resumo ${d?.geral ?? ""}`} role="status">{q.isLoading ? "Verificando…" : resumo}</p>
          {d?.ambienteTeste ? <p className="saude-aviso">Este é o ambiente de testes, não a produção.</p> : null}
        </div>
        <button type="button" className="saude-atualizar" disabled={q.isFetching} onClick={() => void q.refetch()}>
          {q.isFetching ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />} Verificar agora
        </button>
      </header>
      {q.error ? <p role="alert" className="form-error">{msgDe(q.error)}</p> : null}
      <ul className="saude-lista">
        {(d?.itens ?? []).map((i) => (
          <li key={i.id} className={`saude-item ${i.estado}`}>
            <span className="saude-ponto" aria-hidden="true" />
            <div>
              <strong>{i.nome}</strong>
              <small>{i.detalhe || ROTULO[i.estado]}</small>
            </div>
            <span className="saude-estado">{ROTULO[i.estado]}<small>{i.ms} ms</small></span>
          </li>
        ))}
      </ul>
      <IndiceTelefones />
      {d ? <p className="muted saude-rodape">Última verificação às {new Date(d.verificadoEm).toLocaleTimeString("pt-BR")}. Lento quer dizer que respondeu, mas acima do esperado.</p> : null}
    </section>
  );
}
