import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PhoneEvent } from "../../../electron/phone";
import { api } from "../../services/api";
import { socket } from "../../services/socket";
import { buscarTranscricoes, notaDaTranscricao } from "../../services/transcricaoLigacao";
import type { RespostaLigacao } from "../../services/clienteLigacao";
import { usePhone } from "../../stores/phone";
import { chamar } from "./chamar";
import { final8, mesmoNumero } from "./numeros";


interface Conversa { id: number; contractId: string; ticketMetadata?: { customer?: { name?: string; phone?: string } } | null }

/**
 * Integração do Atendimento com o Workscape Phone:
 * - telefones do cliente da conversa aberta (cadastro do ticket + ficha do SGP);
 * - ligação em andamento com esse cliente;
 * - nota interna na conversa quando a ligação termina;
 * - atendente fica "invisível" na fila enquanto está em ligação e volta ao que era depois.
 */
export function useTelefoneAtendimento(atual: Conversa | null, statusAtual: "AVAILABLE" | "INVISIBLE" | null) {
  const snapshot = usePhone((s) => s.snapshot);
  const ficha = useQuery({
    queryKey: ["atendimento", "ficha", atual?.contractId],
    queryFn: async () => (await api.get<RespostaLigacao>(`/clientes/ligacao/contrato/${encodeURIComponent(atual!.contractId)}`)).data,
    enabled: !!atual,
    staleTime: 30_000,
  });
  const numeros = useMemo(() => {
    const lista = [atual?.ticketMetadata?.customer?.phone ?? "", ...(ficha.data?.cliente?.contatos ?? []).filter((c) => c.tipo === "telefone").map((c) => c.valor)];
    const vistos: string[] = [];
    for (const n of lista) if (final8(n).length === 8 && !vistos.some((v) => mesmoNumero(v, n))) vistos.push(n);
    return vistos;
  }, [atual, ficha.data]);

  const emLigacao = snapshot.chamadas.some((c) => c.estado !== "encerrada");
  const chamadaDoCliente = snapshot.chamadas.find((c) => c.estado !== "encerrada" && numeros.some((n) => mesmoNumero(n, c.numero))) ?? null;
  const podeLigar = snapshot.registro === "registrado" && !emLigacao && numeros.length > 0;
  const ligar = (numero: string) => window.desktop?.phoneCall?.(numero.replace(/\D/g, ""));

  // Nota na conversa ao fim da ligação com o cliente.
  const numerosRef = useRef(numeros);
  const conversaRef = useRef(atual);
  numerosRef.current = numeros; conversaRef.current = atual;
  useEffect(() => window.desktop?.onPhoneEvent?.((e: PhoneEvent) => {
    if (e.type !== "history" || e.silenciosa) return;
    const conversa = conversaRef.current;
    if (!conversa || !numerosRef.current.some((n) => mesmoNumero(n, e.numero))) return;
    const quem = e.direcao === "out" ? "Ligação feita ao cliente" : "Ligação recebida do cliente";
    const resultado = { atendida: "atendida", nao_atendida: "não atendida", rejeitada: "rejeitada", falhou: "falhou" }[e.resultado];
    const duracao = e.resultado === "atendida" ? `, duração ${Math.floor(e.duracaoSeg / 60)} min ${String(e.duracaoSeg % 60).padStart(2, "0")} s` : "";
    void chamar("POST", `/api/agent/conversations/${conversa.id}/notes`, { body: { note: `${quem} (${resultado}${duracao}).` } }).catch(() => undefined);
  }), []);

  // Quando a transcrição fica pronta (alguns minutos depois), o resumo e o motivo sugerido entram como nova nota na conversa do cliente.
  useEffect(() => {
    const jaPostadas = new Set<number>();
    const ao = (p?: { id?: number; numero?: string }) => {
      const conversa = conversaRef.current;
      if (!p?.id || !p.numero || !conversa || jaPostadas.has(p.id) || !numerosRef.current.some((n) => mesmoNumero(n, p.numero!))) return;
      jaPostadas.add(p.id);
      void buscarTranscricoes(p.numero).then((lista) => {
        const t = lista.find((x) => x.id === p.id);
        if (t && t.status === "pronta" && t.resumo) return chamar("POST", `/api/agent/conversations/${conversa.id}/notes`, { body: { note: notaDaTranscricao(t) } });
      }).catch(() => undefined);
    };
    socket.on("phone:transcricao", ao);
    return () => { socket.off("phone:transcricao", ao); };
  }, []);

  // "Ocupado": durante a ligação o atendente sai da fila; ao terminar, volta ao status que tinha (só se fomos nós que mudamos).
  const mudamos = useRef<"AVAILABLE" | null>(null);
  useEffect(() => {
    if (emLigacao && statusAtual === "AVAILABLE" && !mudamos.current) {
      mudamos.current = "AVAILABLE";
      void chamar("PATCH", "/api/agent/users/me/status", { body: { attendanceStatus: "INVISIBLE" } }).catch(() => { mudamos.current = null; });
    } else if (!emLigacao && mudamos.current) {
      const volta = mudamos.current;
      mudamos.current = null;
      void chamar("PATCH", "/api/agent/users/me/status", { body: { attendanceStatus: volta } }).catch(() => undefined);
    }
  }, [emLigacao, statusAtual]);
  // Saiu do módulo (ou fechou) no meio da ligação: devolve o status.
  useEffect(() => () => {
    if (mudamos.current) void chamar("PATCH", "/api/agent/users/me/status", { body: { attendanceStatus: mudamos.current } }).catch(() => undefined);
  }, []);

  return { numeros, podeLigar, emLigacao, chamadaDoCliente, ligar };
}
