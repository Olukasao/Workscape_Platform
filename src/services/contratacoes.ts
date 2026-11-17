import { useEffect } from "react";
import { create } from "zustand";
import { socket } from "./socket";
import { useNotices, useSession } from "../stores/workspace";
import { textoDoAviso } from "./contratacaoAviso";

// Contratações pendentes do site (acessanet.com.br). O backend do Chat Interno
// consulta a API do site com token próprio e repassa pelo socket do chat:
//   contratacoes:resumo -> { conectado, pendentes, itens, atualizadoEm }
//   contratacoes:novo   -> { itens }  (pedido novo desde a última leitura)
export type Contratacao = {
  id: number;
  protocolo?: string;
  cliente?: string;
  plano?: string;
  cidade?: string;
  criadoEm?: string;
};
/** Pedido que já saiu de "novo" (vem do feed "andamento" do site). */
export type ContratacaoAndamento = Contratacao & {
  status: string;
  atualizadoEm?: string;
  responsavel?: string | null;
  /** Só nos cancelados. */
  motivo?: string | null;
};
export const STATUS_ROTULO: Record<string, string> = {
  em_analise: "Em análise",
  em_atendimento: "Em atendimento",
  agendado: "Agendado",
  sem_cobertura: "Sem cobertura",
  contratado: "Contratado",
  cancelado: "Cancelado",
};
export type GrupoContratacao = "aguardando" | "atendimento" | "cancelados" | "encerrados";
/** Mesmos status do painel do site, agrupados: Em atendimento / Cancelados / Encerrados (contratado ou sem cobertura). */
export const grupoDoStatus = (status: string): Exclude<GrupoContratacao, "aguardando"> | null =>
  status === "em_analise" || status === "em_atendimento" || status === "agendado"
    ? "atendimento"
    : status === "cancelado"
      ? "cancelados"
      : status === "contratado" || status === "sem_cobertura"
        ? "encerrados"
        : null;
type Estado = {
  recebido: boolean;
  conectado: boolean;
  pendentes: number;
  itens: Contratacao[];
  andamento: ContratacaoAndamento[];
  atualizadoEm: string | null;
  novos: number[];
};
const vazio: Estado = {
  recebido: false,
  conectado: false,
  pendentes: 0,
  itens: [],
  andamento: [],
  atualizadoEm: null,
  novos: [],
};
export const useContratacoes = create<Estado & { limparNovos: () => void }>((set) => ({
  ...vazio,
  limparNovos: () => set({ novos: [] }),
}));

export const descreverPedido = (item: Contratacao) =>
  [item.plano, item.cidade].filter(Boolean).join(" · ");

/** Montado uma vez no shell, junto da conexão do chat. */
export function useContratacoesFeed() {
  const user = useSession((s) => s.user);
  useEffect(() => {
    if (!user) {
      useContratacoes.setState(vazio);
      return;
    }
    const resumo = (dados: Partial<Estado> | null) => {
      if (!dados || typeof dados !== "object") return;
      useContratacoes.setState({
        recebido: true,
        conectado: !!dados.conectado,
        pendentes: Math.max(0, Number(dados.pendentes) || 0),
        itens: Array.isArray(dados.itens) ? dados.itens : [],
        andamento: Array.isArray(dados.andamento) ? dados.andamento : [],
        atualizadoEm: dados.atualizadoEm || new Date().toISOString(),
      });
    };
    const novo = ({ itens = [] }: { itens?: Contratacao[] } = {}) => {
      if (!itens.length) return;
      useContratacoes.setState((s) => ({
        novos: [...new Set([...itens.map((i) => i.id), ...s.novos])].slice(0, 50),
      }));
      const { title, body } = textoDoAviso(itens);
      useNotices.getState().add({
        id: `contratacao:${itens.map((i) => i.id).join(",")}`,
        title,
        body,
        target: "/contratacoes",
        time: new Date().toISOString(),
      });
      // Sempre avisa (mesmo com a tela de Contratações aberta), com destaque verde como o aviso de rede tem o vermelho.
      void window.desktop?.notify({
        title,
        body,
        target: "/contratacoes",
        context: "Contratação pelo site",
        kind: "system",
        tone: "novo",
      });
    };
    socket.on("contratacoes:resumo", resumo);
    socket.on("contratacoes:novo", novo);
    return () => {
      socket.off("contratacoes:resumo", resumo);
      socket.off("contratacoes:novo", novo);
    };
  }, [user]);
}
