import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../stores/workspace";
import { jaViu, marcarVisto, useTour } from "../tour/tour";
import { passosTourBgp, TOUR_BGP } from "../tour/passosBgp";

/** Aviso de novidade: logo depois da atualização, convida quem tem acesso à Rede a conhecer a tela Rotas (BGP). Aparece uma vez por pessoa. */
export default function ConviteTourBgp({ ativo }: { ativo: boolean }) {
  const usuario = useSession((s) => s.user);
  const iniciar = useTour((s) => s.iniciar);
  const emTour = useTour((s) => !!s.ativo);
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const elegivel = ativo && !!usuario && !jaViu(TOUR_BGP, usuario.id, "convite") && !jaViu(TOUR_BGP, usuario.id, "visto");

  useEffect(() => {
    if (!elegivel) return;
    const t = window.setTimeout(() => setAberto(true), 8000);
    return () => window.clearTimeout(t);
  }, [elegivel]);

  if (!aberto || !usuario || emTour) return null;
  const fechar = () => { marcarVisto(TOUR_BGP, usuario.id, "convite"); setAberto(false); };
  return (
    <aside className="tour-convite" role="complementary" aria-label="Convite para o tour de Rotas BGP">
      <span className="tour-convite-icone" aria-hidden="true"><Globe2 size={20} /></span>
      <div>
        <strong>Novo: Rotas (BGP) no Workspace</strong>
        <p>Veja as sessões com as operadoras, as rotas em tempo real e o histórico. Faça o tour de 1 minuto.</p>
        <div className="tour-convite-acoes">
          <button type="button" className="tour-proximo" onClick={() => { fechar(); navigate("/rotas"); iniciar(TOUR_BGP, passosTourBgp); }}>Fazer o tour</button>
          <button type="button" className="tour-pular" onClick={fechar}>Agora não</button>
        </div>
      </div>
    </aside>
  );
}
