import { api } from "./api";

/** Transcrição de uma ligação do próprio atendente (o servidor transcreve depois da chamada e apaga o áudio). */
export interface TranscricaoLigacao {
  id: number; numero: string; direcao: "in" | "out"; inicioMs: number; duracaoSeg: number;
  status: "fila" | "transcrevendo" | "pronta" | "erro" | "sem_fala"; resumo: string | null; motivo: string | null;
  falas: { quem: "atendente" | "cliente"; ini: number; texto: string }[];
}

export async function buscarTranscricoes(numero: string): Promise<TranscricaoLigacao[]> {
  const r = await api.get<{ transcricoes: TranscricaoLigacao[] }>("/phone/transcricoes", { params: { numero } });
  return r.data.transcricoes;
}

/** Texto curto para a nota interna da conversa: resumo e motivo sugerido (a conversa inteira fica na ficha do cliente). */
export function notaDaTranscricao(t: Pick<TranscricaoLigacao, "resumo" | "motivo">): string {
  return `Resumo da ligação (transcrição automática): ${t.resumo ?? "sem resumo"}${t.motivo ? `\nMotivo sugerido: ${t.motivo}` : ""}`;
}
