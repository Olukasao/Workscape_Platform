import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { clients } from "./api";
import { useSession } from "../stores/workspace";

export interface ResumoBgp {
  disponivel: boolean;
  totals?: { routers: number; routers_up: number; peers: number; peers_up: number; prefixes: number; last_update: string | null; updates_last_minute: number };
  collector?: { state: string; count: number };
}
export interface PeerBgp {
  peer_hash_id: string;
  routername: string;
  peername: string;
  peerip: string;
  peerasn: string;
  peer_state: string;
  as_name: string | null;
  lastmodified: string;
}
export interface MudancaBgp {
  id: string;
  prefix: string;
  prefixlen: number;
  origin_as: string | null;
  as_path: string[];
  peername: string;
  event: string;
  lastmodified: string;
}
export interface BuscaBgp {
  disponivel: boolean;
  kind?: string;
  query?: string | number;
  found?: boolean;
  name?: string;
  route?: { prefix: string; prefixlen: number; origin_as: string; as_path: string[]; nh: string; peername: string; lastmodified: string; iswithdrawn: boolean };
}

const opcoes = { staleTime: 15000, refetchInterval: 30000, retry: (n: number, e: unknown) => !(isAxiosError(e) && e.response?.status === 403) && n < 1 };

function useBgp<T>(chave: string, caminho: string) {
  const user = useSession((s) => s.user);
  return useQuery({ queryKey: ["bgp", chave, user?.id], enabled: !!user, ...opcoes, queryFn: async () => (await clients.chat.get<T>(caminho)).data });
}

export const useResumoBgp = () => useBgp<ResumoBgp>("resumo", "/integrations/bmp/resumo");
export const usePeersBgp = () => useBgp<{ disponivel: boolean; items?: PeerBgp[] }>("peers", "/integrations/bmp/peers");
export const useMudancasBgp = () => useBgp<{ disponivel: boolean; items?: MudancaBgp[] }>("mudancas", "/integrations/bmp/mudancas");

export function useBuscaBgp(q: string) {
  return useQuery({
    queryKey: ["bgp", "busca", q],
    enabled: q.length >= 2,
    staleTime: 30000,
    retry: false,
    queryFn: async () => (await clients.chat.get<BuscaBgp>("/integrations/bmp/busca", { params: { q } })).data,
  });
}

export interface FiltroHistorico {
  prefix: string;
  asn: string;
  start: string;
  end: string;
}
export interface PaginaHistorico {
  disponivel: boolean;
  items?: MudancaBgp[];
  next_cursor?: string | null;
  error?: string;
}

/** Histórico de anúncios e retiradas, com "carregar mais" por cursor. */
export function useHistoricoBgp(filtro: FiltroHistorico, ativo: boolean) {
  return useInfiniteQuery({
    queryKey: ["bgp", "historico", filtro],
    enabled: ativo,
    staleTime: 30000,
    retry: false,
    initialPageParam: "",
    getNextPageParam: (ultima: PaginaHistorico) => ultima.next_cursor || undefined,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = {};
      if (filtro.prefix) params.prefix = filtro.prefix;
      if (filtro.asn) params.asn = filtro.asn;
      if (filtro.start) params.start = filtro.start;
      if (filtro.end) params.end = filtro.end;
      if (pageParam) params.before = pageParam;
      return (await clients.chat.get<PaginaHistorico>("/integrations/bmp/historico", { params })).data;
    },
  });
}

export interface EstadoPeer {
  peer_hash_id: string;
  peer_name: string;
  peer_as: number;
  timestamp: string | null;
  iswithdrawn: boolean;
  attrs_unknown?: boolean;
  as_path: string[] | null;
  next_hop: string | null;
}
export interface EstadoPrefixo {
  disponivel: boolean;
  prefix?: string;
  timestamp?: string;
  peers?: EstadoPeer[];
  error?: string;
}

/** Como um prefixo estava numa data e hora (máquina do tempo). */
export function useEstadoBgp(prefix: string, ts: string) {
  return useQuery({
    queryKey: ["bgp", "estado", prefix, ts],
    enabled: !!prefix && !!ts,
    staleTime: 60000,
    retry: false,
    queryFn: async () => (await clients.chat.get<EstadoPrefixo>("/integrations/bmp/estado", { params: { prefix, ts } })).data,
  });
}
