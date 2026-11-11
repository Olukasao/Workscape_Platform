// Origem da acessanet-chat-api para o módulo Atendimento. Hoje é o painel de TESTE (porta 9520), que repassa /api e
// /socket.io para a API. Trocar por https://atendimento.acessanet.com.br ao ir para produção (e liberar a origem no
// Chat Interno e na chat-api). HTTP só para este endereço da rede interna.
export const atendimentoApiOrigin = process.env.WORKSPACE_ATENDIMENTO_URL?.replace(/\/+$/, "") || "http://192.168.1.133:9520";
export const atendimentoRedirectUri = `${atendimentoApiOrigin}/`;
