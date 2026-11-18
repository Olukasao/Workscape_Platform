import { useEffect } from "react";
import { socket } from "./socket";
import { useFuncoes } from "./funcoes";
import { useNotices, useSession } from "../stores/workspace";
import { textoDoAvisoMarketing, type LeadWifi } from "./marketingWifiTexto";

export { textoDoAvisoMarketing, type LeadWifi };

/**
 * Aviso para quem tem a área Marketing quando o Wi-Fi público obtém um dado novo de marketing
 * (alguém se cadastrou no portal e aceitou receber ofertas). Sempre avisa, com o destaque verde das contratações novas.
 */
export function useMarketingWifiAviso() {
  const user = useSession((s) => s.user);
  const { pode } = useFuncoes();
  const liberado = pode("marketing");
  useEffect(() => {
    if (!user || !liberado) return;
    const novo = ({ itens = [], total = itens.length }: { itens?: LeadWifi[]; total?: number } = {}) => {
      if (!itens.length) return;
      const { title, body } = textoDoAvisoMarketing(itens, total);
      useNotices.getState().add({ id: `marketing-wifi:${itens.map((i) => `${i.id}|${i.quando}`).join(",")}`, title, body, target: "/marketing", time: new Date().toISOString() });
      void window.desktop?.notify({ title, body, target: "/marketing", context: "Marketing · Wi-Fi público", kind: "system", tone: "novo" });
    };
    socket.on("wifi:marketing", novo);
    return () => {
      socket.off("wifi:marketing", novo);
    };
  }, [user?.id, liberado]);
}
