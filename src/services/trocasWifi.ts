import { useEffect } from "react";
import { socket } from "./socket";
import { useFuncoes } from "./funcoes";
import { useNotices, useSession } from "../stores/workspace";

interface TrocaWifi {
  id: string;
  contrato: string;
  cliente: string;
  redes: string[];
  roteador: string;
  confirmacao: "connected" | "not_connected" | null;
  chamado: string;
  quando: string;
}

const redes = (t: TrocaWifi) => (t.redes.length === 2 ? "2.4 e 5 GHz" : t.redes.map((r) => r.replace("GHz", " GHz")).join(" e ")) || "Wi-Fi";
const quem = (t: TrocaWifi) => t.cliente || `Contrato ${t.contrato}`;

/**
 * Aviso para a equipe quando um cliente troca a senha do Wi-Fi pela Central do Assinante (evento wifi:troca do chat interno).
 * Quem tem a área Chamados recebe. Destaque (vermelho) quando o cliente diz que NÃO conseguiu conectar: já existe chamado aberto.
 * O aviso nunca leva a senha, o IP nem o CPF.
 */
export function useTrocasWifiAviso() {
  const user = useSession((s) => s.user);
  const { pode } = useFuncoes();
  const liberado = pode("chamados");
  useEffect(() => {
    if (!user || !liberado) return;
    const nova = ({ itens = [], total = itens.length }: { itens?: TrocaWifi[]; total?: number } = {}) => {
      if (!itens.length) return;
      const t = itens[0];
      const problema = t.confirmacao === "not_connected";
      const title = total > 1 ? `${total} trocas de senha do Wi-Fi pela Central` : problema ? "Cliente não conseguiu conectar após trocar a senha" : "Cliente trocou a senha do Wi-Fi";
      const body = total > 1
        ? `Mais recente: ${quem(t)} (${redes(t)})`
        : [quem(t), t.roteador, redes(t), t.confirmacao === "connected" ? "confirmou que conectou" : problema ? (t.chamado ? `chamado ${t.chamado}` : "sem chamado aberto") : ""].filter(Boolean).join(" — ");
      useNotices.getState().add({ id: `wifi-troca:${itens.map((i) => `${i.id}:${i.confirmacao ?? ""}`).join(",")}`, title, body, target: "/chamados", time: new Date().toISOString() });
      if (!location.hash.startsWith("#/chamados") || !document.hasFocus())
        void window.desktop?.notify({ title, body, target: "/chamados", context: "Wi-Fi do cliente", kind: "system", size: "grande", tone: problema ? "crit" : "info" });
    };
    socket.on("wifi:troca", nova);
    return () => { socket.off("wifi:troca", nova); };
  }, [user?.id, liberado]);
}
