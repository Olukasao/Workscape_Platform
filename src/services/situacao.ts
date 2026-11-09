import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { socket } from "./socket";
import { useSession } from "../stores/workspace";

export interface SituacaoItem { usuario_id: number; situacao: string | null; ate: string | null }
interface Resposta { opcoes: Record<string, string>; itens: SituacaoItem[] }
const CHAVE = ["presenca", "situacoes"];

export const ROTULO_LIGACAO = "Em ligação";

/** Situação de cada pessoa (almoço, visita, em ligação…), em tempo real pelo socket do chat. */
export function useSituacoes() {
  const user = useSession((s) => s.user);
  const cliente = useQueryClient();
  const q = useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await api.get<Resposta>("/presenca/situacoes")).data,
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // pega as que venceram sozinhas
  });
  useEffect(() => {
    if (!user) return;
    const mudou = (e: SituacaoItem) => cliente.setQueryData<Resposta>(CHAVE, (atual) => {
      if (!atual) return atual;
      const outros = atual.itens.filter((i) => Number(i.usuario_id) !== Number(e.usuario_id));
      return { ...atual, itens: e.situacao ? [...outros, e] : outros };
    });
    socket.on("situacao_changed", mudou);
    return () => { socket.off("situacao_changed", mudou); };
  }, [user?.id, cliente]);
  const opcoes = q.data?.opcoes ?? {};
  const mapa = new Map((q.data?.itens ?? []).map((i) => [Number(i.usuario_id), i]));
  /** Texto da situação de uma pessoa, ou "" quando está normal. */
  const rotuloDe = (usuarioId: number | undefined | null) => {
    const s = usuarioId == null ? null : mapa.get(Number(usuarioId))?.situacao;
    return !s ? "" : s === "ligacao" ? ROTULO_LIGACAO : opcoes[s] ?? "";
  };
  return { opcoes, mapa, rotuloDe };
}

export function useMudarSituacao() {
  const cliente = useQueryClient();
  const user = useSession((s) => s.user);
  return useMutation({
    mutationFn: async (v: { situacao: string | null; minutos?: number }) => (await api.put<{ situacao: string | null; ate: string | null }>("/presenca/situacao", v)).data,
    onSuccess: (ef) => {
      if (!user) return;
      cliente.setQueryData<Resposta>(CHAVE, (atual) => {
        if (!atual) return atual;
        const outros = atual.itens.filter((i) => Number(i.usuario_id) !== Number(user.id));
        return { ...atual, itens: ef.situacao ? [...outros, { usuario_id: user.id, ...ef }] : outros };
      });
    },
  });
}

/** Avisa o servidor quando a pessoa entra/sai de uma ligação do softphone. */
export function avisarLigacao(ativa: boolean) {
  void api.put("/presenca/ligacao", { ativa }).catch(() => undefined);
}
