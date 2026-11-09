import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutList, ExternalLink, PanelTopClose, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { clsx } from "clsx";
import type { BrowserState } from "../../../electron/browserTabs";
import { agendaSessionToken } from "../../services/api";
import { criarRenovador, RENOVAR_A_CADA_MS } from "../../services/agendaWebSessao";
import { useSobreposicao } from "../../services/sobreposicao";
import { JANELA_DESTACADA, destacar, podeDestacar, reintegrar } from "../../services/janelaDestacada";

/**
 * A agenda original (versão web) exibida dentro do app, igual ao navegador: é a própria página do servidor da
 * agenda numa visão nativa, com a sessão do usuário. Não abre o navegador do sistema.
 */
export default function AgendaWeb({ active, onBack }: { active: boolean; onBack: () => void }) {
  const area = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<BrowserState | null>(null);
  const [aviso, setAviso] = useState("");
  const [pronta, setPronta] = useState(false);
  const paleta = useSobreposicao((s) => s.paleta || s.chamada);
  const visible = active && !paleta && pronta;

  const bounds = useCallback(() => {
    const r = area.current?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, []);

  useEffect(() => window.desktop?.onBrowserState((s) => s.site === "agendaweb" && setState(s)), []);

  // Entrega a sessão do usuário à página antes de mostrá-la e a mantém renovada enquanto a agenda estiver aberta;
  // sem isso a sessão vencia depois de algumas horas e as alterações saíam sem o nome de quem as fez.
  useEffect(() => {
    let ativo = true;
    const renovar = criarRenovador({
      obterToken: agendaSessionToken,
      entregar: (token) => window.desktop?.agendaWebSession({ token }) ?? Promise.resolve(),
      aoSucesso: () => ativo && setAviso(""),
      aoFalhar: () => ativo && setAviso("Não foi possível identificar seu usuário na versão web; as alterações podem não ficar no seu nome. Entre novamente no Workspace."),
    });
    void renovar().finally(() => ativo && setPronta(true));
    const timer = window.setInterval(() => void renovar(), RENOVAR_A_CADA_MS);
    const aoVoltar = () => { if (document.visibilityState === "visible") void renovar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      ativo = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, []);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    if (!visible) {
      void desktop.browserHide({ somente: "agendaweb" });
      return;
    }
    const b = bounds();
    if (b) void desktop.browserShow({ site: "agendaweb", bounds: b });
    const el = area.current;
    if (!el) return;
    const sync = () => {
      const next = bounds();
      if (next) void desktop.browserBounds(next);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [visible, bounds]);
  // A página nativa nunca pode ficar solta por cima do app ao sair desta tela.
  useEffect(() => () => void window.desktop?.browserHide({ somente: "agendaweb" }), []);

  const act = (action: "reload" | "zoomIn" | "zoomOut" | "zoomReset") =>
    void window.desktop?.browserAction({ site: "agendaweb", action });

  return (
    <div className="navegador agenda-web">
      <div className="navegador-bar">
        <button type="button" className="navegador-janela" onClick={onBack} title="Muda para a versão minimalista, a agenda do próprio aplicativo">
          <LayoutList size={15} /> Versão minimalista
        </button>
        <strong className="agenda-web-titulo">Agenda técnica · versão web</strong>
        {aviso ? <span className="agenda-web-aviso" role="status">{aviso}</span> : null}
        <div className="navegador-endereco" style={{ flex: "0 0 auto", minWidth: 0 }}>
          <button type="button" aria-label="Recarregar" onClick={() => act("reload")}>
            <RefreshCw size={15} className={clsx(state?.loading && "girando")} />
          </button>
        </div>
        {JANELA_DESTACADA === "agenda" ? (
          <button type="button" className="navegador-janela" onClick={() => reintegrar("agenda")} title="Fecha esta janela e devolve a agenda ao Workspace">
            <PanelTopClose size={15} /> Reintegrar
          </button>
        ) : podeDestacar() ? (
          <button type="button" className="navegador-janela" onClick={() => destacar("agenda")} title="Abre a agenda em uma janela separada, que pode ficar em outro monitor">
            <ExternalLink size={15} /> Destacar
          </button>
        ) : null}
        <div className="navegador-zoom" role="group" aria-label="Zoom da página">
          <button type="button" aria-label="Diminuir zoom" title="Diminuir zoom (Ctrl −)" onClick={() => act("zoomOut")}>
            <ZoomOut size={16} />
          </button>
          <button type="button" className="navegador-zoom-valor" title="Voltar para o padrão, 75% (Ctrl 0)" onClick={() => act("zoomReset")}>
            {state?.zoom ?? 75}%
          </button>
          <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom (Ctrl +)" onClick={() => act("zoomIn")}>
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
      <div className="navegador-area" ref={area} />
    </div>
  );
}
