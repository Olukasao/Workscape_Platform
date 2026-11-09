import { useEffect } from "react";

/** Só aparece no app de testes: avisa que os dados e o servidor não são os oficiais. */
export const AMBIENTE_TESTE = import.meta.env.VITE_AMBIENTE === "teste";

export default function AmbienteTeste() {
  useEffect(() => {
    if (AMBIENTE_TESTE && !document.title.startsWith("[TESTE]")) document.title = `[TESTE] ${document.title}`;
  }, []);
  if (!AMBIENTE_TESTE) return null;
  return <div className="ambiente-teste" role="status">Ambiente de testes · nada aqui vale para a produção</div>;
}
