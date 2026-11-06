import { useEffect } from "react";
import { clients } from "../services/api";
import { useRemotoLocal } from "../stores/remotoLocal";
import { useSession } from "../stores/workspace";

/**
 * Deixa o suporte remoto pronto neste computador: guarda o ID e a senha dele (para a tela "Suporte T.I." mostrar à
 * própria pessoa) e avisa o servidor, de minuto em minuto, que este ID está online (para o T.I. ver a lista).
 * A senha nunca sai deste computador: só aparece na tela de quem está logado nele.
 */
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
        useRemotoLocal.setState({ id: r.id, senha: r.senha || "" });
      }
      if (!parado) await clients.chat.post("/remoto/registro", { id, computador: "" }).catch(() => undefined);
    };
    void avisar();
    const t = window.setInterval(() => void avisar(), 60_000);
    return () => { parado = true; window.clearInterval(t); };
  }, [token]);
  return null;
}
