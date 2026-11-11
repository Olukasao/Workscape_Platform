/**
 * Conserto automático do suporte remoto: se o servidor diz, algumas vezes seguidas, que este computador nunca se registrou
 * (nem sequer falou com o servidor de suporte), o app reinicia o programa de acesso remoto. Poucas tentativas e com intervalo,
 * para nunca ficar derrubando o programa em loop.
 */
export const VERIFICACOES_ANTES_DE_TENTAR = 2; // 2 minutos seguidos sem registro
export const MAX_TENTATIVAS = 3;
export const INTERVALO_ENTRE_TENTATIVAS_MS = 3 * 60_000;

export function deveReiniciar(e: { naoRegistradoSeguidos: number; tentativas: number; ultimaTentativaMs: number; agoraMs: number }): boolean {
  return e.naoRegistradoSeguidos >= VERIFICACOES_ANTES_DE_TENTAR && e.tentativas < MAX_TENTATIVAS && e.agoraMs - e.ultimaTentativaMs >= INTERVALO_ENTRE_TENTATIVAS_MS;
}
