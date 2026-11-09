import { useSyncExternalStore } from "react";

// "Abrir a ficha do cliente quando uma ligação de número externo tocar ou for feita". Ligado por padrão, por pessoa, neste computador.
const CHAVE = "workspace:ficha-cliente:auto";
const EVENTO = "workspace:ficha-cliente:auto:mudou";

export const fichaAutomatica = () => { try { return localStorage.getItem(CHAVE) !== "0"; } catch { return true; } };
export function definirFichaAutomatica(ligada: boolean) {
  try { localStorage.setItem(CHAVE, ligada ? "1" : "0"); } catch { /* vale só até fechar o app */ }
  window.dispatchEvent(new Event(EVENTO));
}
export function useFichaAutomatica() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener(EVENTO, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVENTO, cb); window.removeEventListener("storage", cb); }; },
    fichaAutomatica,
    () => true,
  );
}
/** A janela da ficha só existe no app Windows. */
export const fichaDisponivel = () => typeof window !== "undefined" && !!window.desktop?.fichaAbrir;
