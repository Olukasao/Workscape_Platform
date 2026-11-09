import { nomeGenerico } from "./chamador";
import type { PhoneCall as Chamada } from "../../electron/phone";

// Parte pura (sem rede nem estado) da transferência de cliente entre ramais; testável sozinha.
export const VALIDADE_MS = 90_000;
export interface Transferida { numero: string; de: string; em: number }

/**
 * Se esta chamada que chega é a do cliente transferido (identidade genérica da central: sem número ou "asterisk" e
 * um aviso recente de transferência), devolve a chamada com o número do cliente. Senão, devolve a mesma chamada.
 */
export function chamadaReal(c: Chamada, itens: Transferida[], agora = Date.now()): Chamada {
  if (c.direcao !== "in" || c.estado === "encerrada") return c;
  if (c.numero.trim() && !nomeGenerico(c.nome)) return c;
  const t = [...itens].reverse().find((i) => agora - i.em < VALIDADE_MS);
  return t ? { ...c, numero: t.numero, nome: "" } : c;
}

