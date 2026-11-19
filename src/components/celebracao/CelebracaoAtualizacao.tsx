import { useEffect, useRef, useState } from "react";
import { PartyPopper, X } from "lucide-react";

// Tela cheia de comemoração (com bastante fogos de artifício), mostrada uma única vez por computador,
// assim que o Workspace abre pela primeira vez depois desta atualização. Independente do changelog e do
// aviso de "Novidades da versão": serve para um anúncio pontual, sem precisar registrar nada no histórico.
// Para anunciar outra coisa no futuro, troque VERSAO (para a versão nova) e o texto abaixo.
const VERSAO = "0.6.71";
const CHAVE = `workspace:celebrar-atualizacao:${VERSAO}`;
const TITULO = "Corrigido o bug do MicroSIP que causava ruído";
const SUBTITULO = "Seu Workspace acabou de atualizar.";
const DURACAO_MS = 11000;

const jaViu = () => {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return true; // sem armazenamento: não insiste a cada abertura
  }
};
const marcarVisto = () => {
  try {
    localStorage.setItem(CHAVE, "1");
  } catch {
    /* sem armazenamento: tudo bem, só não lembra entre sessões */
  }
};
const semMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// Eventos que indicam alguém de fato na frente do computador (não só a janela existindo em segundo plano).
const EVENTOS_PRESENCA = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"] as const;

export default function CelebracaoAtualizacao() {
  const [mostrar, setMostrar] = useState(false);
  const palco = useRef<HTMLDivElement>(null);

  // A atualização é silenciosa: o Workspace reinicia sozinho com a janela minimizada ou com a pessoa parada
  // (ausente) há alguns minutos. Se a comemoração aparecesse nesse instante, ela "queimaria" a única exibição
  // sem ninguém ver. Por isso só mostra quando a aba está visível E alguém mexeu no mouse/teclado depois que
  // o Workspace abriu — ou, se já estava visível e em foco na hora (uso normal, sem reinício escondido), mostra
  // direto, sem esperar.
  useEffect(() => {
    if (jaViu()) return;
    let cancelado = false;
    let exibida = false;

    const tentar = () => {
      if (exibida || cancelado || document.visibilityState !== "visible") return;
      exibida = true;
      marcarVisto();
      setMostrar(true);
    };
    const ouvir = () => tentar();
    for (const ev of EVENTOS_PRESENCA) window.addEventListener(ev, ouvir, { passive: true });
    document.addEventListener("visibilitychange", ouvir);

    if (document.visibilityState === "visible" && document.hasFocus()) tentar();

    return () => {
      cancelado = true;
      for (const ev of EVENTOS_PRESENCA) window.removeEventListener(ev, ouvir);
      document.removeEventListener("visibilitychange", ouvir);
    };
  }, []);

  // Enquanto está mostrando: se a pessoa minimizar ou trocar de janela no meio, pausa a contagem para
  // fechar — ela não perde o resto da comemoração por ter saído um instante.
  useEffect(() => {
    if (!mostrar) return;
    let restanteMs = DURACAO_MS;
    let inicio = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const agendar = () => {
      inicio = performance.now();
      timer = setTimeout(() => setMostrar(false), restanteMs);
    };
    const pausar = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      restanteMs = Math.max(1500, restanteMs - (performance.now() - inicio));
    };
    const aoMudarVisibilidade = () => (document.visibilityState === "visible" ? agendar() : pausar());

    if (document.visibilityState === "visible") agendar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [mostrar]);

  useEffect(() => {
    if (!mostrar || semMovimento() || !palco.current) return;
    const alvo = palco.current;
    let desmontar: (() => void) | undefined;
    let cancelado = false;
    // Bastante fogos: quantidade bem acima da comemoração de venda normal, espalhados por mais tempo.
    void import("./fogosScene").then(({ iniciarFogos }) => {
      if (!cancelado) desmontar = iniciarFogos(alvo, 0, () => undefined, { quantidade: 46, duracaoLancamentos: 7.5, duracaoMax: DURACAO_MS / 1000 });
    }).catch(() => undefined);
    return () => {
      cancelado = true;
      desmontar?.();
    };
  }, [mostrar]);

  if (!mostrar) return null;
  return (
    <div className="atualizacao-camada" role="status" aria-live="polite">
      <div ref={palco} className="atualizacao-palco" aria-hidden="true" />
      <div className="atualizacao-cartao">
        <button type="button" className="atualizacao-fechar" aria-label="Fechar" onClick={() => setMostrar(false)}>
          <X size={16} />
        </button>
        <span className="atualizacao-icone" aria-hidden="true">
          <PartyPopper size={30} strokeWidth={2} />
        </span>
        <strong>{TITULO}</strong>
        <small>{SUBTITULO}</small>
      </div>
    </div>
  );
}
