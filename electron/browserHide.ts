/**
 * Quem pediu para esconder a página nativa (Navegador ou versão web da agenda) só pode esconder a SUA.
 * Sem isso, a agenda que sai de cena (e se esconde um instante depois) apagava a página do Navegador que acabou de aparecer,
 * e o contrário também. Sem `somente`, esconde qualquer uma (uso do processo principal).
 */
export type EscopoEsconder = "agendaweb" | "escritorio" | "navegador";
export const deveEsconder = (atual: string | null, somente?: EscopoEsconder): boolean => {
  if (!atual) return false;
  if (somente === "agendaweb") return atual === "agendaweb";
  if (somente === "escritorio") return atual === "escritorio";
  if (somente === "navegador") return atual !== "agendaweb" && atual !== "escritorio";
  return true;
};
