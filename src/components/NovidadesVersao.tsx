import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { useSession } from "../stores/workspace";
import type { ChangelogEntry } from "../changelog";
import { novidadesDesde } from "../services/novidades";

// Depois que o app atualiza, mostra uma vez (por pessoa, neste computador) o que mudou. Não bloqueia a tela.
const chave = (id: number) => `workspace:novidades:ultima-versao:${id}`;
const ler = (id: number) => { try { return localStorage.getItem(chave(id)); } catch { return null; } };
const gravar = (id: number, v: string) => { try { localStorage.setItem(chave(id), v); } catch { /* vale só até fechar o app */ } };

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
