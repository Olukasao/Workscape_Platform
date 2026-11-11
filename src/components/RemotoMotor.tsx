import { useEffect } from "react";
import { clients } from "../services/api";
import { useRemotoLocal } from "../stores/remotoLocal";
import { deveReiniciar } from "../services/remotoAuto";
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
    let naoRegistradoSeguidos = 0;
    let tentativas = 0;
    let ultimaTentativaMs = 0;
    // Pergunta ao servidor se este computador já se registrou no suporte remoto; se não, reinicia o programa (poucas vezes).
    const conferirRegistro = async () => {
      const r = await clients.chat.get<{ registrado: boolean | null }>("/remoto/estado").then((x) => x.data).catch(() => null);
      if (parado || !r) return;
      useRemotoLocal.setState({ registrado: r.registrado });
      naoRegistradoSeguidos = r.registrado === false ? naoRegistradoSeguidos + 1 : 0;
      if (r.registrado === true) { tentativas = 0; return; }
      if (!deveReiniciar({ naoRegistradoSeguidos, tentativas, ultimaTentativaMs, agoraMs: Date.now() })) return;
      tentativas += 1;
      ultimaTentativaMs = Date.now();
      useRemotoLocal.setState({ consertando: true });
      const novo = await window.desktop!.remotoReiniciar?.().catch(() => null);
      if (!parado && novo?.ok && novo.id) { id = novo.id; useRemotoLocal.setState({ id: novo.id, senha: novo.senha || "" }); }
      if (!parado) useRemotoLocal.setState({ consertando: false });
    };
    const avisar = async () => {
      if (!id) {
        const r = await window.desktop!.remotoIniciar!().catch(() => null);
        if (!r?.ok || !r.id) return; // sem o módulo neste computador: tenta de novo mais tarde
        id = r.id;
        useRemotoLocal.setState({ id: r.id, senha: r.senha || "" });
      }
      if (!parado) await clients.chat.post("/remoto/registro", { id, computador: "" }).catch(() => undefined);
      if (!parado) await conferirRegistro();
    };
    void avisar();
    const t = window.setInterval(() => void avisar(), 60_000);
    return () => { parado = true; window.clearInterval(t); };
  }, [token]);
  return null;
}
