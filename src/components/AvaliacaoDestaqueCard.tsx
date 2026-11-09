import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Quote } from "lucide-react";
import { casas, useDestaquesAvaliacao } from "../services/avaliacoes";
import "../styles/avaliacao-destaque.css";

const TROCA_MS = 10_000;

/** Cartão do Início com as avaliações que a administração destacou. Some quando não há nenhuma. */
export default function AvaliacaoDestaqueCard() {
  const navigate = useNavigate();
  const { data } = useDestaquesAvaliacao();
  const [i, setI] = useState(0);
  const total = data?.length ?? 0;
  useEffect(() => {
    if (total < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % total), TROCA_MS);
    return () => window.clearInterval(t);
  }, [total]);
  if (!total) return null;
  const a = data![i % total];
  return (
    <section className="aval-destaque" aria-label="Avaliação do atendimento em destaque">
      <Quote className="aval-destaque-aspas" size={34} aria-hidden="true" />
      <div className="aval-destaque-corpo" key={a.protocolo} aria-live="polite">
        <span className="aval-destaque-estrelas" role="img" aria-label={`${casas(a.nota)} de 5`}>
          {"★".repeat(a.nota)}<i>{"★".repeat(5 - a.nota)}</i>
        </span>
        {a.comentario ? <blockquote>{a.comentario}</blockquote> : <blockquote className="sem">Cliente satisfeito com o atendimento.</blockquote>}
        <p>{a.tecnico ? <>Atendimento de <b>{a.tecnico}</b></> : "Atendimento AcessaNet"}{a.assunto ? ` · ${a.assunto}` : ""}</p>
      </div>
      <footer>
        {total > 1 ? (
          <span className="aval-destaque-pontos" role="tablist" aria-label="Escolher destaque">
            {data!.map((d, k) => (
              <button key={d.protocolo} type="button" role="tab" aria-selected={k === i % total} aria-label={`Destaque ${k + 1} de ${total}`} onClick={() => setI(k)} />
            ))}
          </span>
        ) : <span />}
        <button type="button" className="aval-destaque-ver" onClick={() => navigate("/chamados?aba=avaliacoes")}>Ver avaliações</button>
      </footer>
    </section>
  );
}
