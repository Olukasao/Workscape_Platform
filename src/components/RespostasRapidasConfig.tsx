import { useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { NOME_VALIDO, normalizarNome, useRespostasRapidas } from "../services/respostasRapidas";

/** Seção de Configurações: cada pessoa cria suas respostas prontas para o Chat Interno. */
export default function RespostasRapidasConfig() {
  const { respostas, salvar, remover } = useRespostasRapidas();
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const n = normalizarNome(nome);
    if (!NOME_VALIDO.test(n)) { setErro("O atalho deve ter de 1 a 24 letras, números, - ou _ (sem espaços)."); return; }
    if (!texto.trim()) { setErro("Escreva o texto da resposta."); return; }
    salvar({ nome: n, texto: texto.trim() });
    setNome(""); setTexto(""); setErro("");
  };
  return (
    <section className="panel settings-section" aria-labelledby="respostas-title">
      <div className="section-title">
        <span className="section-icon"><MessageSquareText size={17} /></span>
        <div>
          <h2 id="respostas-title">Respostas rápidas do chat</h2>
          <p>No Chat Interno, digite <b>/atalho</b> e aperte Espaço, Tab ou Enter para trocar pelo texto pronto. Ficam salvas neste computador.</p>
        </div>
      </div>
      <form className="respostas-form" onSubmit={adicionar}>
        <input aria-label="Atalho" placeholder="atalho (ex.: bomdia)" value={nome} maxLength={25} onChange={(e) => setNome(e.target.value)} />
        <textarea aria-label="Texto da resposta" placeholder="Texto que será inserido" value={texto} maxLength={2000} rows={2} onChange={(e) => setTexto(e.target.value)} />
        <button type="submit" className="atalho-botao">Salvar resposta</button>
      </form>
      {erro && <p className="atalho-aviso" role="alert">{erro}</p>}
      {respostas.length === 0 ? <p className="muted">Nenhuma resposta criada ainda.</p> : respostas.map((r) => (
        <div key={r.nome} className="atalho-linha">
          <kbd className="atalho-tecla">/{r.nome}</kbd>
          <span className="respostas-texto">{r.texto}</span>
          <button type="button" className="atalho-botao" aria-label={`Apagar /${r.nome}`} title="Apagar" onClick={() => remover(r.nome)}><X size={14} /></button>
        </div>
      ))}
    </section>
  );
}
