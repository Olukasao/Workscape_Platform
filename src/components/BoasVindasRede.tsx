import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../stores/workspace";
import { jaViu, marcarVisto, useTour } from "../tour/tour";
import { passosTourRede, TOUR_REDE } from "../tour/passosRede";
import { TOUR_AGENDA_FIN } from "../tour/passosAgendaFinanceira";

const ATRASO_MS = 1500;
const REPETIR_MS = 2000;

/**
 * Novidade: logo que o Workspace abre depois de atualizar (uma única vez por pessoa), quem tem acesso à Rede é levado direto
 * para a tela Rede (OLT) e o passo a passo abre sozinho. Se outro aviso de novidade estiver na frente (o convite da Agenda
 * Comercial ou outro tour), espera ele terminar para não abrir duas coisas ao mesmo tempo.
 */
export default function BoasVindasRede({ ativo, aguardarAgenda }: { ativo: boolean; aguardarAgenda: boolean }) {
  const usuario = useSession((s) => s.user);
  const iniciar = useTour((s) => s.iniciar);
  const navigate = useNavigate();
  const feito = useRef(false);
  const elegivel = ativo && !!usuario && !jaViu(TOUR_REDE, usuario.id, "convite") && !jaViu(TOUR_REDE, usuario.id, "visto");

  useEffect(() => {
    if (!elegivel || !usuario || feito.current) return;
    let t = 0;
    const tentar = () => {
      if (feito.current) return;
      const agendaPendente = aguardarAgenda && !jaViu(TOUR_AGENDA_FIN, usuario.id, "convite") && !jaViu(TOUR_AGENDA_FIN, usuario.id, "visto");
      if (useTour.getState().ativo || agendaPendente || document.querySelector(".aviso-af")) { t = window.setTimeout(tentar, REPETIR_MS); return; }
      feito.current = true;
      marcarVisto(TOUR_REDE, usuario.id, "convite");
      navigate("/rede");
      iniciar(TOUR_REDE, passosTourRede);
    };
    t = window.setTimeout(tentar, ATRASO_MS);
    return () => window.clearTimeout(t);
  }, [elegivel, aguardarAgenda, usuario, navigate, iniciar]);

  return null;
}
