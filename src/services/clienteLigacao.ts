import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface ChamadoResumo { protocolo: string; tipo: string; metodo: string; status: string; abertoEm: string; encerradoEm: string; assunto: string }
export interface ClienteLigacao {
  contrato: string; contratos?: string[]; nome: string; plano: string; cidade: string; situacao: string;
  chamados: ChamadoResumo[] | null; totalChamados: number | null;
  /** undefined = não deu para consultar; null = o cliente nunca avaliou. */
  ultimaAvaliacao?: { nota: number; comentario: string; respondidoEm: string; tecnico: string } | null;
}
export interface RespostaLigacao { valido: boolean; /** O número veio sem DDD: a pessoa precisa informar. */ semDdd?: boolean; /** Vários DDDs conhecidos para este número: a pessoa escolhe. */ candidatos?: { ddd: string; telefone: string }[]; telefone?: string; encontrado?: boolean; origem?: "vinculo" | "sgp"; cliente?: ClienteLigacao; outrosContratos?: string[] }

/** Quem é o cliente deste número, pelo SGP. Só consulta para número externo (ramal interno não tem cliente). */
export function useClienteLigacao(numero: string, externo: boolean, ddd = "") {
  const limpo = numero.replace(/\D/g, "");
  return useQuery({
    queryKey: ["cliente-ligacao", limpo, ddd],
    queryFn: async () => (await api.get<RespostaLigacao>("/clientes/ligacao", { params: { numero, ...(ddd ? { ddd } : {}) } })).data,
    enabled: externo && limpo.length >= 8,
    // Sempre busca de novo a cada ligação: um chamado aberto agora há pouco precisa aparecer na ficha.
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
}

export function useVincularCliente(numero: string, ddd = "") {
  const cliente = useQueryClient();
  const limpo = numero.replace(/\D/g, "");
  return useMutation({
    mutationFn: async (contrato: string) => (await api.put<RespostaLigacao>("/clientes/ligacao/vinculo", { numero: ddd ? `${ddd}${limpo}` : numero, contrato })).data,
    onSuccess: (dados) => cliente.setQueryData(["cliente-ligacao", limpo, ddd], dados),
  });
}

export const dataCurta = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
