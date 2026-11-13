import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/primitives";
import { useSobreposicao } from "../../services/sobreposicao";
import "./escritorio.css";

/**
 * Escritório 3D/2D (projeto Workspace-3d) exibido dentro do Workspace. Só existe no ambiente de testes.
 * A entrada é automática: o chat interno entrega um bilhete de uso único (login único) com o endereço do Escritório.
 * - Navegador: a página vai num iframe.
 * - App de Windows: a CSP bloqueia páginas incorporadas de propósito (frame-src 'none'); por isso o app usa uma visão
 *   nativa do Electron posta sobre a área vazia (mesmo método da Agenda web), com sessão própria e restrita à origem do Escritório.
 */
type Estado = "verificando" | "no-ar" | "fora" | "desligado";
type Sso = { ativo: boolean; url?: string; origem?: string };

// A visão nativa continua viva ao sair da aba; só pedimos bilhete novo depois de um tempo ou pelo botão Recarregar.
const REABRIR_APOS_MS = 20 * 60_000;
let abertoEm = 0;

export default function Escritorio3D() {
  const noApp = !!window.desktop?.escritorioAbrir;
  const area = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<Estado>("verificando");
  const [destino, setDestino] = useState<{ url: string; origem: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [pronta, setPronta] = useState(false);
  const coberta = useSobreposicao((s) => s.paleta || s.chamada);

  const abrir = useCallback(async () => {
    setEstado("verificando");
    try {
      const r = (await api.get<Sso>("/escritorio/sso")).data;
      if (!r.ativo || !r.url || !r.origem) { setEstado("desligado"); return; }
      if (window.desktop?.escritorioAbrir) {
        await window.desktop.escritorioAbrir(r.url);
        abertoEm = Date.now();
        setDestino({ url: r.url, origem: r.origem });
        setPronta(true);
        setEstado("no-ar");
        return;
      }
      // no-cors: só interessa saber se o servidor do Escritório responde.
      await fetch(`${r.origem}/api/health`, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4000) });
      setDestino({ url: r.url, origem: r.origem });
      setEstado("no-ar");
    } catch {
      setEstado("fora");
    }
  }, []);

  useEffect(() => {
    // No app, a visão já aberta há pouco tempo é reaproveitada (não perde o lugar nem a câmera).
    if (noApp && abertoEm && Date.now() - abertoEm < REABRIR_APOS_MS) { setPronta(true); setEstado("no-ar"); return; }
    void abrir();
  }, [noApp, abrir]);

  // Navegador: o Escritório não tem login; se a sessão dele vencer, ele pede aqui um bilhete novo (no máximo um a cada 20 s).
  useEffect(() => {
    if (noApp) return;
    let ultimo = 0;
    const ouvir = (e: MessageEvent) => {
      if (!destino || e.origin !== destino.origem || (e.data as { type?: string } | null)?.type !== "office3d:sessao-expirou") return;
      if (Date.now() - ultimo < 20_000) return;
      ultimo = Date.now();
      setVersao((v) => v + 1);
      void abrir();
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [noApp, destino, abrir]);

  // App: mostra a visão nativa sobre a área e a acompanha quando a janela muda de tamanho; some quando algo cobre a tela.
  const visivel = noApp && pronta && estado === "no-ar" && !coberta;
  useEffect(() => {
    const desktop = window.desktop;
    if (!noApp || !desktop) return;
    if (!visivel) { void desktop.browserHide({ somente: "escritorio" }); return; }
    const el = area.current;
    if (!el) return;
    const medir = () => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    void desktop.browserShow({ site: "escritorio", bounds: medir() });
    const sync = () => void desktop.browserBounds(medir());
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener("resize", sync);
    return () => { observer.disconnect(); window.removeEventListener("resize", sync); };
  }, [noApp, visivel]);
  // A página nativa nunca pode ficar solta por cima do app ao sair desta tela.
  useEffect(() => () => void window.desktop?.browserHide({ somente: "escritorio" }), []);

  return (
    <div className="page escritorio-page">
      <PageHeader
        icon={Building2}
        title="Escritório"
        description="A planta do escritório com quem está em cada mesa (versão de testes)."
        actions={
          <div className="escritorio-acoes">
            <button type="button" className="btn" onClick={() => { setVersao((v) => v + 1); void abrir(); }}><RefreshCw size={14} /> Recarregar</button>
            {!noApp && destino ? <a className="btn" href={destino.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir em outra aba</a> : null}
          </div>
        }
      />
      {estado === "fora" ? (
        <div className="escritorio-aviso" role="alert">
          O servidor do Escritório não respondeu. <button type="button" className="btn" onClick={() => void abrir()}>Tentar de novo</button>
        </div>
      ) : estado === "desligado" ? (
        <div className="escritorio-aviso" role="status">A ligação com o Escritório está desligada no servidor do chat.</div>
      ) : estado === "verificando" ? (
        <div className="escritorio-aviso" role="status">Conectando ao Escritório…</div>
      ) : noApp ? (
        <div className="escritorio-frame" ref={area} aria-label="Escritório" />
      ) : destino ? (
        <iframe key={versao} className="escritorio-frame" title="Escritório" src={destino.url} allow="fullscreen" />
      ) : null}
    </div>
  );
}
