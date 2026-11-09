import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Globe, Home, RefreshCw, Network, Sparkles, Router, Activity, ChartLine, Headset, ZoomIn, ZoomOut, ExternalLink, PanelTopClose } from "lucide-react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { BrowserSite, BrowserState } from "../../electron/browserTabs";
import { EVENTO_SITE_NAVEGADOR } from "../services/navegadorInterno";
import { JANELA_DESTACADA, destacar, reintegrar, podeDestacar } from "../services/janelaDestacada";

// Quais sites aparecem vem do servidor (Admin > Navegador): cada setor vê os que o administrador liberou. Os endereços dos
// sites padrão ficam no processo principal; os extras seguem do servidor e são revalidados lá.
const ICONES: Record<string, typeof Globe> = { sgp: Network, mundiale: Sparkles, olt: Router, callcenter: Headset, zabbix: Activity, grafana: ChartLine, comum: Globe };
const PADRAO: { id: string; nome: string }[] = [
  { id: "sgp", nome: "SGP" }, { id: "mundiale", nome: "Mundiale" }, { id: "olt", nome: "OLT" }, { id: "callcenter", nome: "Call Center" },
  { id: "zabbix", nome: "Zabbix" }, { id: "grafana", nome: "Grafana" }, { id: "comum", nome: "Navegador comum" },
];
interface SiteDoServidor { id: string; nome: string; url?: string; personalizado: boolean }

function useSitesDoNavegador() {
  const q = useQuery({
    queryKey: ["navegador", "sites"],
    queryFn: async () => (await api.get<{ sites: SiteDoServidor[] }>("/navegador/sites")).data.sites,
    staleTime: 60_000,
    retry: 1,
  });
  const [pronto, setPronto] = useState(false);
  const lista = q.data;
  useEffect(() => {
    if (q.isLoading) return;
    // O processo principal precisa conhecer os sites extras antes de a página abrir.
    const extras = (lista ?? []).filter((x) => x.personalizado && x.url).map((x) => ({ id: x.id, label: x.nome, url: x.url! }));
    void Promise.resolve(window.desktop?.browserSites?.(extras)).catch(() => undefined).finally(() => setPronto(true));
  }, [lista, q.isLoading]);
  // Sem resposta do servidor, mostra os sites padrão em vez de deixar o Navegador vazio.
  const sites = (lista ?? PADRAO.map((x) => ({ ...x, personalizado: false }))).map((x) => ({ id: x.id, label: x.nome, icon: ICONES[x.id] ?? Globe }));
  return { sites, pronto };
}

/**
 * A página em si é uma visão nativa do Electron posta sobre a área vazia abaixo da barra.
 * O componente fica montado depois da primeira visita: ao trocar de aba do Workspace a
 * visão só é escondida e a página continua exatamente como estava.
 */
export default function Navegador({ active, paused }: { active: boolean; paused: boolean }) {
  const { sites: SITES, pronto } = useSitesDoNavegador();
  const [escolhido, setEscolhido] = useState<BrowserSite>("sgp");
  // Se o site escolhido não está liberado para o setor, abre o primeiro que estiver.
  const site = (SITES.some((x) => x.id === escolhido) ? escolhido : (SITES[0]?.id ?? "sgp")) as BrowserSite;
  const setSite = setEscolhido;
  const [states, setStates] = useState<Partial<Record<BrowserSite, BrowserState>>>({});
  const [draft, setDraft] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  // Atalhos de outros módulos (ex.: Pré-cadastro) pedem para mostrar um site específico.
  useEffect(() => {
    const trocar = (e: Event) => { setSite((e as CustomEvent<BrowserSite>).detail); setDraft(null); };
    window.addEventListener(EVENTO_SITE_NAVEGADOR, trocar);
    return () => window.removeEventListener(EVENTO_SITE_NAVEGADOR, trocar);
  }, []);
  const state = states[site];
  const visible = active && !paused && pronto && SITES.length > 0;

  const bounds = useCallback(() => {
    const r = area.current?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, []);

  useEffect(() => window.desktop?.onBrowserState((s) => setStates((p) => ({ ...p, [s.site]: s }))), []);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    if (!visible) {
      void desktop.browserHide();
      return;
    }
    const b = bounds();
    if (b) void desktop.browserShow({ site, bounds: b });
    const el = area.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const next = bounds();
      if (next) void desktop.browserBounds(next);
    });
    observer.observe(el);
    const onResize = () => {
      const next = bounds();
      if (next) void desktop.browserBounds(next);
    };
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [visible, site, bounds]);
  // Ao sair da tela (desmontar) a visão nativa nunca pode ficar solta por cima do app.
  useEffect(() => () => void window.desktop?.browserHide(), []);

  const act = (action: "back" | "forward" | "reload" | "home" | "zoomIn" | "zoomOut" | "zoomReset") =>
    void window.desktop?.browserAction({ site, action });
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft?.trim()) void window.desktop?.browserAction({ site, action: "go", value: draft.trim() });
    setDraft(null);
  };

  return (
    <div className="navegador">
      <div className="navegador-bar">
        <div className="navegador-sites" role="tablist" aria-label="Sites">
          {SITES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={site === s.id}
              className={clsx("navegador-site", site === s.id && "on")}
              onClick={() => {
                setSite(s.id as BrowserSite);
                setDraft(null);
              }}
            >
              <s.icon size={15} />
              {s.label}
            </button>
          ))}
        </div>
        <form className="navegador-endereco" onSubmit={go}>
          <button type="button" aria-label="Voltar" disabled={!state?.canBack} onClick={() => act("back")}>
            <ArrowLeft size={16} />
          </button>
          <button type="button" aria-label="Avançar" disabled={!state?.canForward} onClick={() => act("forward")}>
            <ArrowRight size={16} />
          </button>
          <button type="button" aria-label="Recarregar" onClick={() => act("reload")}>
            <RefreshCw size={15} className={clsx(state?.loading && "girando")} />
          </button>
          <button type="button" aria-label="Página inicial" onClick={() => act("home")}>
            <Home size={15} />
          </button>
          <input
            aria-label="Endereço"
            spellCheck={false}
            value={draft ?? state?.url ?? ""}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => setDraft(null)}
            placeholder="Digite um endereço ou pesquise"
          />
        </form>
        {JANELA_DESTACADA === "navegador" ? (
          <button type="button" className="navegador-janela" onClick={() => reintegrar("navegador")} title="Fecha esta janela e devolve o navegador ao Workspace">
            <PanelTopClose size={15} /> Reintegrar
          </button>
        ) : podeDestacar() ? (
          <button type="button" className="navegador-janela" onClick={() => destacar("navegador")} title="Abre o navegador em uma janela separada, que pode ficar em outro monitor">
            <ExternalLink size={15} /> Destacar
          </button>
        ) : null}
        <div className="navegador-zoom" role="group" aria-label="Zoom da página">
          <button type="button" aria-label="Diminuir zoom" title="Diminuir zoom (Ctrl −)" onClick={() => act("zoomOut")}>
            <ZoomOut size={16} />
          </button>
          <button type="button" className="navegador-zoom-valor" title="Voltar para 100% (Ctrl 0)" onClick={() => act("zoomReset")}>
            {state?.zoom ?? 100}%
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
