import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { socket } from "./socket";
import { useNotices, useSession } from "../stores/workspace";
import { useFuncoes } from "./funcoes";

/** Avaliação do atendimento como o Workspace usa (sem nome de cliente). */
export interface AvaliacaoItem {
  protocolo: string;
  nota: number;
  comentario: string;
  respondidoEm: string;
  assunto: string;
  tecnico: string;
  /** Nome do cliente que avaliou (vazio se o site não conhece). */
  cliente?: string;
  destaque?: boolean;
}

export const casas = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
export const faixaDaNota = (n: number) => (n >= 4 ? "bom" : n === 3 ? "medio" : "ruim");

/** Avaliações marcadas como destaque por um administrador, para o Início. */
export function useDestaquesAvaliacao() {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: ["avaliacoes", "destaques"],
    queryFn: async () => (await api.get<{ itens: (AvaliacaoItem & { destacadoEm?: string })[] }>("/chamados/avaliacoes/destaques")).data.itens,
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/**
 * Avisa quando um cliente avalia o atendimento, igual a uma mensagem: entra na lista de Notificações
 * e, com o app em segundo plano, aparece no canto da tela. O servidor só manda para quem tem a área Chamados.
 */
export function useAvaliacoesFeed() {
  const user = useSession((s) => s.user);
  const { pode } = useFuncoes();
  const liberado = pode("chamados");
  // Avaliação que um administrador mandou para a equipe: chega para todo mundo, tenha ou não a área Chamados.
  useEffect(() => {
    if (!user) return;
    const compartilhada = ({ item }: { item?: AvaliacaoItem } = {}) => {
      if (!item) return;
      const estrelas = "★".repeat(item.nota) + "☆".repeat(5 - item.nota);
      const title = `Avaliação do atendimento: ${estrelas}`;
      const body = [item.cliente ? `Cliente: ${item.cliente}` : "", item.comentario ? `“${item.comentario}”` : "Cliente avaliou o atendimento", item.tecnico ? `Técnico: ${item.tecnico}` : ""].filter(Boolean).join(" — ");
      const target = pode("chamados") ? "/chamados?aba=avaliacoes" : "/";
      useNotices.getState().add({ id: `avaliacao-enviada:${item.protocolo}:${Date.now()}`, title, body, target, time: new Date().toISOString() });
      void window.desktop?.notify({ title, body, target, context: "Avaliação do atendimento", kind: "system", size: "grande", tone: item.nota <= 2 ? "crit" : item.nota === 3 ? "warn" : "info" });
    };
    socket.on("avaliacoes:notificada", compartilhada);
    return () => { socket.off("avaliacoes:notificada", compartilhada); };
  }, [user?.id, liberado]);

  useEffect(() => {
    if (!user || !liberado) return;
    const nova = ({ itens = [], total = itens.length }: { itens?: AvaliacaoItem[]; total?: number } = {}) => {
      if (!itens.length) return;
      const a = itens[0];
      const estrelas = "★".repeat(a.nota) + "☆".repeat(5 - a.nota);
      const title = total > 1 ? `${total} novas avaliações do atendimento` : `Nova avaliação do atendimento: ${estrelas}`;
      const body = total > 1
        ? `Mais recente${a.cliente ? ` (${a.cliente})` : ""}: ${a.nota} de 5${a.comentario ? ` — “${a.comentario}”` : ""}`
        : [a.cliente ? `Cliente: ${a.cliente}` : "", a.comentario ? `“${a.comentario}”` : "Sem comentário", a.tecnico ? `Técnico: ${a.tecnico}` : ""].filter(Boolean).join(" — ");
      useNotices.getState().add({
        id: `avaliacao:${itens.map((i) => i.protocolo).join(",")}`,
        title,
        body,
        target: "/chamados?aba=avaliacoes",
        time: new Date().toISOString(),
      });
      if (!location.hash.startsWith("#/chamados") || !document.hasFocus())
        void window.desktop?.notify({
          title,
          body,
          target: "/chamados?aba=avaliacoes",
          sender: a.assunto || undefined,
          context: "Avaliação do atendimento",
          kind: "system",
          size: "grande",
          tone: a.nota <= 2 ? "crit" : a.nota === 3 ? "warn" : "info",
        });
    };
    socket.on("avaliacoes:nova", nova);
    return () => { socket.off("avaliacoes:nova", nova); };
  }, [user?.id, liberado]);
}
