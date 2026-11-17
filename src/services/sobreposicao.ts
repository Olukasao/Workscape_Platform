import { useEffect, useState } from "react";
import { create } from "zustand";

/** Camadas do app que precisam ficar acima das páginas nativas (Navegador, versão web da agenda). */
export const useSobreposicao = create<{ paleta: boolean; setPaleta: (aberta: boolean) => void; chamada: boolean; setChamada: (tocando: boolean) => void }>((set) => ({
  paleta: false,
  setPaleta: (paleta) => set({ paleta }),
  /** Chamada tocando: a faixa de atender fica na tela e a página nativa abre espaço para ela. */
  chamada: false,
  setChamada: (chamada) => set({ chamada }),
}));

const SELETOR_JANELA = '[aria-modal="true"], [role="dialog"], [role="alertdialog"]';
const aparece = (el: Element) => {
  const h = el as HTMLElement;
  return h.getClientRects().length > 0 && getComputedStyle(h).visibility !== "hidden" && !h.hidden && h.getAttribute("aria-hidden") !== "true";
};

/**
 * Há alguma janela, aviso ou alarme (dialog / modal) visível na tela do app?
 * As páginas nativas (Navegador, agenda web, Escritório) ficam SEMPRE por cima de qualquer elemento do app: sem sair da frente,
 * o botão de fechar da janela fica escondido atrás delas e a pessoa fica presa. Quem tem página nativa usa isto para se esconder.
 */
export function useJanelaAbertaNaTela() {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    let agendado = 0;
    const conferir = () => {
      agendado = 0;
      const achou = Array.from(document.querySelectorAll(SELETOR_JANELA)).some(aparece);
      setAberta((antes) => (antes === achou ? antes : achou));
    };
    // uma conferencia por quadro, no maximo (a pagina muda muito)
    const agendar = () => { if (!agendado) agendado = requestAnimationFrame(conferir); };
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "aria-modal", "aria-hidden", "hidden", "style", "class"] });
    conferir();
    return () => { observador.disconnect(); if (agendado) cancelAnimationFrame(agendado); };
  }, []);
  return aberta;
}
