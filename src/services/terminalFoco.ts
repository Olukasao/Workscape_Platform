/**
 * O terminal manda as teclas para o equipamento: com o foco nele, os atalhos do Workspace (buscar, ir para outro módulo,
 * abrir o telefone, recolher a barra lateral, Esc...) não podem interceptar. Combinações como Ctrl+K, Ctrl+\\ ou Esc
 * são comandos de verdade em muitos equipamentos e editores.
 */
export const eventoNoTerminal = (e: Pick<Event, "target">): boolean => {
  const alvo = e.target;
  return alvo instanceof Element && alvo.closest(".xterm, .term-tela") !== null;
};
