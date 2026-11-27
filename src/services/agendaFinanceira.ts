import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { clients, errorMessage } from "./api";
import { socketEndpoint } from "./live";
import { useServers, useSession } from "../stores/workspace";

// Agenda Financeira: fila de ativação de contratos do SGP distribuída entre as colaboradoras do financeiro.
// O servidor (agenda-tecnicos, rotas /api/agenda-financeira) é a fonte; aqui só a consulta, o tempo real e a distribuição.

export type Prioridade = "normal" | "atencao" | "urgente";
export interface Colaboradora {
  id: string;
  nome: string;
  usuarioSgp: string;
}
export interface Observacao {
  texto: string;
  usuario: string;
  data: string;
}
export interface Ocorrencia {
  id: string;
  numero: string;
  cliente: string;
  contrato: number | string | null;
  contratoStatus: string;
  tipo: string;
  metodo: string;
  pop: string;
  status: string;
  statusId: number;
  statusRotulo: string;
  abertoEm: string | null;
  aberturaComHora: boolean;
  aguardandoMin: number | null;
  prioridade: Prioridade;
  dataAgendamento: string;
  dataFinalizacao: string;
  usuarioFinalizacao: string;
  usuarioAbertura: string;
  responsavelSgp: string | null;
  /** id da colaboradora (coluna) ou null = fila */
  responsavel: string | null;
  responsavelUsuario: string | null;
  /** responsável do SGP que não é do financeiro (fica na fila, identificado) */
  outroResponsavel: string | null;
  origemResponsavel: "sgp" | "agenda";
  /** distribuída só na agenda: o SGP ainda mostra outro responsável */
  naoGravadoNoSgp: boolean;
  ordem: number | null;
  versao: number;
  descricao: string;
  observacoes: Observacao[];
  ordensServico: number;
  linkSgp: string;
}
export interface MediaAtendimento {
  minutos: number | null;
  amostra: number;
}
export interface IndicadoresColaboradora {
  total: number;
  pendentes: number;
  emAtendimento: number;
  urgentes: number;
  finalizadasNoDia: number;
  esperaMediaMin: number | null;
  atendimento: MediaAtendimento;
}
export interface Indicadores {
  total: number;
  semResponsavel: number;
  distribuidas: number;
  emAtendimento: number;
  finalizadasNoDia: number;
  esperaMediaMin: number | null;
  esperaMedianaMin: number | null;
  atendimento: MediaAtendimento;
  urgentes: number;
  calculadoEm: string;
  porColaboradora: Record<string, IndicadoresColaboradora>;
}
export interface AgendaFinanceira {
  data: string;
  hoje: string;
  atualizadoEm: string;
  revisao: number;
  mudouNoSgp: boolean;
  erroFinalizadas: string;
  colaboradoras: Colaboradora[];
  colunas: Record<string, Ocorrencia[]>;
  fila: Ocorrencia[];
  finalizadas: Ocorrencia[];
  indicadores: Indicadores;
  sgp: { gravaResponsavel: boolean; modo: "local" | "obrigatoria" };
  podeDistribuir: boolean;
}
export interface ResultadoMover {
  id: string;
  ok: boolean;
  codigo?: string;
  erro?: string;
  sincronizadoSgp?: boolean;
  atual?: Ocorrencia;
}
export interface RespostaMover {
  resultados: ResultadoMover[];
  revisao: number;
  movidos: string[];
}
export interface MovimentoHistorico {
  id: number;
  em: string;
  ocorrenciaId: string;
  numero: string;
  cliente: string;
  tipo: string;
  de: string | null;
  para: string | null;
  por: { id: number | null; nome: string } | null;
  origem: "agenda" | "devolvida" | "sgp-externo";
  resultadoSgp: "ok" | "nao_suportado" | "erro";
  detalhe: string;
}

const chave = (data: string) => ["agenda", "financeira", "feed", data] as const;

/** Fila do dia (atualiza sozinha: tempo real do servidor + conferência a cada minuto). */
export function useAgendaFinanceira(data: string, active: boolean) {
  const origin = useServers((s) => s.config.agenda);
  const user = useSession((s) => s.user);
  const token = useSession((s) => s.token);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chave(data),
    enabled: active && !!origin && !!user,
    queryFn: async () => {
      const { data: corpo } = await clients.agenda.get<AgendaFinanceira>("/agenda-financeira/agenda", { params: { data }, timeout: 60000 });
      if (!corpo || !Array.isArray(corpo.fila) || !corpo.colunas) throw new Error("Resposta inválida da Agenda Financeira.");
      return corpo;
    },
    staleTime: 15000,
    refetchInterval: active ? 60000 : false,
    placeholderData: (anterior) => anterior,
  });
  useEffect(() => {
    if (!active || !origin || !user) return;
    const endpoint = socketEndpoint("agenda", origin);
    const socket = io(endpoint.url, { path: endpoint.path, auth: { token }, transports: ["websocket"], reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
    const atualizar = () => void queryClient.invalidateQueries({ queryKey: ["agenda", "financeira"] });
    socket.on("agendaFinanceira:atualizada", atualizar);
    socket.on("agendaFinanceira:sgp", atualizar);
    socket.on("connect", atualizar);
    return () => {
      socket.disconnect();
    };
  }, [active, origin, user, token, queryClient]);
  return {
    agenda: query.data ?? null,
    carregando: query.isLoading,
    atualizando: query.isFetching,
    erro: query.error ? errorMessage(query.error) : "",
    recarregar: () => queryClient.invalidateQueries({ queryKey: ["agenda", "financeira"] }),
  };
}

/** Distribui (ou devolve à fila com destino null). O servidor confirma item por item; quem falhar volta ao lugar. */
export async function moverOcorrencias(ids: string[], destino: string | null, indice: number | null, versoes: Record<string, number>): Promise<RespostaMover> {
  try {
    const { data } = await clients.agenda.post<RespostaMover>("/agenda-financeira/mover", { ids, destino, indice, versoes });
    return data;
  } catch (e) {
    // 409 com corpo = o servidor recusou todos os itens (ex.: já saíram da fila): devolve o que ele disse
    const corpo = (e as { response?: { data?: RespostaMover } }).response?.data;
    if (corpo && Array.isArray(corpo.resultados)) return corpo;
    throw e;
  }
}

export function useBuscaFinanceira(termo: string, active: boolean) {
  const t = termo.trim();
  return useQuery({
    queryKey: ["agenda", "financeira", "busca", t],
    enabled: active && t.length >= 2,
    queryFn: async () => (await clients.agenda.get<{ ids: string[] }>("/agenda-financeira/busca", { params: { q: t } })).data.ids,
    staleTime: 20000,
  });
}

export function useHistoricoFinanceiro(active: boolean, ocorrencia = "") {
  return useQuery({
    queryKey: ["agenda", "financeira", "historico", ocorrencia],
    enabled: active,
    queryFn: async () => (await clients.agenda.get<{ items: MovimentoHistorico[] }>("/agenda-financeira/historico", { params: { limite: 200, ocorrencia: ocorrencia || undefined } })).data.items,
    staleTime: 10000,
  });
}

export { FILTROS_VAZIOS, ROTULO_PRIORIDADE, formatarEspera, passaNosFiltros, type Filtros } from "./agendaFinanceiraLogica";
