import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { clients } from "../services/api";
import { useSession } from "../stores/workspace";
import { jaViu, marcarVisto, useTour } from "../tour/tour";
import { ehDoFinanceiro, passosTourAgendaFinanceira, TOUR_AGENDA_FIN } from "../tour/passosAgendaFinanceira";

/**
 * Novidade da 0.6.80: logo depois da atualização, quem é do financeiro (ou admin/coordenador) é levado uma única vez para a Agenda Financeira e o
 * passo a passo abre sozinho. Os demais veem o aviso de novidade e podem abrir o tour pelo botão "Como usar" da própria aba.
 */
export default function BoasVindasAgendaFinanceira({ ativo }: { ativo: boolean }) {
  const usuario = useSession((s) => s.user);
  const iniciar = useTour((s) => s.iniciar);
  const emTour = useTour((s) => !!s.ativo);
  const navigate = useNavigate();
  const feito = useRef(false);
  const elegivel = ativo && !!usuario && ehDoFinanceiro(usuario) && !jaViu(TOUR_AGENDA_FIN, usuario.id, "convite") && !jaViu(TOUR_AGENDA_FIN, usuario.id, "visto");

  useEffect(() => {
    if (!elegivel || !usuario || feito.current) return;
    // esquenta a fila no servidor (a primeira leitura do SGP leva alguns segundos) para a tela já abrir com os números
    const esquentar = window.setTimeout(() => void clients.agenda.get("/agenda-financeira/agenda").catch(() => undefined), 3000);
    const abrir = window.setTimeout(() => {
      if (feito.current || useTour.getState().ativo) return;
      feito.current = true;
      marcarVisto(TOUR_AGENDA_FIN, usuario.id, "convite");
      navigate("/agenda");
      iniciar(TOUR_AGENDA_FIN, passosTourAgendaFinanceira);
    }, 8000);
    return () => { window.clearTimeout(esquentar); window.clearTimeout(abrir); };
  }, [elegivel, usuario, navigate, iniciar, emTour]);

  return null;
}
