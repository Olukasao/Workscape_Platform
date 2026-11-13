import { useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/primitives";
import "./escritorio.css";

/**
 * Escritório 3D/2D (projeto Workspace-3d) exibido dentro do Workspace. Só existe no ambiente de testes.
 * A entrada é automática: o chat interno entrega um bilhete de uso único (login único) com o endereço do Escritório.
 * No app de Windows a página incorporada é bloqueada de propósito (CSP com frame-src 'none'), então lá só há um aviso.
 */
type Estado = "verificando" | "no-ar" | "fora" | "desligado";

export default function Escritorio3D() {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [destino, setDestino] = useState<{ url: string; origem: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const noApp = !!window.desktop;

  const abrir = useCallback(async () => {
    setEstado("verificando");
    try {
      const r = (await api.get<{ ativo: boolean; url?: string; origem?: string }>("/escritorio/sso")).data;
      if (!r.ativo || !r.url || !r.origem) { setEstado("desligado"); return; }
      // no-cors: só interessa saber se o servidor do Escritório responde.
      await fetch(`${r.origem}/api/health`, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4000) });
      setDestino({ url: r.url, origem: r.origem });
      setEstado("no-ar");
    } catch {
      setEstado("fora");
    }
  }, []);
  useEffect(() => { if (!noApp) void abrir(); }, [noApp, abrir]);

  return (
    <div className="page escritorio-page">
      <PageHeader
        icon={Building2}
        title="Escritório"
        description="A planta do escritório com quem está em cada mesa (versão de testes)."
        actions={!noApp ? (
          <div className="escritorio-acoes">
            <button type="button" className="btn" onClick={() => { setVersao((v) => v + 1); void abrir(); }}><RefreshCw size={14} /> Recarregar</button>
            {destino ? <a className="btn" href={destino.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir em outra aba</a> : null}
          </div>
        ) : undefined}
      />
      {noApp ? (
        <div className="escritorio-aviso" role="status">
          O Escritório ainda não abre dentro do aplicativo de Windows. Para testar, abra o Workspace de testes no navegador (porta 5181).
        </div>
      ) : estado === "fora" ? (
        <div className="escritorio-aviso" role="alert">
          O servidor do Escritório não respondeu. <button type="button" className="btn" onClick={() => void abrir()}>Tentar de novo</button>
        </div>
      ) : estado === "desligado" ? (
        <div className="escritorio-aviso" role="status">A ligação com o Escritório está desligada no servidor do chat.</div>
      ) : estado === "no-ar" && destino ? (
        <iframe key={versao} className="escritorio-frame" title="Escritório" src={destino.url} allow="fullscreen" />
      ) : (
        <div className="escritorio-aviso" role="status">Conectando ao Escritório…</div>
      )}
    </div>
  );
}
