import { useEffect, useMemo, useRef } from "react";
import { useSession } from "../stores/workspace";
import { useTelefone } from "../stores/telefone";
import { iniciarTelefone, pararTelefone, registrarHistorico, usePhone } from "../stores/phone";
import { iniciarToque, tocarSom } from "../services/toque";
import { clients } from "../services/api";
import { avisarLigacao } from "../services/situacao";
import { useNomesPorRamal } from "../services/ramais";
import { identificarChamador } from "../services/chamador";
import { fichaDisponivel, useFichaAutomatica } from "../services/fichaAuto";
import { useReceberTransferencias, useTransferencias } from "../services/transferencia";
import { chamadaReal } from "../services/transferenciaChamada";

/** Sem tela: liga o telefone ao entrar no Workspace, grava o histórico e toca quando alguém liga. */
export default function TelefoneMotor() {
  const token = useSession((s) => s.token);
  const userId = useSession((s) => s.user?.id);
  const abrir = useTelefone((s) => s.abrir);
  const cartaoAberto = useTelefone((s) => s.aberto);
  // O processo principal só reinicia para atualizar com o cartão do telefone fechado.
  useEffect(() => { void window.desktop?.phoneUi?.(cartaoAberto); }, [cartaoAberto]);
  const tocando = usePhone((s) => s.snapshot.chamadas.some((c) => c.direcao === "in" && c.estado === "tocando"));
  // Abre o cartão quando a conversa começa ou quando a pessoa liga (pelo chat, por exemplo). Chamada tocando mostra só a faixa.
  const emChamada = usePhone((s) => s.snapshot.chamadas.some((c) => c.estado === "conversando" || (c.direcao === "out" && c.estado === "chamando")));

  useEffect(() => {
    if (token && userId) void iniciarTelefone(token, (e) => {
      if (e.type === "history") {
        void registrarHistorico(e);
        // Perdida avisada com som, mas nunca no Não perturbe (a ligação foi recusada de propósito).
        if (e.direcao === "in" && e.resultado === "nao_atendida" && !e.silenciosa) tocarSom("perdida");
      }
      if (e.type === "abrir") abrir();
    });
    else void pararTelefone();
  }, [token, userId, abrir]);

  useEffect(() => { if (tocando) return iniciarToque(); }, [tocando]);
  // "Em ligação" nos colegas: só quando a conversa começa de fato (ou a pessoa está chamando), e some quando acaba.
  const avisada = useRef(false);
  useEffect(() => {
    if (!token || !userId || avisada.current === emChamada) return;
    avisada.current = emChamada;
    avisarLigacao(emChamada);
  }, [emChamada, token, userId]);
  // Ficha do cliente: abre a janelinha quando uma ligação de número externo toca (ou é feita) e fecha depois que termina.
  const equipe = useNomesPorRamal();
  const fichaAuto = useFichaAutomatica();
  const chamadas = usePhone((s) => s.snapshot.chamadas);
  useReceberTransferencias(!!token && !!userId);
  const transferidas = useTransferencias((s) => s.itens);
  const externa = useMemo(
    () => chamadas.map((c) => chamadaReal(c, transferidas)).filter((c) => c.estado !== "encerrada" && identificarChamador(c.numero, c.nome, equipe).externo).sort((a, b) => b.id - a.id)[0] ?? null,
    [chamadas, equipe, transferidas],
  );
  const fichaDaChamada = useRef<string | null>(null);
  useEffect(() => {
    if (!token || !userId || !fichaDisponivel()) return;
    if (externa && fichaAuto) {
      // Reenvia quando a ligação muda de fase (tocando -> em ligação), para a janela trocar o rótulo e começar o cronômetro.
      const chave = `${externa.id}:${externa.estado}`;
      if (fichaDaChamada.current === chave) return;
      fichaDaChamada.current = chave;
      const estado = externa.estado === "conversando" ? "conversando" : externa.estado === "chamando" ? "chamando" : "tocando";
      void window.desktop?.fichaAbrir?.({ numero: externa.numero, nome: externa.nome || "", direcao: externa.direcao, estado, atendidaMs: externa.atendidaMs ?? null }).catch(() => undefined);
    } else if (!externa && fichaDaChamada.current !== null) {
      fichaDaChamada.current = null;
      void window.desktop?.fichaFim?.().catch(() => undefined);
    }
  }, [externa, fichaAuto, token, userId]);
  // Avisa o servidor de que este ramal está registrado, para o administrador ver quem está online.
  const registro = usePhone((s) => s.snapshot.registro);
  const naoPerturbe = usePhone((s) => s.snapshot.naoPerturbe);
  const ocupado = usePhone((s) => s.snapshot.chamadas.some((c) => c.estado === "conversando"));
  const temRamal = usePhone((s) => s.temRamal);
  useEffect(() => {
    if (!token || !temRamal) return;
    const avisar = () => { void clients.chat.post("/phone/presenca", { registro, emChamada: ocupado, naoPerturbe }).catch(() => undefined); };
    avisar();
    const t = window.setInterval(avisar, 30_000);
    return () => window.clearInterval(t);
  }, [token, temRamal, registro, ocupado, naoPerturbe]);
  // Sons de começo e fim da conversa. Só tocam quando a conversa realmente começou: chamada recusada ou perdida não faz "desligou".
  const conversando = usePhone((s) => s.snapshot.chamadas.some((c) => c.estado === "conversando"));
  const jaConversou = useRef(false);
  useEffect(() => {
    if (conversando && !jaConversou.current) { jaConversou.current = true; tocarSom("atendeu"); }
    else if (!conversando && jaConversou.current) { jaConversou.current = false; tocarSom("desligou"); }
  }, [conversando]);
  // O cartão do telefone abre sozinho quando há uma ligação em andamento (por exemplo, iniciada pelo chat).
  useEffect(() => { if (emChamada) abrir(); }, [emChamada, abrir]);
  return null;
}
