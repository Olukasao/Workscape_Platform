import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, today } from "../services/agenda";
import { clients } from "../services/api";
import { useSession } from "../stores/workspace";

const DIAS = 7;
const chaveDoDia = (hoje: string) => `workspace:chamados-atrasados:${hoje}`;

/**
 * Uma vez por dia, avisa quem acompanha a Agenda de Técnicos de quantas ordens de serviço dos últimos 7 dias
 * ficaram sem atendimento (agendadas para um dia que já passou e ainda abertas). Usa os mesmos números do Dashboard.
 */
export default function AvisoChamadosAtrasados({ ativo }: { ativo: boolean }) {
  const logado = useSession((s) => !!s.user);
  const hoje = today();
  const ate = addDays(hoje, -1), de = addDays(hoje, -DIAS);
  const jaAvisou = (() => { try { return localStorage.getItem(chaveDoDia(hoje)) === "1"; } catch { return false; } })();
  const consulta = useQuery({
    queryKey: ["agenda", "indicadores", de, ate],
    queryFn: async () => (await clients.agenda.get<{ totais: { naoAtendidos: number } }>("/agenda-tecnicos/indicadores", { params: { de, ate }, timeout: 90000 })).data,
    enabled: ativo && logado && !jaAvisou && !!window.desktop,
    staleTime: 60_000,
    retry: false,
  });
  const total = consulta.data?.totais.naoAtendidos ?? 0;
  useEffect(() => {
    if (!consulta.data || jaAvisou) return;
    try { localStorage.setItem(chaveDoDia(hoje), "1"); } catch { /* avisa de novo na próxima abertura */ }
    if (total > 0) {
      void window.desktop?.notify({
        title: `${total} ${total === 1 ? "chamado atrasado" : "chamados atrasados"}`.slice(0, 120),
        body: `Nos últimos ${DIAS} dias, ${total === 1 ? "1 ordem de serviço ficou" : `${total} ordens de serviço ficaram`} sem atendimento. Toque para ver o Dashboard.`,
        target: "/dashboard",
        kind: "system",
        context: "Agenda de Técnicos",
        tone: "warn",
      });
    }
  }, [consulta.data, jaAvisou, total, hoje]);
  return null;
}
