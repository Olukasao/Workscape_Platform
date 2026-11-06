import { useEffect, useRef, useState } from "react";
import { Phone, PhoneCall } from "lucide-react";
import { Button } from "./ui/button";
import { useSession } from "../stores/workspace";
import { usePhone } from "../stores/phone";

// Aviso único (por pessoa, neste computador) sobre o 0 automático do telefone. Para soltar outro aviso, troque a chave.
const CHAVE = "workspace:novidade:telefone-zero:v2";
const jaViu = () => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; } };
const marcar = () => { try { localStorage.setItem(CHAVE, "1"); } catch { /* vale só até fechar o app */ } };

/** Janela que aparece uma vez avisando: o telefone já coloca o 0 sozinho nos números de fora. */
export default function NovidadeTelefone() {
  const logado = useSession((s) => !!s.token && !!s.user);
  const emLigacao = usePhone((s) => s.snapshot.chamadas.some((c) => c.estado !== "encerrada"));
  const [visto, setVisto] = useState(jaViu);
  const botao = useRef<HTMLButtonElement>(null);
  // Nunca atrapalha uma ligação: espera terminar.
  const aberto = logado && !visto && !emLigacao;
  useEffect(() => { if (aberto) botao.current?.focus(); }, [aberto]);
  if (!aberto) return null;
  const fechar = () => { marcar(); setVisto(true); };
  return (
    <div className="novidade-fundo" role="presentation" onKeyDown={(e) => e.key === "Escape" && fechar()}>
      <div className="novidade-card" role="dialog" aria-modal="true" aria-labelledby="novidade-titulo">
        <span className="novidade-icone" aria-hidden="true"><Phone size={26} /></span>
        <h2 id="novidade-titulo">Telefone: não precisa mais digitar o 0</h2>
        <p>O Workscape Phone agora coloca o <b>0</b> na frente sozinho em todas as ligações para números de fora (com DDD).</p>
        <ul>
          <li><PhoneCall size={15} aria-hidden="true" /> Digite o número normal: <b>11 99999-8888</b>. O telefone disca <b>011999998888</b>.</li>
          <li><PhoneCall size={15} aria-hidden="true" /> Ramais e filas continuam iguais (<b>1003</b>, <b>10002</b>).</li>
          <li><PhoneCall size={15} aria-hidden="true" /> Se você digitar o 0 por hábito, não tem problema: ele não é repetido.</li>
        </ul>
        <p className="novidade-nota">Nos Recentes, clique em uma chamada para copiar o número ou ligar de novo.</p>
        <Button ref={botao} onClick={fechar}>Entendi</Button>
      </div>
    </div>
  );
}
