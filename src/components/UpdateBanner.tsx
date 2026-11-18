import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { UpdateStatus } from "../../electron/updatePolicy";
import { Button } from "./ui/button";

/** Aviso global de atualização: aparece para todos quando uma versão nova está pronta (ou sendo baixada por ordem da TI). */
export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dispensada, setDispensada] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [instalando, setInstalando] = useState(false);
  const avisada = useRef<string | null>(null);
  // O que está segurando a atualização (ligação ou envio de arquivo). A tela pergunta a cada 2 s, avisa o motivo e libera o botão sozinha.
  const [bloqueio, setBloqueio] = useState<"ligacao" | "envio" | null>(null);
  const [liberou, setLiberou] = useState(false);
  const jaBloqueou = useRef(false);
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    let active = true;
    const receive = (value: UpdateStatus) => { if (active) setStatus(value); };
    const stop = desktop.onUpdateStatus(receive);
    void desktop.updateStatus().then(receive).catch(() => undefined);
    return () => { active = false; stop(); };
  }, []);
  // Atualizações comuns são baixadas e aplicadas em silêncio pelo aplicativo; só a obrigatória aparece na tela.
  const obrigatoriaAtiva = !!status?.forced?.obrigatoria;
  const pronta = status?.phase === "ready" && obrigatoriaAtiva ? status.nextVersion || "nova" : null;
  // Notificação do sistema uma vez por versão, para quem está com o app em segundo plano.
  useEffect(() => {
    if (!pronta || avisada.current === pronta) return;
    avisada.current = pronta;
    try {
      void Promise.resolve(window.desktop?.notify({
        title: "Atualização do Acessa Workspace",
        body: status?.forced?.mensagem || `A versão ${pronta} está pronta. Reinicie o aplicativo para atualizar.`,
        target: "/settings",
        kind: "system",
      })).catch(() => undefined);
    } catch { /* A notificação do sistema é um extra; o aviso na tela continua. */ }
  }, [pronta, status?.forced?.mensagem]);
  useEffect(() => {
    if (!pronta || !window.desktop?.updateBloqueio) { setBloqueio(null); return; }
    let vivo = true;
    const ler = () => {
      void window.desktop!.updateBloqueio().then((r) => {
        if (!vivo) return;
        setBloqueio(r.motivo);
        if (r.motivo) { jaBloqueou.current = true; setLiberou(false); }
        else { setErro(""); if (jaBloqueou.current) { jaBloqueou.current = false; setLiberou(true); } }
      }).catch(() => undefined);
    };
    ler();
    const t = window.setInterval(ler, 2000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [pronta]);
  if (!status) return null;
  const obrigatoria = !!status.forced?.obrigatoria;
  const baixando = status.phase === "downloading" && obrigatoria;
  if (!pronta && !baixando) return null;
  if (pronta && !obrigatoria && dispensada === pronta) return null;
  const atualizar = async () => {
    setErro("");
    setInstalando(true);
    try { await window.desktop!.installUpdate(); }
    catch (e) { setErro(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Não foi possível atualizar agora."); setInstalando(false); }
  };
  const texto = status.forced?.mensagem
    || (pronta ? `A versão ${pronta} está pronta. O aplicativo reinicia rapidamente para atualizar.` : "Baixando a atualização solicitada pela TI…");
  const conteudo = (
    <>
      <span className="update-banner-icon" aria-hidden="true">{baixando ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}</span>
      <div className="update-banner-text">
        <strong>{pronta ? "Atualização disponível" : "Atualização em andamento"}</strong>
        <span>{texto}</span>
        {baixando ? <progress aria-label="Download da atualização" max={100} value={status.percent || 0} /> : null}
        {bloqueio === "ligacao" ? <span role="status">Você está em uma ligação. A atualização libera sozinha quando ela terminar.</span> : null}
        {bloqueio === "envio" ? <span role="status">Há um envio de arquivo em andamento. A atualização libera quando ele terminar.</span> : null}
        {!bloqueio && liberou ? <span role="status">Pronto: já pode atualizar.</span> : null}
        {erro && !bloqueio ? <span className="inline-error" role="alert">{erro}</span> : null}
      </div>
      {pronta ? (
        <div className="update-banner-actions">
          <Button size="sm" disabled={instalando || !!bloqueio} onClick={() => void atualizar()}>{instalando ? "Atualizando…" : bloqueio ? "Aguardando…" : "Atualizar agora"}</Button>
          {!obrigatoria ? <Button size="sm" variant="ghost" onClick={() => setDispensada(pronta)}>Depois</Button> : null}
        </div>
      ) : null}
    </>
  );
  return obrigatoria ? (
    <div className="modal-backdrop" style={{ zIndex: 200 }}>
      <section className="update-banner is-required" role="alertdialog" aria-modal="true" aria-label="Atualização obrigatória">{conteudo}</section>
    </div>
  ) : (
    <section className="update-banner" role="status" aria-live="polite">{conteudo}</section>
  );
}
