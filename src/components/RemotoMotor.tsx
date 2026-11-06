import { useEffect } from "react";
import { clients } from "../services/api";
import { useSession } from "../stores/workspace";

/** Deixa o suporte remoto pronto neste computador e avisa o servidor, de minuto em minuto, qual é o ID dele (para o T.I. conseguir conectar). */
export default function RemotoMotor() {
  const token = useSession((s) => s.token);
  useEffect(() => {
    if (!token || !window.desktop?.remotoIniciar) return;
    let parado = false;
    let id = "";
    const avisar = async () => {
      if (!id) {
        const r = await window.desktop!.remotoIniciar!().catch(() => null);
        if (!r?.ok || !r.id) return; // sem o módulo neste computador: tenta de novo mais tarde
        id = r.id;
      }
      if (!parado) await clients.chat.post("/remoto/registro", { id, computador: "" }).catch(() => undefined);
    };
    void avisar();
    const t = window.setInterval(() => void avisar(), 60_000);
    return () => { parado = true; window.clearInterval(t); };
  }, [token]);
  return null;
}
