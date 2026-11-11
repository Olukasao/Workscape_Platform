import { useCallback, useEffect, useRef, useState } from "react";
import { Pin, PinOff, X } from "lucide-react";
import { api } from "../services/api";
import { useServers, useSession } from "../stores/workspace";
import { useApplicationZoom } from "../services/useApplicationZoom";
import "../styles/postit.css";

interface Nota { id: number; title: string; content: string; can_edit?: boolean; permission?: string; access_type?: string }
const CORES = [
  { id: "amarelo", cor: "#fff3a3" }, { id: "rosa", cor: "#ffc8dd" }, { id: "verde", cor: "#c9f2c7" },
  { id: "azul", cor: "#bde0fe" }, { id: "roxo", cor: "#e0c8ff" }, { id: "laranja", cor: "#ffd8a8" },
];
const lerCor = (id: number) => { try { return localStorage.getItem(`workspace:postit-cor-${id}`) || "amarelo"; } catch { return "amarelo"; } };

/** Nota rápida numa janelinha adesiva: sem moldura, sempre por cima, com cor e salvamento automático. */
export default function PostItJanela({ id }: { id: number }) {
  const { load } = useServers();
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [nota, setNota] = useState<Nota | null>(null);
  const [texto, setTexto] = useState("");
  const [cor, setCor] = useState(() => lerCor(id));
  const [fixado, setFixado] = useState(true);
  const [salvo, setSalvo] = useState<"salvo" | "salvando" | "pendente" | "erro">("salvo");
  const sujo = useRef(false);
  const ultimo = useRef("");
  const atual = useRef("");
  useApplicationZoom();

  const corAtual = CORES.find((c) => c.id === cor)?.cor ?? CORES[0].cor;
  useEffect(() => {
    document.documentElement.classList.add("postit-janela");
    document.documentElement.style.setProperty("--postit-cor", corAtual);
    document.title = "Post-it";
  }, [corAtual]);

  const buscar = useCallback(async () => {
    const { data } = await api.get<Nota>(`/notes/${id}`);
    setNota(data);
    if (!sujo.current && data.content !== ultimo.current) { setTexto(data.content ?? ""); ultimo.current = atual.current = data.content ?? ""; }
  }, [id]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        await load();
        const salva = (await window.desktop?.getSession?.()) ?? { token: sessionStorage.getItem("token") };
        if (!salva?.token) throw new Error("sem sessão");
        sessionStorage.setItem("token", salva.token);
        useSession.setState({ token: salva.token });
        await buscar();
        if (!cancelado) setEstado("ok");
      } catch { if (!cancelado) setEstado("erro"); }
    })();
    return () => { cancelado = true; };
  }, [load, buscar]);

  // Traz mudanças feitas por outra pessoa (nota compartilhada) ou em outra janela, sem sobrescrever o que está sendo digitado.
  useEffect(() => {
    if (estado !== "ok") return;
    const t = window.setInterval(() => { if (!sujo.current) void buscar().catch(() => undefined); }, 15000);
    return () => window.clearInterval(t);
  }, [estado, buscar]);

  const podeEditar = nota ? nota.can_edit ?? (nota.access_type === "owner" || nota.permission === "edit" || nota.permission === "owner") : false;

  const gravar = useCallback(async (conteudo: string) => {
    if (!nota) return;
    setSalvo("salvando");
    try {
      // Só título e conteúdo: compartilhamento e fixação da nota não são tocados.
      await api.put(`/notes/${id}`, { title: nota.title, content: conteudo });
      ultimo.current = conteudo;
      // Se a pessoa continuou digitando durante o salvamento, segue pendente.
      sujo.current = atual.current !== conteudo;
      setSalvo("salvo");
    } catch { setSalvo("erro"); }
  }, [id, nota]);

  useEffect(() => {
    if (!sujo.current) return;
    setSalvo("pendente");
    const t = window.setTimeout(() => void gravar(texto), 800);
    return () => window.clearTimeout(t);
  }, [texto, gravar]);

  // Fechar a janela com alteração pendente: grava antes.
  useEffect(() => {
    const salvarAoSair = () => { if (sujo.current) void gravar(texto); };
    window.addEventListener("beforeunload", salvarAoSair);
    return () => window.removeEventListener("beforeunload", salvarAoSair);
  }, [texto, gravar]);

  const escolherCor = (c: string) => { setCor(c); try { localStorage.setItem(`workspace:postit-cor-${id}`, c); } catch { /* sem armazenamento */ } };
  const alternarFixado = () => { const v = !fixado; setFixado(v); void window.desktop?.postitFixar?.(v); };
  const fechar = async () => { if (sujo.current) await gravar(texto); void window.desktop?.postitFechar?.(); };

  if (estado !== "ok" || !nota)
    return (
      <div className="postit" role="status">
        <div className="postit-barra"><span /><button type="button" aria-label="Fechar" onClick={() => void window.desktop?.postitFechar?.()}><X size={14} /></button></div>
        <p className="postit-aviso">{estado === "erro" ? "Não foi possível abrir esta nota. Entre no Workspace e abra o post-it de novo." : "Abrindo…"}</p>
      </div>
    );
  return (
    <div className="postit">
      <div className="postit-barra">
        <span className="postit-titulo" title={nota.title}>{nota.title}</span>
        <span className="postit-acoes">
          <button type="button" aria-label={fixado ? "Deixar de ficar por cima" : "Ficar por cima"} aria-pressed={fixado} title={fixado ? "Sempre por cima (clique para soltar)" : "Ficar sempre por cima"} onClick={alternarFixado}>{fixado ? <Pin size={14} /> : <PinOff size={14} />}</button>
          <button type="button" aria-label="Fechar post-it" title="Fechar" onClick={() => void fechar()}><X size={15} /></button>
        </span>
      </div>
      <textarea
        className="postit-texto"
        value={texto}
        readOnly={!podeEditar}
        placeholder={podeEditar ? "Escreva aqui…" : "Você só pode visualizar esta nota."}
        spellCheck
        onChange={(e) => { sujo.current = true; atual.current = e.target.value; setTexto(e.target.value); }}
      />
      <div className="postit-rodape">
        <span className="postit-cores" role="radiogroup" aria-label="Cor do post-it">
          {CORES.map((c) => <button key={c.id} type="button" role="radio" aria-checked={cor === c.id} aria-label={c.id} className={cor === c.id ? "ativa" : ""} style={{ background: c.cor }} onClick={() => escolherCor(c.id)} />)}
        </span>
        <span className={`postit-estado ${salvo}`}>{salvo === "salvo" ? "Salvo" : salvo === "erro" ? "Erro ao salvar" : "Salvando…"}</span>
      </div>
    </div>
  );
}
