import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Headset, MonitorSmartphone, Send } from "lucide-react";
import { Button } from "../components/ui/button";
import { EmptyState, PageHeader } from "../components/ui/primitives";
import { clients, errorMessage } from "../services/api";
import { useSession } from "../stores/workspace";

interface Dispositivo { usuarioId: number; nome: string; online: boolean; visto: string | null }
interface Painel {
  dispositivos: Dispositivo[];
  pedidos: { usuarioId: number; nome: string; mensagem: string; em: string }[];
  auditoria: { em: string; admin: string; alvo: string; modo: "direta" | "pedido" }[];
  /** Só esta conta entra direto, sem a pessoa aceitar (senha permanente dela). As demais pedem aceite, como sempre. */
  master: boolean;
}
const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function PedirSuporte() {
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState("");
  const enviar = useMutation({
    mutationFn: async () => (await clients.chat.post("/remoto/pedir", { mensagem })).data,
    onSuccess: () => { setMensagem(""); setAviso("Pedido enviado. O T.I. vai entrar em contato e você precisará aceitar a conexão na tela."); },
    onError: (e) => setAviso(errorMessage(e)),
  });
  return (
    <section className="panel settings-section">
      <div className="section-title">
        <span className="section-icon"><Headset size={17} /></span>
        <div>
          <h2>Pedir suporte técnico</h2>
          <p>Descreva o problema. O T.I. recebe o seu pedido e pode acessar este computador, mas só depois que você aceitar a conexão na tela.</p>
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
      const { id, senha } = (await clients.chat.post<{ id: string; senha?: string }>("/admin/remoto/conectar", { usuarioId: d.usuarioId })).data;
      const r = await window.desktop?.remotoConectar?.(id, senha);
      if (!r?.ok) throw new Error(r?.erro || "Não foi possível abrir a conexão neste computador.");
    },
    onSuccess: () => { setErro(""); void query.invalidateQueries({ queryKey: ["remoto", "painel"] }); },
    onError: (e) => setErro(errorMessage(e)),
  });
  const dados = painel.data;
  return (
    <>
      {erro && <p className="atalho-aviso" role="alert">{erro}</p>}
      {dados?.master && (
        <p className="muted" role="status">Esta conta entra direto nos computadores que já avisaram a senha, sem a pessoa precisar aceitar. Toda conexão fica no registro abaixo.</p>
      )}
      <section className="panel settings-section">
        <div className="section-title">
          <span className="section-icon"><MonitorSmartphone size={17} /></span>
          <div><h2>Computadores</h2><p>Quem está com o Workspace aberto aparece como online.{dados?.master ? "" : " A pessoa precisa aceitar a conexão na tela dela."}</p></div>
        </div>
        {!dados?.dispositivos.length ? <EmptyState title="Nenhum computador apareceu ainda">Os computadores aparecem aqui depois de atualizar o Workspace e abri-lo.</EmptyState> : dados.dispositivos.map((d) => (
          <div key={d.usuarioId} className="atalho-linha">
            <span>{d.nome} <small className="muted">{d.online ? "online" : d.visto ? `visto ${hora(d.visto)}` : ""}</small></span>
            <Button type="button" disabled={!d.online || conectar.isPending} onClick={() => conectar.mutate(d)}>Conectar</Button>
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
          <div className="section-title"><div><h2>Registro de conexões</h2><p>Quem conectou em qual computador, direto ou por pedido de aceite.</p></div></div>
          {dados.auditoria.map((a, i) => <div key={i} className="atalho-linha"><span>{hora(a.em)} · {a.admin} → {a.alvo} <small className="muted">({a.modo === "direta" ? "direta, sem aceite" : "com aceite"})</small></span></div>)}
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
      {admin ? <PainelTI /> : <PedirSuporte />}
    </div>
  );
}
