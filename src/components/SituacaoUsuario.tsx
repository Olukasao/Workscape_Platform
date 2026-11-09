import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, CircleDot } from "lucide-react";
import { useMudarSituacao, useSituacoes } from "../services/situacao";
import { useSession } from "../stores/workspace";

const DURACOES: [string, number][] = [["30 min", 30], ["1 hora", 60], ["Até eu mudar", 0]];

/** Menu da barra lateral: a pessoa diz o que está fazendo (almoço, visita…) e os colegas veem no chat e nos ramais. */
export default function SituacaoUsuario() {
  const user = useSession((s) => s.user);
  const { opcoes, mapa, rotuloDe } = useSituacoes();
  const mudar = useMudarSituacao();
  const [aberto, setAberto] = useState(false);
  const [minutos, setMinutos] = useState(60);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  if (!user || !Object.keys(opcoes).length) return null;
  const atual = mapa.get(user.id)?.situacao ?? null;
  const rotulo = rotuloDe(user.id) || "Disponível";
  const escolher = (situacao: string | null) => { mudar.mutate({ situacao, minutos: situacao ? minutos : undefined }); setAberto(false); };
  return (
    <div className="situacao" ref={raiz}>
      <button type="button" className="situacao-botao" data-tip={`Situação: ${rotulo}`} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <CircleDot size={15} aria-hidden="true" data-ativa={atual ? "1" : undefined} />
        <span className="nav-text">{rotulo}</span>
        <ChevronUp size={14} aria-hidden="true" className="nav-text" />
      </button>
      {aberto ? (
        <div className="situacao-menu" role="menu" aria-label="Minha situação">
          <button type="button" role="menuitemradio" aria-checked={!atual || atual === "ligacao"} onClick={() => escolher(null)}>Disponível {!atual ? <Check size={14} aria-hidden="true" /> : null}</button>
          {Object.entries(opcoes).map(([id, nome]) => (
            <button type="button" key={id} role="menuitemradio" aria-checked={atual === id} onClick={() => escolher(id)}>{nome} {atual === id ? <Check size={14} aria-hidden="true" /> : null}</button>
          ))}
          <div className="situacao-duracao" role="group" aria-label="Por quanto tempo">
            {DURACOES.map(([nome, m]) => (
              <button type="button" key={m} aria-pressed={minutos === m} onClick={() => setMinutos(m)}>{nome}</button>
            ))}
          </div>
          <small>Em ligação aparece sozinho enquanto você está no telefone.</small>
        </div>
      ) : null}
    </div>
  );
}
