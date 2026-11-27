import { useEffect } from "react";
import { create } from "zustand";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { clients } from "./api";
import { useSession } from "../stores/workspace";

export interface IncidenteRede {
  id: string;
  tipo: string; // pon_loss | cto_loss | no_power | outro
  oltId: string;
  olt: string;
  inicio: string | null;
  descricao: string;
  totalDispositivos: number | null;
  dispositivosAtivos: number | null;
  /** Equipamentos que o alerta conta mas não têm contrato (não são clientes). Só vem para incidentes de PON. */
  semContrato?: number | null;
  pon: string;
  slotPon: string;
  cto: string;
}
export interface ClienteAfetado {
  contrato: string | null;
  nome: string | null;
  serie: string | null;
  ultimaQueda: string | null;
}
export interface IncidentesResposta {
  configurada: boolean;
  atualizadoEm?: string;
  incidentes: IncidenteRede[];
}

/** Incidentes ativos da OLT Cloud (via servidor do Chat). `negado` = a pessoa não tem acesso à rede. */
export function useIncidentesRede() {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: ["rede", "incidentes", user?.id],
    enabled: !!user,
    staleTime: 15000,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    retry: (count, error) => !(isAxiosError(error) && error.response?.status === 403) && count < 1,
    queryFn: async (): Promise<IncidentesResposta & { negado: boolean }> => {
      try {
        const { data } = await clients.chat.get<IncidentesResposta>("/integrations/olt/incidentes");
        return { ...data, negado: false };
      } catch (e) {
        if (isAxiosError(e) && e.response?.status === 403) return { configurada: false, incidentes: [], negado: true };
        throw e;
      }
    },
  });
}

export interface PanoramaRede {
  configurada: boolean;
  atualizadoEm?: string;
  total?: number;
  online?: number;
  semEnergia?: number;
  loss?: number;
  porOlt?: { olt: string; semEnergia: number; loss: number }[];
  pons?: { olt: string; slot: string; pon: string; semEnergia: number; loss: number }[];
  totalPons?: number;
}
/** Visão geral AGORA: quantos clientes estão sem energia ou em LOSS, por OLT e por PON (eventos regionais). */
export function usePanoramaRede(habilitado: boolean) {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: ["rede", "panorama", user?.id],
    enabled: !!user && habilitado,
    staleTime: 15000,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    retry: 1,
    queryFn: async () => (await clients.chat.get<PanoramaRede>("/integrations/olt/panorama")).data,
  });
}

export async function carregarClientesAfetados(id: string) {
  const { data } = await clients.chat.get<{ configurada: boolean; total: number; exibidos: number; clientes: ClienteAfetado[] }>(
    `/integrations/olt/incidentes/${encodeURIComponent(id)}/clientes`,
  );
  return data;
}

export const TIPO_ROTULO: Record<string, string> = {
  pon_loss: "Queda de PON",
  pon_down: "PON fora do ar",
  pon_no_power: "PON sem energia",
  cto_loss: "Queda de CTO",
  cto_no_power: "CTO sem energia",
  no_power: "Sem energia",
};
/** crit = vermelho (PON), warn = âmbar (CTO / energia na PON), info = demais. */
export const TIPO_TOM: Record<string, "crit" | "warn" | "info"> = {
  pon_loss: "crit", pon_down: "crit", pon_no_power: "warn", cto_loss: "warn", cto_no_power: "info", no_power: "info",
};
export const tipoRotulo = (tipo: string) => TIPO_ROTULO[tipo] || "Alerta de rede";

/** "há 12 min", "há 3 h 05 min", "há 2 dias". */
export function haQuanto(inicio: string | null, agora = Date.now()) {
  const t = inicio ? Date.parse(inicio) : NaN;
  if (!Number.isFinite(t)) return "—";
  const min = Math.max(0, Math.floor((agora - t) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h ${String(min % 60).padStart(2, "0")} min`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}

const CHAVE_IGNORADOS = "workspace.rede.ignorados";
function lerIgnorados(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_IGNORADOS) || "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
let ignoradosEnviados = false;
let envio: ReturnType<typeof setTimeout> | undefined;
/** Avisa o servidor quais alertas foram ignorados, só para o briefing do chat não citá-los. Melhor esforço. */
function enviarIgnorados(ids: string[]) {
  clearTimeout(envio);
  envio = setTimeout(() => { void clients.chat.put("/integrations/olt/ignorados", { ids }).catch(() => {}); }, 1500);
}
function gravarIgnorados(ids: string[]) {
  enviarIgnorados(ids);
  try {
    localStorage.setItem(CHAVE_IGNORADOS, JSON.stringify(ids));
  } catch {
    /* sem armazenamento: vale só até fechar o app */
  }
}

/** Alertas que a pessoa escolheu ignorar neste computador. Somem da lista e dos contadores até serem restaurados. */
export const useIgnorados = create<{
  ids: string[];
  ignorar: (id: string) => void;
  restaurar: (id: string) => void;
  /** Esquece alertas que já não existem na OLT (resolvidos), para a lista não crescer para sempre. */
  limpar: (ativos: string[]) => void;
}>((set, get) => ({
  ids: lerIgnorados(),
  ignorar: (id) => {
    if (get().ids.includes(id)) return;
    const ids = [...get().ids, id];
    gravarIgnorados(ids);
    set({ ids });
  },
  restaurar: (id) => {
    const ids = get().ids.filter((v) => v !== id);
    gravarIgnorados(ids);
    set({ ids });
  },
  limpar: (ativos) => {
    const ids = get().ids.filter((v) => ativos.includes(v));
    if (ids.length === get().ids.length) return;
    gravarIgnorados(ids);
    set({ ids });
  },
}));

/** Separa os incidentes em visíveis e ignorados. */
export function useIncidentesFiltrados() {
  const q = useIncidentesRede();
  const ids = useIgnorados((s) => s.ids);
  const limpar = useIgnorados((s) => s.limpar);
  const todos = q.data?.incidentes;
  useEffect(() => {
    // Só limpa com leitura bem-sucedida e completa; uma falha momentânea não pode apagar a lista.
    if (q.isSuccess && !q.isFetching && todos) {
      limpar(todos.map((i) => i.id));
      // Uma vez por abertura do app: manda a lista que já estava salva neste computador.
      if (!ignoradosEnviados) { ignoradosEnviados = true; enviarIgnorados(useIgnorados.getState().ids); }
    }
  }, [q.isSuccess, q.isFetching, todos, limpar]);
  const lista = todos || [];
  return {
    q,
    visiveis: lista.filter((i) => !ids.includes(i.id)),
    ignorados: lista.filter((i) => ids.includes(i.id)),
  };
}

// ---- análises: sinal crítico, quedas repetidas, ranking de PONs e estabilidade do contrato ----
export interface ClienteSinal { contrato: string; serie: string; rxOnu: number | null; rxOlt: number | null }
export interface PonSinal { olt: string; slot: string; pon: string; total: number; avisos: number; criticos: number; pctCriticos: number; clientes: ClienteSinal[] }
export interface SinalResposta { configurada: boolean; atualizadoEm?: string; limite?: number; totalClientes?: number; totalPons?: number; pons?: PonSinal[] }
export interface ClienteInstavel { contrato: string; serie: string; olt: string; slot: string; pon: string; status: string; rxOnu: number | null; quedas24h: number; quedas7d: number; ultimas: string[] }
export interface InstaveisResposta { configurada: boolean; atualizadoEm?: string; verificados?: number; minimoQuedas?: number; clientes?: ClienteInstavel[] }
export interface ResumoQuedas { quedas: number; minutos: number; maxAfetados: number }
export interface PonRanking { chave: string; olt: string; slotPon: string; pon: string; semana: ResumoQuedas; mes: ResumoQuedas; ultima: string }
export interface RankingResposta { configurada: boolean; atualizadoEm?: string; cobreDesde?: string; semana?: PonRanking[]; mes?: PonRanking[] }

// A primeira leitura dos 10 mil equipamentos leva ~20 s: prazo maior que o padrão.
const LONGO = { timeout: 90000 };
function opcoesAnalise<T>(chave: string, caminho: string, userId: number | string | undefined, extra: Record<string, unknown> = {}) {
  return {
    queryKey: ["rede", chave, userId, extra],
    staleTime: 60000,
    queryFn: async () => (await clients.chat.get<T>(caminho, { ...LONGO, params: extra })).data,
  };
}
function useAnalise<T>(chave: string, caminho: string, habilitado: boolean, extra: Record<string, unknown> = {}) {
  const user = useSession((s) => s.user);
  return useQuery({
    ...opcoesAnalise<T>(chave, caminho, user?.id, extra),
    enabled: !!user && habilitado,
    refetchInterval: 5 * 60000,
    retry: 1,
  });
}
/** Lê as quatro análises em segundo plano (cada uma leva até 30 s): o tour da Rede mostra as abas já com os dados, sem tela de espera. */
export function precarregarAnalisesRede(client: QueryClient, userId: number | string | undefined) {
  if (userId === undefined) return;
  const lote: Array<[string, string, Record<string, unknown>?]> = [
    ["sinal", "/integrations/olt/sinal", { dbm: -27 }],
    ["instaveis", "/integrations/olt/instaveis"],
    ["ranking", "/integrations/olt/ranking"],
    ["nao-autorizadas", "/integrations/olt/nao-autorizadas"],
  ];
  for (const [chave, caminho, extra] of lote) void client.prefetchQuery({ ...opcoesAnalise(chave, caminho, userId, extra), retry: 0 });
}
export const useSinalCritico = (dbm: number, habilitado: boolean) => useAnalise<SinalResposta>("sinal", "/integrations/olt/sinal", habilitado, { dbm });
export const useInstaveis = (habilitado: boolean) => useAnalise<InstaveisResposta>("instaveis", "/integrations/olt/instaveis", habilitado);
export const useRankingPons = (habilitado: boolean) => useAnalise<RankingResposta>("ranking", "/integrations/olt/ranking", habilitado);

/** Nomes dos clientes (SGP) de uma lista de contratos, sob demanda. */
export function useNomesClientes(contratos: string[]) {
  const lista = [...new Set(contratos.filter(Boolean))].slice(0, 60);
  return useQuery({
    queryKey: ["rede", "nomes", lista.join(",")],
    enabled: lista.length > 0,
    staleTime: 10 * 60000,
    retry: 0,
    queryFn: async () => (await clients.chat.get<{ nomes: Record<string, string> }>("/integrations/olt/nomes", { timeout: 60000, params: { contratos: lista.join(",") } })).data.nomes,
  });
}

export interface EstabilidadeEquipamento { serie: string; status: string; olt: string; slot: string; pon: string; rxOnu: number | null; rxOlt: number | null; sinal: "ok" | "fraco" | "critico" | "sem_leitura"; quedas24h: number; quedas7d: number; ultimas: string[] }
export interface EstabilidadeResposta { configurada: boolean; encontrado?: boolean; contrato?: string; instavel?: boolean; equipamentos?: EstabilidadeEquipamento[] }
/** Quedas das últimas 24 h / 7 dias e sinal do contrato (ficha do cliente). */
export function useEstabilidade(contrato: string | undefined) {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: ["rede", "estabilidade", user?.id, contrato],
    enabled: !!user && !!contrato,
    staleTime: 2 * 60000,
    retry: 0,
    queryFn: async () => (await clients.chat.get<EstabilidadeResposta>(`/integrations/olt/clientes/${encodeURIComponent(contrato!)}/estabilidade`, { timeout: 30000 })).data,
  });
}

/** "45 min", "3 h 05 min", "2 dias 4 h". */
export function duracaoTexto(minutos: number) {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${String(m % 60).padStart(2, "0")} min`;
  const d = Math.floor(h / 24);
  return `${d} dia${d === 1 ? "" : "s"} ${h % 24} h`;
}

export interface BairroAfetado { bairro: string; cidade: string; clientes: number; semEnergia: number; loss: number; pct: number }
export interface PontoAfetado { lat: number; lng: number; estado: "semEnergia" | "loss"; bairro: string }
export interface CtoMapa { lat: number; lng: number; portas: number | null }
export interface BairrosResposta { configurada: boolean; total: number; consultados: number; semContrato: number; semEnergia: number; loss: number; leitura: string; bairros: BairroAfetado[]; pontos: PontoAfetado[]; ctos: CtoMapa[] }
/** Clientes afetados de um incidente por bairro (SGP) e por estado (sem energia x LOSS). */
export async function carregarBairros(id: string) {
  const { data } = await clients.chat.get<BairrosResposta>(`/integrations/olt/incidentes/${encodeURIComponent(id)}/bairros`, { timeout: 90000 });
  return data;
}

// ---- ONUs instaladas esperando autorização na OLT ----
export interface OnuNaoAutorizada { serie: string; modelo: string; olt: string; oltId: string; slot: string; pon: string; temCliente: boolean; vistoDesde: string }
export interface NaoAutorizadasResposta { configurada: boolean; atualizadoEm?: string; total?: number; itens?: OnuNaoAutorizada[] }
export const useNaoAutorizadas = (habilitado: boolean) => useAnalise<NaoAutorizadasResposta>("nao-autorizadas", "/integrations/olt/nao-autorizadas", habilitado);
