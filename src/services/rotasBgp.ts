import { useQuery } from "@tanstack/react-query";
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
