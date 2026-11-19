import { useEffect, useRef, useState } from "react";
import { PartyPopper, X } from "lucide-react";

// Tela cheia de comemoração (com bastante fogos de artifício), mostrada uma única vez por computador,
// assim que o Workspace abre pela primeira vez depois desta atualização. Independente do changelog e do
// aviso de "Novidades da versão": serve para um anúncio pontual, sem precisar registrar nada no histórico.
// Para anunciar outra coisa no futuro, troque VERSAO (para a versão nova) e o texto abaixo.
const VERSAO = "0.6.70";
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

export default function CelebracaoAtualizacao() {
  const [mostrar, setMostrar] = useState(false);
  const palco = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (jaViu()) return;
    marcarVisto();
    setMostrar(true);
    const fim = setTimeout(() => setMostrar(false), DURACAO_MS);
    return () => clearTimeout(fim);
  }, []);

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
