import { useEffect, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/agendaFinanceira.css";
import { clients } from "../services/api";
import { useSession } from "../stores/workspace";
import { Button } from "./ui/button";
import { jaViu, marcarVisto, useTour } from "../tour/tour";
import { ehDoFinanceiro, passosTourAgendaFinanceira, TOUR_AGENDA_FIN } from "../tour/passosAgendaFinanceira";

const DESTINO = "/agenda?aba=financeira";
const ATRASO_MS = 1500;

/**
 * Novidade da 0.6.80, logo que o app abre depois de atualizar (uma única vez por pessoa):
 *  - quem é do financeiro (ou admin/coordenador) é levado direto para a Agenda Financeira e o passo a passo abre sozinho;
 *  - os demais veem um aviso na tela, com botões para abrir a nova agenda (ou ver o passo a passo) ou dispensar.
 */
export default function BoasVindasAgendaFinanceira({ ativo }: { ativo: boolean }) {
  const usuario = useSession((s) => s.user);
  const iniciar = useTour((s) => s.iniciar);
  const navigate = useNavigate();
  const feito = useRef(false);
  const [aviso, setAviso] = useState(false);
  const elegivel = ativo && !!usuario && !jaViu(TOUR_AGENDA_FIN, usuario.id, "convite") && !jaViu(TOUR_AGENDA_FIN, usuario.id, "visto");
  const direto = elegivel && ehDoFinanceiro(usuario);

  useEffect(() => {
    if (!elegivel || !usuario || feito.current) return;
    // esquenta a fila no servidor (a primeira leitura do SGP leva alguns segundos) para a agenda já abrir com os números
    void clients.agenda.get("/agenda-financeira/agenda").catch(() => undefined);
    const t = window.setTimeout(() => {
      if (feito.current) return;
      if (!direto) { setAviso(true); return; }
      feito.current = true;
      marcarVisto(TOUR_AGENDA_FIN, usuario.id, "convite");
      navigate(DESTINO);
      iniciar(TOUR_AGENDA_FIN, passosTourAgendaFinanceira);
    }, ATRASO_MS);
    return () => window.clearTimeout(t);
  }, [elegivel, direto, usuario, navigate, iniciar]);

  if (!aviso || !usuario) return null;
  const fechar = () => { feito.current = true; marcarVisto(TOUR_AGENDA_FIN, usuario.id, "convite"); setAviso(false); };
  const abrir = (comTour: boolean) => {
    fechar();
    navigate(DESTINO);
    if (comTour) iniciar(TOUR_AGENDA_FIN, passosTourAgendaFinanceira);
  };
  return (
    <div className="modal-backdrop aviso-af-fundo" onClick={fechar}>
      <section className="aviso-af" role="dialog" aria-modal="true" aria-labelledby="aviso-af-titulo" onClick={(e) => e.stopPropagation()}>
        <span className="aviso-af-icone" aria-hidden="true"><Wallet size={28} /></span>
        <span className="aviso-af-selo">NOVO</span>
        <h2 id="aviso-af-titulo">Nova Agenda Financeira</h2>
        <p>A fila de ativação de contratos do SGP agora tem uma agenda própria, na aba da Agenda, ao lado da Agenda Instalação.</p>
        <ul>
          <li>Veja quem está com cada ocorrência e distribua arrastando.</li>
          <li>Indicadores da fila, filtros, pesquisa e histórico de quem mexeu.</li>
          <li>Dois jeitos de ver: Quadro ou uma grade por horário, por dia ou 7 dias.</li>
        </ul>
        <div className="aviso-af-acoes">
          <Button onClick={() => abrir(false)} autoFocus>Abrir a Agenda Financeira</Button>
          <Button variant="outline" onClick={() => abrir(true)}>Ver o passo a passo</Button>
          <Button variant="ghost" onClick={fechar}>Agora não</Button>
        </div>
      </section>
    </div>
  );
}
