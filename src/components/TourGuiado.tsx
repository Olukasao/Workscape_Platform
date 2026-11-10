import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { clsx } from "clsx";
import { useSession } from "../stores/workspace";
import { TOURS_PULAVEIS, fatorZoomCss, jaViu, marcarVisto, paraPixelsCss, posicionarBalao, useTour, vizinho, type PosicaoBalao, type Retangulo } from "../tour/tour";

const FOLGA_DESTAQUE = 8;
const ESPERA_ELEMENTO_MS = 2500;

const procurar = (alvo?: string): HTMLElement | null => {
  if (!alvo) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${alvo}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
};

/** Passo a passo na tela: escurece o resto, ilumina uma parte e explica em um balão. Aparece quando `useTour` está ativo. */
export default function TourGuiado() {
  const { ativo, passo, ir, encerrar } = useTour();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const usuario = useSession((s) => s.user);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [resolvido, setResolvido] = useState(false);
  const [balao, setBalao] = useState({ w: 360, h: 220 });
  const balaoRef = useRef<HTMLDivElement>(null);
  const direcao = useRef<1 | -1>(1);
  const rolou = useRef(false);

  const passos = ativo?.passos ?? [];
  const atual = passos[passo];
  const ultimo = passo >= passos.length - 1;
  // Na primeira vez o tour é obrigatório: sem Pular nem Esc, só some ao concluir. Depois de visto, quem refaz pode pular.
  const obrigatorio = !!ativo && !!usuario && !TOURS_PULAVEIS.has(ativo.id) && !jaViu(ativo.id, usuario.id);

  const fechar = useCallback(() => {
    if (ativo && usuario) marcarVisto(ativo.id, usuario.id);
    encerrar();
  }, [ativo, usuario, encerrar]);

  const mover = useCallback((d: 1 | -1) => {
    direcao.current = d;
    // Os passos opcionais cujo elemento não existe são decididos quando o passo carrega (abaixo); aqui só andamos um.
    const proximo = passo + d;
    if (proximo < 0) return;
    if (proximo >= passos.length) { fechar(); return; }
    ir(proximo);
  }, [passo, passos.length, ir, fechar]);

  // Ao chegar em um passo: vai para a tela certa, espera o elemento aparecer e, se não aparecer, pula (opcional) ou usa o centro.
  useEffect(() => {
    if (!atual) return;
    setResolvido(false);
    setAlvo(null);
    rolou.current = false;
    if (atual.rota && pathname !== atual.rota) navigate(atual.rota);
    if (!atual.alvo) { setResolvido(true); return; }
    let cancelado = false;
    const inicio = performance.now();
    const tentar = () => {
      if (cancelado) return;
      if (procurar(atual.alvo)) { setResolvido(true); return; }
      if (performance.now() - inicio > ESPERA_ELEMENTO_MS) {
        if (atual.opcional) {
          const outro = vizinho(passos, passo, direcao.current, () => true);
          if (outro >= 0) ir(outro); else fechar();
        } else setResolvido(true); // sem o elemento: balão no centro
        return;
      }
      requestAnimationFrame(tentar);
    };
    tentar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.id]);

  // Acompanha o elemento a cada quadro (a tela pode mexer, rolar ou animar): só atualiza se mudou.
  useEffect(() => {
    if (!atual?.alvo || !resolvido) return;
    let quadro = 0;
    const seguir = () => {
      const el = procurar(atual.alvo);
      if (el) {
        if (!rolou.current) { rolou.current = true; el.scrollIntoView({ block: "center", inline: "nearest" }); }
        const r = el.getBoundingClientRect();
        const novo = paraPixelsCss({ x: r.x, y: r.y, w: r.width, h: r.height }, fatorZoomCss());
        novo.x = Math.round(novo.x); novo.y = Math.round(novo.y); novo.w = Math.round(novo.w); novo.h = Math.round(novo.h);
        setAlvo((velho) => (velho && velho.x === novo.x && velho.y === novo.y && velho.w === novo.w && velho.h === novo.h ? velho : novo));
      } else setAlvo(null);
      quadro = requestAnimationFrame(seguir);
    };
    seguir();
    return () => cancelAnimationFrame(quadro);
  }, [atual?.alvo, atual?.id, resolvido]);

  useLayoutEffect(() => {
    const el = balaoRef.current;
    if (el && (Math.abs(el.offsetWidth - balao.w) > 1 || Math.abs(el.offsetHeight - balao.h) > 1)) setBalao({ w: el.offsetWidth, h: el.offsetHeight });
  });

  useEffect(() => {
    if (!ativo) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); if (!obrigatorio) fechar(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); mover(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); mover(-1); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ativo, mover, fechar, obrigatorio]);

  if (!ativo || !atual || !resolvido) return null;
  const destaque: Retangulo | null = alvo
    ? { x: alvo.x - FOLGA_DESTAQUE, y: alvo.y - FOLGA_DESTAQUE, w: alvo.w + FOLGA_DESTAQUE * 2, h: alvo.h + FOLGA_DESTAQUE * 2 }
    : null;
  const zoom = fatorZoomCss();
  const pos: PosicaoBalao = posicionarBalao(destaque, balao, { w: window.innerWidth / zoom, h: window.innerHeight / zoom }, atual.lado ?? "auto");

  return createPortal(
    <div className="tour-camada" role="presentation">
      {destaque ? (
        <div className="tour-destaque" style={{ top: destaque.y, left: destaque.x, width: destaque.w, height: destaque.h }} />
      ) : (
        <div className="tour-fundo" />
      )}
      <div
        ref={balaoRef}
        className={clsx("tour-balao", `lado-${pos.lado}`)}
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-titulo"
        aria-describedby="tour-texto"
      >
        {pos.lado !== "centro" ? (
          <i className="tour-seta" aria-hidden="true" style={pos.lado === "cima" || pos.lado === "baixo" ? { left: pos.seta } : { top: pos.seta }} />
        ) : null}
        <header>
          <span className="tour-contagem">Passo {passo + 1} de {passos.length}</span>
          {obrigatorio ? null : (
            <button type="button" className="tour-pular" onClick={fechar} aria-label="Fechar o tour">
              <X size={15} /> Pular
            </button>
          )}
        </header>
        <h3 id="tour-titulo">{atual.titulo}</h3>
        <p id="tour-texto">{atual.texto}</p>
        <div className="tour-progresso" aria-hidden="true">
          {passos.map((p, i) => <i key={p.id} className={clsx(i === passo && "atual", i < passo && "feito")} />)}
        </div>
        <footer>
          <button type="button" className="tour-voltar" onClick={() => mover(-1)} disabled={passo === 0}>
            <ArrowLeft size={15} /> Voltar
          </button>
          <button type="button" className="tour-proximo" onClick={() => mover(1)} autoFocus>
            {ultimo ? <>Concluir <Check size={15} /></> : <>Próximo <ArrowRight size={15} /></>}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
