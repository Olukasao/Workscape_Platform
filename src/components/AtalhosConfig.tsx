import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { ACOES_ATALHO, acaoDaCombinacao, combinacaoDoEvento, combinacaoReservada, useAtalhos } from "../services/atalhos";

/** Seção de Configurações: a pessoa clica em "Definir" e aperta a combinação desejada. */
export default function AtalhosConfig() {
  const { mapa, definir, remover, limpar } = useAtalhos();
  const [gravando, setGravando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!gravando) return;
    document.body.dataset.gravandoAtalho = "1";
    const tecla = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setGravando(null); setAviso(""); return; }
      const c = combinacaoDoEvento(e);
      if (!c) { setAviso("Use Ctrl ou Alt junto com outra tecla (ou uma tecla F1 a F12)."); return; }
      if (combinacaoReservada(c)) { setAviso(`${c} já é usado pelo aplicativo ou pelo sistema. Escolha outra.`); return; }
      const outra = acaoDaCombinacao(mapa, c);
      if (outra && outra !== gravando) {
        const nome = ACOES_ATALHO.find((a) => a.id === outra)?.rotulo;
        setAviso(`${c} já está em uso por "${nome}". Remova-o de lá primeiro.`);
        return;
      }
      definir(gravando, c);
      setGravando(null);
      setAviso("");
    };
    window.addEventListener("keydown", tecla, true);
    return () => { window.removeEventListener("keydown", tecla, true); delete document.body.dataset.gravandoAtalho; };
  }, [gravando, mapa, definir]);

  const grupos = [...new Set(ACOES_ATALHO.map((a) => a.grupo))];
  return (
    <section className="panel settings-section" aria-labelledby="atalhos-title">
      <div className="section-title">
        <span className="section-icon"><Keyboard size={17} /></span>
        <div>
          <h2 id="atalhos-title">Atalhos de teclado</h2>
          <p>Crie suas combinações para abrir o telefone, o Chat Interno e outras telas. Clique em “Definir” e aperte as teclas (por exemplo Ctrl + ,). Vale para este computador.</p>
        </div>
      </div>
      {grupos.map((g) => (
        <div key={g} className="atalhos-grupo">
          <h3>{g}</h3>
          {ACOES_ATALHO.filter((a) => a.grupo === g).map((a) => (
            <div key={a.id} className="atalho-linha">
              <span>{a.rotulo}</span>
              {gravando === a.id ? (
                <button type="button" className="atalho-tecla gravando" onClick={() => { setGravando(null); setAviso(""); }}>Aperte as teclas… (Esc cancela)</button>
              ) : (
                <>
                  {mapa[a.id] ? <kbd className="atalho-tecla">{mapa[a.id]}</kbd> : <span className="muted">sem atalho</span>}
                  <button type="button" className="atalho-botao" onClick={() => { setGravando(a.id); setAviso(""); }}>{mapa[a.id] ? "Trocar" : "Definir"}</button>
                  {mapa[a.id] && <button type="button" className="atalho-botao" aria-label={`Remover atalho de ${a.rotulo}`} title="Remover" onClick={() => remover(a.id)}><X size={14} /></button>}
                </>
              )}
            </div>
          ))}
        </div>
      ))}
      {aviso && <p className="atalho-aviso" role="alert">{aviso}</p>}
      <p className="muted">Já usados pelo app e não podem ser trocados: Ctrl K (busca), Ctrl \ (barra lateral) e os de zoom.</p>
      {Object.keys(mapa).length > 0 && <button type="button" className="atalho-botao" onClick={limpar}>Remover todos os atalhos</button>}
    </section>
  );
}
