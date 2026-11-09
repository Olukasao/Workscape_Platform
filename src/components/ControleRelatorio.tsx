import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Send } from "lucide-react";
import { api, errorMessage } from "../services/api";

// Relatório semanal da gestão: o Assistente Acessa manda no chat um resumo da semana (nota média, chamados atrasados,
// massivos e contratações). Quem recebe é a mesma lista do briefing diário (Admin > IA).
interface Config { ativo: boolean; dia: number; hora: string; destinatarios: string[] }
const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));

export default function ControleRelatorio() {
  const cliente = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "relatorio"], queryFn: async () => (await api.get<Config>("/admin/relatorio")).data });
  const [ativo, setAtivo] = useState(false);
  const [dia, setDia] = useState(1);
  const [hora, setHora] = useState("08:30");
  const [salvo, setSalvo] = useState("");
  useEffect(() => { if (q.data) { setAtivo(q.data.ativo); setDia(q.data.dia); setHora(q.data.hora); } }, [q.data]);
  const salvar = useMutation({
    mutationFn: async () => (await api.put<Config>("/admin/relatorio", { ativo, dia, hora })).data,
    onSuccess: () => { setSalvo("Salvo."); void cliente.invalidateQueries({ queryKey: ["admin", "relatorio"] }); },
    onError: () => setSalvo(""),
  });
  const testar = useMutation({ mutationFn: async () => (await api.post<{ enviados: number; texto: string }>("/admin/relatorio/testar")).data });
  if (q.isLoading) return <p>Carregando…</p>;
  if (q.error) return <p role="alert">{msgDe(q.error)}</p>;
  const quem = q.data?.destinatarios ?? [];
  return (
    <section className="relatorio" aria-labelledby="relatorio-titulo" style={{ display: "grid", gap: 16, maxWidth: 680 }}>
      <header>
        <h2 id="relatorio-titulo" style={{ margin: 0 }}>Relatório semanal</h2>
        <p style={{ margin: "4px 0 0", opacity: 0.75 }}>Toda semana, o Assistente Acessa manda no chat um resumo da semana anterior: nota média dos clientes, chamados sem atendimento, massivos e contratações pelo site.</p>
      </header>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={ativo} onChange={(e) => { setAtivo(e.target.checked); setSalvo(""); }} /> Enviar o relatório toda semana
      </label>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4 }}><span>Dia</span>
          <select value={dia} onChange={(e) => { setDia(Number(e.target.value)); setSalvo(""); }}>{DIAS.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
        </label>
        <label style={{ display: "grid", gap: 4 }}><span>Hora</span>
          <input type="time" value={hora} onChange={(e) => { setHora(e.target.value); setSalvo(""); }} />
        </label>
      </div>
      <p style={{ margin: 0 }}>
        {quem.length ? <>Quem recebe: <b>{quem.join(", ")}</b>.</> : "Ninguém está na lista de destinatários."} A lista é a mesma do briefing diário, em Admin &gt; IA.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</button>
        <button type="button" disabled={testar.isPending} onClick={() => testar.mutate()}><Send size={14} aria-hidden="true" /> {testar.isPending ? "Gerando…" : "Enviar uma amostra para mim"}</button>
        {salvo ? <span role="status">{salvo}</span> : null}
      </div>
      {salvar.isError ? <p role="alert">{msgDe(salvar.error)}</p> : null}
      {testar.isError ? <p role="alert">{msgDe(testar.error)}</p> : null}
      {testar.data ? (
        <div>
          <p style={{ margin: "0 0 6px" }}>{testar.data.enviados ? "Amostra enviada para o seu chat. É assim que chega:" : "Não deu para entregar no chat, mas é assim que fica:"}</p>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, padding: 14, borderRadius: 10, background: "rgba(143,178,255,.08)", border: "1px solid rgba(143,178,255,.16)", font: "inherit", lineHeight: 1.55 }}>{testar.data.texto}</pre>
        </div>
      ) : null}
    </section>
  );
}
