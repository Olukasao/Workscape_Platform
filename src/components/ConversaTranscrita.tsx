import { useMemo } from "react";

export interface FalaTranscrita { quem: "atendente" | "cliente"; ini: number; texto: string }

const marca = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

/** Falas seguidas da mesma pessoa, com pouca pausa entre elas, viram um balão só (como numa conversa de chat). */
export function agruparFalas(falas: FalaTranscrita[], pausaMax = 4): { quem: FalaTranscrita["quem"]; ini: number; texto: string }[] {
  const saida: { quem: FalaTranscrita["quem"]; ini: number; fim: number; texto: string }[] = [];
  for (const f of falas) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && ultimo.quem === f.quem && f.ini - ultimo.fim <= pausaMax) { ultimo.texto += ` ${f.texto}`; ultimo.fim = (f as { fim?: number }).fim ?? f.ini; }
    else saida.push({ quem: f.quem, ini: f.ini, fim: (f as { fim?: number }).fim ?? f.ini, texto: f.texto });
  }
  return saida;
}

/** A ligação como um painel de chat: atendente de um lado, cliente do outro, com o minuto de cada fala. */
export default function ConversaTranscrita({ falas, nomeAtendente = "Atendente", nomeCliente = "Cliente" }: { falas: FalaTranscrita[]; nomeAtendente?: string; nomeCliente?: string }) {
  const baloes = useMemo(() => agruparFalas(falas), [falas]);
  if (!baloes.length) return null;
  return (
    <div className="transc-chat" role="log" aria-label="Conversa da ligação">
      {baloes.map((b, i) => (
        <div key={i} className={`transc-msg ${b.quem}`}>
          <span className="transc-quem">{b.quem === "atendente" ? nomeAtendente : nomeCliente} · {marca(b.ini)}</span>
          <p>{b.texto}</p>
        </div>
      ))}
    </div>
  );
}
