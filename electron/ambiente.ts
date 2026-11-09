// Build de TESTES ("Acessa Workspace Teste"): instalado ao lado do oficial, fala com o servidor de testes
// e recebe atualizações do canal pilot. O valor entra na hora do build (WORKSPACE_AMBIENTE=teste).
declare const __WORKSPACE_AMBIENTE__: string | undefined;
export const ambienteTeste = typeof __WORKSPACE_AMBIENTE__ !== "undefined" && __WORKSPACE_AMBIENTE__ === "teste";
export const chatTesteOrigin = "http://192.168.1.133:8601";
export const nomeDoApp = ambienteTeste ? "Acessa Workspace Teste" : "Acessa Workspace";
