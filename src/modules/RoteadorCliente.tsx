import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2, Router as RouterIcon, Search, Wifi } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge, EmptyState, PageHeader, type Tone } from "../components/ui/primitives";
import { api, errorMessage } from "../services/api";
import "../styles/roteador-cliente.css";

// Roteador do cliente: procura por nome, CPF ou contrato e, ao clicar, abre o painel do roteador JÁ LOGADO numa janela.
// Quem entra no roteador é o servidor; a senha de administrador nunca passa por aqui.
interface Cliente { contrato: string; nome: string; documento: string; situacao: string; local: string; plano: string }
interface Busca { busca: "cpf" | "contrato" | "nome"; clientes: Cliente[]; total: number }
type Abertura = { ok: true; url: string; contrato: string; vendor: string | null; model: string | null } | { ok: false; code: string; message: string; vendor: string | null; model: string | null };

const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));
const TOM: Record<string, Tone> = { ativo: "ok", suspenso: "warn", cancelado: "crit", inativo: "neutral" };

export default function RoteadorCliente() {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState<string | null>(null); // contrato em abertura
  const [resultado, setResultado] = useState<Record<string, { tom: "ok" | "erro"; texto: string }>>({});
  const noPc = !!window.desktop?.roteadorAbrirPainel;

  const buscar = useMutation({
    mutationFn: async (q: string) => (await api.get<Busca>("/roteador/clientes", { params: { q } })).data,
    onMutate: () => setResultado({}),
  });

  const abrir = useMutation({
    mutationFn: async (c: Cliente) => {
      const { data } = await api.post<Abertura>("/roteador/painel", { contrato: c.contrato, nome: c.nome }, { timeout: 110_000 });
      if (!data.ok) throw Object.assign(new Error(data.message), { aviso: true });
      await window.desktop!.roteadorAbrirPainel!(data.url, `${c.nome || "Cliente"} · contrato ${c.contrato}`);
      return data;
    },
    onMutate: (c) => setAberto(c.contrato),
    onSuccess: (d, c) => setResultado((r) => ({ ...r, [c.contrato]: { tom: "ok", texto: `Painel aberto${d.vendor ? ` (${d.vendor}${d.model ? ` ${d.model}` : ""})` : ""}. Feche a janela para sair do roteador.` } })),
    onError: (e, c) => setResultado((r) => ({ ...r, [c.contrato]: { tom: "erro", texto: msgDe(e) } })),
    onSettled: () => setAberto(null),
  });

  const enviar = (e: FormEvent) => { e.preventDefault(); if (texto.trim()) buscar.mutate(texto.trim()); };
  const lista = buscar.data?.clientes ?? [];

  return (
    <div className="roteador-cliente">
      <PageHeader icon={RouterIcon} title="Roteador do cliente" description="Procure o cliente por nome, CPF ou contrato e clique para abrir o painel do roteador dele já logado." />
      {!noPc ? <p className="roteador-aviso" role="status">Esta função só funciona no aplicativo do Workspace para Windows.</p> : null}
      <form className="roteador-busca" onSubmit={enviar} role="search">
        <label className="sr-only" htmlFor="roteador-q">Nome, CPF ou contrato</label>
        <Search size={16} aria-hidden="true" />
        <input id="roteador-q" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nome, CPF ou contrato do cliente" autoFocus autoComplete="off" maxLength={80} />
        <Button type="submit" disabled={buscar.isPending || !texto.trim()}>{buscar.isPending ? <Loader2 size={15} className="girar" aria-hidden="true" /> : null}Buscar</Button>
      </form>
      {buscar.isError ? <p className="roteador-aviso erro" role="alert">{msgDe(buscar.error)}</p> : null}
      {buscar.isSuccess && !lista.length ? <EmptyState icon={Search} title="Nenhum cliente encontrado">Confira o nome, o CPF ou o número do contrato.</EmptyState> : null}
      {!buscar.data && !buscar.isPending && !buscar.isError ? <EmptyState icon={Wifi} title="Quem vai ser atendido?">O painel abre sozinho, sem pedir usuário e senha do roteador. Cada abertura fica registrada com o seu nome.</EmptyState> : null}
      {lista.length ? (
        <ul className="roteador-lista" aria-label="Clientes encontrados">
          {buscar.data!.total > lista.length ? <li className="roteador-mais">Mostrando {lista.length} de {buscar.data!.total}. Refine a busca.</li> : null}
          {lista.map((c) => {
            const r = resultado[c.contrato];
            const ocupado = aberto === c.contrato;
            return (
              <li key={c.contrato} className="roteador-item">
                <div className="roteador-quem">
                  <strong>{c.nome || "Sem nome"}</strong>
                  <span>Contrato {c.contrato}{c.documento ? ` · ${c.documento}` : ""}{c.plano ? ` · ${c.plano}` : ""}</span>
                  {c.local ? <span>{c.local}</span> : null}
                  {r ? <span className={`roteador-resultado ${r.tom}`} role={r.tom === "erro" ? "alert" : "status"}>{r.texto}</span> : null}
                </div>
                <Badge tone={TOM[c.situacao] ?? "neutral"}>{c.situacao}</Badge>
                <Button disabled={!noPc || abrir.isPending} onClick={() => abrir.mutate(c)} aria-label={`Abrir o roteador de ${c.nome || `contrato ${c.contrato}`}`}>
                  {ocupado ? <Loader2 size={15} className="girar" aria-hidden="true" /> : <RouterIcon size={15} aria-hidden="true" />}
                  {ocupado ? "Entrando…" : "Abrir roteador"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
