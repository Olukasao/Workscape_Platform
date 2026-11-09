import { useState } from "react";
import { isAxiosError } from "axios";
import { Link2, LoaderCircle, UserRound } from "lucide-react";
import { dataCurta, useClienteLigacao, useVincularCliente } from "../services/clienteLigacao";
import { errorMessage } from "../services/api";

const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));
const estrelas = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

/** Linha curta para a faixa de chamada recebida: "Maria Silva · contrato 3005 · última nota 5". */
export function ResumoClienteLigacao({ numero, externo }: { numero: string; externo: boolean }) {
  const { data } = useClienteLigacao(numero, externo);
  if (!data?.encontrado || !data.cliente) return null;
  const c = data.cliente;
  const partes = [c.nome || `Contrato ${c.contrato}`, c.chamados?.length ? `${c.totalChamados} chamado${c.totalChamados === 1 ? "" : "s"}` : "", c.ultimaAvaliacao ? `última nota ${c.ultimaAvaliacao.nota}` : ""].filter(Boolean);
  return <small className="cliente-resumo">{partes.join(" · ")}</small>;
}

/** Cartão completo na ligação em andamento: quem é, últimos chamados e a última avaliação. */
export default function ClienteDaLigacao({ numero, externo, grande = false }: { numero: string; externo: boolean; grande?: boolean }) {
  // DDD só entra se a pessoa digitar (número discado sem DDD); o app nunca presume.
  const [ddd, setDdd] = useState("");
  const [dddDigitado, setDddDigitado] = useState("");
  const { data, isLoading, isError, refetch } = useClienteLigacao(numero, externo, ddd);
  const vincular = useVincularCliente(numero, ddd);
  const [contrato, setContrato] = useState("");
  if (!externo) return null;
  if (isLoading) return <div className={`cliente-ligacao${grande ? " grande" : ""}`} aria-busy="true"><LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Procurando o cliente no SGP…</div>;
  if (isError) return <div className={`cliente-ligacao${grande ? " grande" : ""}`}><p>Não foi possível consultar o SGP agora.</p><button type="button" onClick={() => void refetch()}>Tentar de novo</button></div>;
  if (!data?.valido) return null;

  if (data.semDdd) {
    return (
      <form className={`cliente-ligacao cliente-vazio${grande ? " grande" : ""}`} onSubmit={(e) => { e.preventDefault(); if (/^[1-9]\d$/.test(dddDigitado)) setDdd(dddDigitado); }}>
        <p><UserRound size={14} aria-hidden="true" /> Este número veio sem DDD, então não dá para achar o cliente no SGP.</p>
        <div className="cliente-vincular">
          <input inputMode="numeric" autoComplete="off" maxLength={2} aria-label="DDD do número" placeholder="DDD" style={{ maxWidth: 70 }} value={dddDigitado} onChange={(e) => setDddDigitado(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          <button type="submit" disabled={!/^[1-9]\d$/.test(dddDigitado)}>Buscar</button>
        </div>
        <small>Digite o DDD do cliente para buscar.</small>
      </form>
    );
  }

  if (!data.encontrado || !data.cliente) {
    return (
      <form className={`cliente-ligacao cliente-vazio${grande ? " grande" : ""}`} onSubmit={(e) => { e.preventDefault(); if (contrato.trim()) vincular.mutate(contrato.trim()); }}>
        <p><UserRound size={14} aria-hidden="true" /> Número não vinculado a um cliente.</p>
        <div className="cliente-vincular">
          <input inputMode="numeric" autoComplete="off" aria-label="Contrato do cliente" placeholder="Nº do contrato" value={contrato} onChange={(e) => setContrato(e.target.value.replace(/\D/g, ""))} />
          <button type="submit" disabled={!contrato.trim() || vincular.isPending}><Link2 size={14} aria-hidden="true" /> Vincular</button>
        </div>
        {vincular.isError ? <p role="alert" className="cliente-erro">{msgDe(vincular.error)}</p> : <small>Da próxima vez que esse número ligar, o cliente aparece sozinho.</small>}
      </form>
    );
  }

  const c = data.cliente;
  return (
    <section className={`cliente-ligacao${grande ? " grande" : ""}`} aria-label="Cliente no SGP">
      <header>
        <strong>{c.nome || `Contrato ${c.contrato}`}</strong>
        <small>Contrato {c.contrato}{c.contratos && c.contratos.length > 1 ? ` (e mais ${c.contratos.length - 1}: ${c.contratos.slice(1).join(", ")})` : ""}{c.plano ? ` · ${c.plano}` : ""}{c.situacao ? ` · ${c.situacao}` : ""}</small>
      </header>
      {data.outrosContratos ? <p className="cliente-erro">Este número aparece em {data.outrosContratos.length} contratos. Confirme com o cliente.</p> : null}
      {c.ultimaAvaliacao === undefined ? null : c.ultimaAvaliacao ? (
        <p className={`cliente-nota nota-${c.ultimaAvaliacao.nota >= 4 ? "boa" : c.ultimaAvaliacao.nota === 3 ? "media" : "ruim"}`}>
          <span aria-label={`Nota ${c.ultimaAvaliacao.nota} de 5`}>{estrelas(c.ultimaAvaliacao.nota)}</span> última avaliação, {dataCurta(c.ultimaAvaliacao.respondidoEm)}
          {c.ultimaAvaliacao.comentario ? <q>{c.ultimaAvaliacao.comentario}</q> : null}
        </p>
      ) : <p className="cliente-nota">Ainda não avaliou o atendimento.</p>}
      {c.chamados === null ? <p className="cliente-erro">Chamados indisponíveis agora.</p> : c.chamados.length === 0 ? <p>Nenhum chamado registrado.</p> : (
        <ul aria-label="Últimos chamados">
          {c.chamados.map((x) => (
            <li key={x.protocolo || x.abertoEm + x.tipo}>
              <span><b>{x.tipo || "Chamado"}</b> · {dataCurta(x.abertoEm)}</span>
              <em className={/encerr|finaliz|conclu/i.test(x.status) ? "fechado" : "aberto"}>{x.status}</em>
              {x.assunto ? <small>{x.assunto}</small> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
