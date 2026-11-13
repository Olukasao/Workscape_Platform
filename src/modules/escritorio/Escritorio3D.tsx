import { useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader } from "../../components/ui/primitives";
import "./escritorio.css";

/**
 * Escritório 3D/2D (projeto Workspace-3d) exibido dentro do Workspace. Só existe no ambiente de testes.
 * O endereço do servidor do Escritório vem de VITE_ESCRITORIO_URL; sem ele usa a mesma máquina do Workspace, porta 8790.
 * No app de Windows a página incorporada é bloqueada de propósito (CSP com frame-src 'none'), então lá só há um aviso.
 */
const origem = (import.meta.env.VITE_ESCRITORIO_URL as string | undefined)?.replace(/\/+$/, "")
  || `${window.location.protocol}//${window.location.hostname}:8790`;

type Estado = "verificando" | "no-ar" | "fora";

export default function Escritorio3D() {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [versao, setVersao] = useState(0);
  const noApp = !!window.desktop;

  const verificar = useCallback(async () => {
    setEstado("verificando");
    try {
      // no-cors: só interessa saber se o servidor responde.
      await fetch(`${origem}/api/health`, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4000) });
      setEstado("no-ar");
    } catch {
      setEstado("fora");
    }
  }, []);
  useEffect(() => { if (!noApp) void verificar(); }, [noApp, verificar]);

  return (
    <div className="page escritorio-page">
      <PageHeader
        icon={Building2}
        title="Escritório"
        description="A planta do escritório com quem está em cada mesa (versão de testes)."
        actions={!noApp ? (
          <div className="escritorio-acoes">
            <button type="button" className="btn" onClick={() => { setVersao((v) => v + 1); void verificar(); }}><RefreshCw size={14} /> Recarregar</button>
            <a className="btn" href={origem} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir em outra aba</a>
          </div>
        ) : undefined}
      />
      {noApp ? (
        <div className="escritorio-aviso" role="status">
          O Escritório ainda não abre dentro do aplicativo de Windows. Para testar, abra o Workspace de testes no navegador (porta 5181).
        </div>
      ) : estado === "fora" ? (
        <div className="escritorio-aviso" role="alert">
          O servidor do Escritório não respondeu em {origem}. <button type="button" className="btn" onClick={() => void verificar()}>Tentar de novo</button>
        </div>
      ) : estado === "no-ar" ? (
        <iframe key={versao} className="escritorio-frame" title="Escritório" src={origem} allow="fullscreen" />
      ) : (
        <div className="escritorio-aviso" role="status">Conectando ao Escritório…</div>
      )}
    </div>
  );
}
