import { useState } from "react";
import { BellRing } from "lucide-react";
import { AVISOS_TESTE, dispararAvisoTeste, type AvisoTeste, type ResultadoTeste } from "../services/avisosTeste";

// Administração > Teste de avisos: um botão por aviso que existe no Workspace. Cada clique mostra o aviso com dados de exemplo
// neste computador (pop-up no canto da tela e item no sino), marcado como [TESTE]. Nada vai para outras pessoas nem é gravado.
const tomRotulo: Record<string, string> = { crit: "vermelho", warn: "âmbar", info: "azul", novo: "verde" };

export default function ControleTesteAvisos() {
  const [ultimo, setUltimo] = useState("");
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const grupos = [...new Set(AVISOS_TESTE.map((a) => a.grupo))];
  const testar = async (a: AvisoTeste) => {
    setUltimo(a.rotulo);
    setResultado(await dispararAvisoTeste(a));
  };
  return (
    <section className="versoes iaadm" aria-labelledby="testeavisos-titulo">
      <header className="versoes-topo">
        <div>
          <h2 id="testeavisos-titulo"><BellRing size={18} aria-hidden="true" /> Teste de avisos</h2>
          <p className="muted">Clique para ver como cada aviso do Workspace aparece. É só uma simulação neste computador, com dados de exemplo: ninguém mais recebe e nada é gravado.</p>
        </div>
      </header>
      {ultimo && resultado?.estado === "recusado" ? <p role="alert" className="iaadm-erro">“{ultimo}”: o Windows recusou o pop-up ({resultado.motivo}). O aviso entrou só no sino.</p> : null}
      {ultimo && resultado?.estado === "sem-app" ? <p role="status" className="muted iaadm-nota">“{ultimo}” entrou no sino. O pop-up do canto da tela só aparece no aplicativo do Windows.</p> : null}
      {ultimo && resultado?.estado === "ok" ? <p role="status" className="muted iaadm-nota">Enviado: “{ultimo}”. Veja o canto da tela e o sino.</p> : null}
      {grupos.map((g) => (
        <div key={g}>
          <h3 className="iaadm-h">{g}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {AVISOS_TESTE.filter((a) => a.grupo === g).map((a) => (
              <button key={a.id} type="button" className="btn" onClick={() => void testar(a)} title={`${a.titulo}${a.tom ? ` · destaque ${tomRotulo[a.tom]}` : ""}`} data-testid={`teste-aviso-${a.id}`}>
                {a.rotulo}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
