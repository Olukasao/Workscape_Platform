import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PartyPopper, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { useSession } from "../stores/workspace";
import type { ChangelogEntry } from "../changelog";
import { novidadesDesde } from "../services/novidades";
import leoCaminhao from "../assets/comemoracao/leo-caminhao.png";
import carlinhosAndando from "../assets/comemoracao/carlinhos-andando.png";

// Depois que o app atualiza, mostra uma vez (por pessoa, neste computador) o que mudou. Não bloqueia a tela.
const chave = (id: number) => `workspace:novidades:ultima-versao:${id}`;
const ler = (id: number) => { try { return localStorage.getItem(chave(id)); } catch { return null; } };
const gravar = (id: number, v: string) => { try { localStorage.setItem(chave(id), v); } catch { /* vale só até fechar o app */ } };

const semMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Fogos de artifício sem parar atrás da janela de comemoração (os mesmos da comemoração de venda). */
function Fogos() {
  const palco = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (semMovimento() || !palco.current) return;
    const alvo = palco.current;
    let desmontar: (() => void) | undefined;
    let vivo = true;
    void import("./celebracao/fogosScene").then(({ iniciarFogos }) => {
      const rodada = () => {
        if (!vivo) return;
        desmontar = iniciarFogos(alvo, 6, () => setTimeout(rodada, 200), { quantidade: 18, duracaoLancamentos: 7, duracaoMax: 10 });
      };
      rodada();
    }).catch(() => undefined);
    return () => { vivo = false; desmontar?.(); };
  }, []);
  return <div ref={palco} className="comemoracao-fogos" aria-hidden="true" />;
}

const CORES = ["#22d3ee", "#facc15", "#f472b6", "#4ade80", "#a78bfa", "#fb923c"];

export default function NovidadesVersao() {
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const [versao, setVersao] = useState("");
  const [itens, setItens] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    if (!user || !window.desktop?.updateStatus) return;
    let vivo = true;
    void window.desktop.updateStatus().then((s) => {
      if (!vivo || !s.currentVersion) return;
      const novas = novidadesDesde(s.currentVersion, ler(user.id));
      if (novas.length) { setVersao(s.currentVersion); setItens(novas); }
      else gravar(user.id, s.currentVersion);
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [user?.id]);

  if (!user || !itens.length) return null;
  const fechar = () => { gravar(user.id, versao); setItens([]); };
  const abrir = () => { fechar(); navigate("/changelog"); };
  const festa = itens[0]?.versao === versao ? itens[0].comemoracao : undefined;
  if (festa) {
    // versão com comemoração: janela no centro com confete, uma vez só
    return (
      <div className="comemoracao-fundo" role="dialog" aria-modal="true" aria-labelledby="comemoracao-titulo" onClick={fechar}>
        <Fogos />
        <div className="comemoracao-confete" aria-hidden="true">
          {Array.from({ length: 60 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * 0.18}s`, animationDuration: `${2.6 + (i % 5) * 0.45}s`, background: CORES[i % CORES.length] }} />)}
        </div>
        {/* Leo do Escritório 2D passeando de caminhão pela tela */}
        <div className="comemoracao-leo" aria-hidden="true">
          <span className="comemoracao-fumaca" /><span className="comemoracao-fumaca" /><span className="comemoracao-fumaca" />
          <img src={leoCaminhao} alt="" />
        </div>
        <section className="comemoracao-cartao" onClick={(e) => e.stopPropagation()}>
          {/* Carlinhos do Escritório 2D andando em cima do aviso */}
          <div className="comemoracao-carlinhos" aria-hidden="true">
            <div className="comemoracao-carlinhos-corpo">
              <span className="comemoracao-balao">Peguei a cobra! 🐍</span>
              <span className="comemoracao-carlinhos-sprite" style={{ backgroundImage: `url(${carlinhosAndando})` }} />
            </div>
          </div>
          <span className="comemoracao-icone" aria-hidden="true"><PartyPopper size={34} /></span>
          <h2 id="comemoracao-titulo">{festa.titulo}</h2>
          <p>{festa.texto}</p>
          {festa.destaque ? <strong className="comemoracao-destaque">{festa.destaque}</strong> : null}
          <small>Workspace atualizado para a versão {versao}</small>
          <footer>
            <Button size="sm" variant="ghost" onClick={abrir}>Ver o histórico</Button>
            <Button size="sm" onClick={fechar} autoFocus>Oba!</Button>
          </footer>
        </section>
      </div>
    );
  }
  return (
    <aside className="novidades-versao" role="status" aria-live="polite" aria-labelledby="novidades-titulo">
      <header>
        <span className="novidades-icone" aria-hidden="true"><Sparkles size={16} /></span>
        <h2 id="novidades-titulo">Workspace atualizado para a versão {versao}</h2>
        <button type="button" className="novidades-x" onClick={fechar} aria-label="Fechar"><X size={16} /></button>
      </header>
      <div className="novidades-corpo">
        {itens.map((e) => (
          <section key={e.versao}>
            {itens.length > 1 ? <h3>Versão {e.versao}</h3> : null}
            <ul>{e.itens.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        ))}
      </div>
      <footer>
        <Button size="sm" variant="ghost" onClick={abrir}>Ver todo o histórico</Button>
        <Button size="sm" onClick={fechar}>Entendi</Button>
      </footer>
    </aside>
  );
}
