import { eventoNoTerminal } from "../services/terminalFoco";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ACOES_ATALHO, combinacaoDoEvento, useAtalhos } from "../services/atalhos";
import { useTelefone } from "../stores/telefone";
import { useSession } from "../stores/workspace";

/** Escuta os atalhos que a pessoa definiu em Configurações e executa a ação ligada a cada um. */
export default function AtalhosTeclado() {
  const navigate = useNavigate();
  const logado = useSession((s) => !!s.user);
  useEffect(() => {
    if (!logado) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.repeat || document.body.dataset.gravandoAtalho || eventoNoTerminal(e)) return; // no terminal, as teclas são do equipamento
      const combinacao = combinacaoDoEvento(e);
      if (!combinacao) return;
      const mapa = useAtalhos.getState().mapa;
      const id = Object.keys(mapa).find((k) => mapa[k] === combinacao);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      if (id === "telefone") {
        const t = useTelefone.getState();
        if (t.aberto) t.fechar(); else t.abrir();
        return;
      }
      const rota = ACOES_ATALHO.find((a) => a.id === id)?.rota;
      if (rota) navigate(rota);
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [logado, navigate]);
  return null;
}
