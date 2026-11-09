import { useEffect } from "react";
import { create } from "zustand";
import { clients } from "./api";
import { socket } from "./socket";
import type { PhoneCall as Chamada } from "../../electron/phone";
import { numeroUtil } from "./chamador";
import { chamadaReal, VALIDADE_MS, type Transferida } from "./transferenciaChamada";

// Transferência de cliente entre ramais. A central só manda "asterisk" para quem recebe a chamada transferida, então
// quem transfere avisa o servidor (cliente + ramal de destino) e o servidor avisa o destino: a ficha abre com o cliente de verdade.
interface Estado { itens: Transferida[]; add: (t: Transferida) => void }
export const useTransferencias = create<Estado>((set) => ({
  itens: [],
  add: (t) => set((s) => ({ itens: [...s.itens.filter((i) => Date.now() - i.em < VALIDADE_MS), t].slice(-5) })),
}));

/** Quem transfere: avisa o ramal de destino qual cliente está indo. Falhar aqui nunca atrapalha a transferência. */
export function avisarTransferencia(numeroDoCliente: string, destino: string) {
  // Cliente (telefone) ou colega (ramal): quem recebe mostra o nome certo nos dois casos. Sem número, não há o que avisar.
  if (!numeroUtil(numeroDoCliente)) return;
  void clients.chat.post("/phone/transferencia", { numero: numeroDoCliente, destino }).catch(() => undefined);
}

/** Quem recebe: guarda o aviso do servidor. Montar uma vez (TelefoneMotor). */
export function useReceberTransferencias(ativo: boolean) {
  const add = useTransferencias((s) => s.add);
  useEffect(() => {
    if (!ativo) return;
    const ao = (p?: { numero?: string; de?: string; em?: number }) => { if (p?.numero) add({ numero: String(p.numero), de: String(p.de || ""), em: Date.now() }); };
    socket.on("phone:transferida", ao);
    return () => { socket.off("phone:transferida", ao);};
  }, [ativo, add]);
}

export const useChamadaReal = (c: Chamada) => chamadaReal(c, useTransferencias((s) => s.itens));
