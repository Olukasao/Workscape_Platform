import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, Headset, LogIn, MonitorSmartphone, Send } from "lucide-react";
import { Button } from "../components/ui/button";
import { EmptyState, PageHeader } from "../components/ui/primitives";
import { clients, errorMessage } from "../services/api";
import { useRemotoLocal } from "../stores/remotoLocal";
import { useSession } from "../stores/workspace";

interface Dispositivo { usuarioId: number; nome: string; online: boolean; visto: string | null; /** O servidor de suporte já conhece o computador? false = nunca se registrou (a conexão daria "computador remoto offline"). */ registrado?: boolean | null; /** Motivo de o suporte remoto não ter iniciado neste computador. */ falha?: string | null }
interface Painel {
  dispositivos: Dispositivo[];
  pedidos: { usuarioId: number; nome: string; mensagem: string; em: string }[];
  auditoria: { em: string; admin: string; alvo: string; modo: "pedido" | "manual" }[];
}
const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function copiar(texto: string) { void navigator.clipboard?.writeText(texto).catch(() => undefined); }

/** Este computador: cada pessoa vê o próprio ID e senha de acesso, para informar ao T.I. quando pedir ajuda. */
function MeuAcesso() {
  const { id, senha, registrado, consertando, erro: erroIniciar } = useRemotoLocal();
  const [mostrar, setMostrar] = useState(false);
  if (!window.desktop?.remotoIniciar) return null;
  return (
    <section className="panel settings-section">
      <div className="section-title">
        <span className="section-icon"><MonitorSmartphone size={17} /></span>
        <div>
          <h2>Este computador</h2>
          <p>Se o T.I. pedir, informe este código e esta senha por telefone ou pelo chat. Com eles, o T.I. acessa este computador sem precisar que você clique em nada.</p>
        </div>
      </div>
      <div className="atalho-linha">
        <span>Código (ID)</span>
        {id ? <kbd className="atalho-tecla">{id}</kbd> : <span className="muted">carregando…</span>}
        {id && <button type="button" className="atalho-botao" aria-label="Copiar código" title="Copiar" onClick={() => copiar(id)}><Copy size={14} /></button>}
      </div>
      <div className="atalho-linha">
        <span>Senha</span>
        {senha ? <kbd className="atalho-tecla">{mostrar ? senha : "••••••••••••"}</kbd> : <span className="muted">carregando…</span>}
        {senha && (
          <>
            <button type="button" className="atalho-botao" aria-label={mostrar ? "Esconder senha" : "Mostrar senha"} title={mostrar ? "Esconder" : "Mostrar"} onClick={() => setMostrar((v) => !v)}>{mostrar ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            <button type="button" className="atalho-botao" aria-label="Copiar senha" title="Copiar" onClick={() => copiar(senha)}><Copy size={14} /></button>
          </>
        )}
      </div>
      {!id && erroIniciar ? <p className="remoto-aviso" role="status">{consertando ? "Consertando o suporte remoto deste computador…" : `O suporte remoto não iniciou neste computador: ${erroIniciar}`}</p> : null}
      {id ? (
        <p className={registrado === false ? "remoto-aviso" : "muted"} role="status">
          {consertando ? "Consertando o suporte remoto deste computador…" : registrado === true ? "Suporte remoto pronto: o T.I. consegue conectar." : registrado === false ? "O suporte remoto ainda não conectou ao servidor. O Workspace tenta se consertar sozinho; se continuar assim, avise o T.I." : "Conferindo o suporte remoto…"}
        </p>
      ) : null}
      {!senha && id && <p className="muted">Este computador ainda não guardou uma senha. Reabra o Workspace e, se persistir, avise o T.I.</p>}
    </section>
  );
}

function PedirSuporte() {
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState("");
  const enviar = useMutation({
    mutationFn: async () => (await clients.chat.post("/remoto/pedir", { mensagem })).data,
    onSuccess: () => { setMensagem(""); setAviso("Pedido enviado. O T.I. vai entrar em contato."); },
    onError: (e) => setAviso(errorMessage(e)),
  });
  return (
    <section className="panel settings-section">
      <div className="section-title">
        <span className="section-icon"><Headset size={17} /></span>
        <div>
          <h2>Pedir suporte técnico</h2>
          <p>Descreva o problema. Se precisar acessar este computador, o T.I. vai pedir o código e a senha acima.</p>
        </div>
      </div>
      <form className="respostas-form" onSubmit={(e) => { e.preventDefault(); setAviso(""); enviar.mutate(); }}>
        <textarea aria-label="Descreva o problema" rows={3} maxLength={300} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: o telefone não conecta" />
        <Button type="submit" disabled={enviar.isPending}><Send size={14} /> Enviar pedido</Button>
      </form>
      {aviso && <p className="muted" role="status">{aviso}</p>}
    </section>
  );
}

/** Admin: conecta digitando o código e a senha que a pessoa informou por telefone ou chat. Entra direto, sem pedir aceite na tela dela. */
function ConectarComCodigo({ aoConectar }: { aoConectar: () => void }) {
  const [id, setId] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const conectar = useMutation({
    mutationFn: async () => {
      const r = await window.desktop?.remotoConectar?.(id.trim(), senha.trim());
      if (!r?.ok) throw new Error(r?.erro || "Não foi possível abrir a conexão neste computador.");
      await clients.chat.post("/admin/remoto/conectar-manual", { id: id.trim() }).catch(() => undefined);
    },
    onSuccess: () => { setSenha(""); setErro(""); aoConectar(); },
    onError: (e) => setErro(errorMessage(e)),
  });
  return (
    <section className="panel settings-section">
      <div className="section-title">
        <span className="section-icon"><LogIn size={17} /></span>
        <div>
          <h2>Conectar com código e senha</h2>
          <p>Peça para a pessoa abrir "Suporte T.I." &gt; "Este computador" e ler o código e a senha. Com os dois certos, a conexão entra direto, sem ela precisar aceitar.</p>
        </div>
      </div>
      <form className="respostas-form" onSubmit={(e) => { e.preventDefault(); setErro(""); conectar.mutate(); }}>
        <input aria-label="Código (ID)" placeholder="Código (ID)" value={id} onChange={(e) => setId(e.target.value)} />
        <input aria-label="Senha" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Button type="submit" disabled={conectar.isPending || !id.trim() || !senha.trim()}>Conectar</Button>
      </form>
      {erro && <p className="atalho-aviso" role="alert">{erro}</p>}
    </section>
  );
}

function PainelTI() {
  const query = useQueryClient();
  const [erro, setErro] = useState("");
  const painel = useQuery({
    queryKey: ["remoto", "painel"],
    queryFn: async () => (await clients.chat.get<Painel>("/admin/remoto")).data,
    refetchInterval: 20_000,
  });
  const conectar = useMutation({
    mutationFn: async (d: Dispositivo) => {
      const { id } = (await clients.chat.post<{ id: string }>("/admin/remoto/conectar", { usuarioId: d.usuarioId })).data;
      const r = await window.desktop?.remotoConectar?.(id);
      if (!r?.ok) throw new Error(r?.erro || "Não foi possível abrir a conexão neste computador.");
    },
    onSuccess: () => { setErro(""); void query.invalidateQueries({ queryKey: ["remoto", "painel"] }); },
    onError: (e) => setErro(errorMessage(e)),
  });
  const dados = painel.data;
  const atualizar = () => void query.invalidateQueries({ queryKey: ["remoto", "painel"] });
  return (
    <>
      {erro && <p className="atalho-aviso" role="alert">{erro}</p>}
      <ConectarComCodigo aoConectar={atualizar} />
      <section className="panel settings-section">
        <div className="section-title">
          <span className="section-icon"><MonitorSmartphone size={17} /></span>
          <div><h2>Computadores</h2><p>Quem está com o Workspace aberto aparece aqui. Clicar em "Conectar" pede o aceite da pessoa na tela dela.</p></div>
        </div>
        {!dados?.dispositivos.length ? <EmptyState title="Nenhum computador apareceu ainda">Os computadores aparecem aqui depois de atualizar o Workspace e abri-lo.</EmptyState> : dados.dispositivos.map((d) => (
          <div key={d.usuarioId} className="atalho-linha">
            <span>{d.nome} <small className="muted">{d.online ? "online" : d.visto ? `visto ${hora(d.visto)}` : ""}</small>
              {d.falha ? <small className="remoto-aviso"><br />O suporte remoto não iniciou neste computador: {d.falha}</small> : null}
              {d.online && d.registrado === false && !d.falha ? <small className="remoto-aviso"><br />Suporte remoto deste computador ainda não conectou ao servidor. O Workspace dele tenta se consertar sozinho; se não resolver, peça para fechá-lo pela bandeja e abrir de novo.</small> : null}
            </span>
            <Button type="button" disabled={!d.online || d.registrado === false || conectar.isPending} title={d.registrado === false ? "Este computador ainda não conectou ao servidor de suporte remoto" : undefined} onClick={() => conectar.mutate(d)}>Conectar</Button>
          </div>
        ))}
      </section>
      {!!dados?.pedidos.length && (
        <section className="panel settings-section">
          <div className="section-title"><div><h2>Pedidos de suporte</h2></div></div>
          {dados.pedidos.map((p, i) => (
            <div key={i} className="atalho-linha"><span><b>{p.nome}</b> · <small className="muted">{hora(p.em)}</small><br />{p.mensagem || "Sem descrição."}</span></div>
          ))}
        </section>
      )}
      {!!dados?.auditoria.length && (
        <section className="panel settings-section">
          <div className="section-title"><div><h2>Registro de conexões</h2><p>Quem conectou em qual computador.</p></div></div>
          {dados.auditoria.map((a, i) => <div key={i} className="atalho-linha"><span>{hora(a.em)} · {a.admin} → {a.alvo} <small className="muted">({a.modo === "manual" ? "código e senha" : "com aceite"})</small></span></div>)}
        </section>
      )}
    </>
  );
}

export default function SuporteRemoto() {
  const admin = useSession((s) => s.user?.perfil === "admin");
  return (
    <div className="page narrow-page settings-page">
      <PageHeader icon={Headset} title="Suporte T.I." description={admin ? "Acesse os computadores da equipe para dar suporte." : "Peça ajuda ao T.I."} />
      <MeuAcesso />
      {admin ? <PainelTI /> : <PedirSuporte />}
    </div>
  );
}
