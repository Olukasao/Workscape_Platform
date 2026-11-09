import { Phone, PhoneOff } from "lucide-react";
import { usePhone } from "../stores/phone";
import type { PhoneCall as Chamada } from "../../electron/phone";
import { useNomesPorRamal } from "../services/ramais";
import { identificarChamador } from "../services/chamador";
import { ResumoClienteLigacao } from "./ClienteDaLigacao";
import { useChamadaReal } from "../services/transferencia";

/** Faixa de chamada recebida: aparece em qualquer tela do Workspace, mesmo com o cartão do telefone fechado. */
export default function ChamadaRecebida() {
  const bruta = usePhone((s) => s.snapshot.chamadas.find((c) => c.direcao === "in" && c.estado === "tocando"));
  const equipe = useNomesPorRamal();
  if (!bruta) return null;
  return <Faixa bruta={bruta} equipe={equipe} />;
}

function Faixa({ bruta, equipe }: { bruta: Chamada; equipe: Map<string, string> }) {
  const chamada = useChamadaReal(bruta);
  const quem = identificarChamador(chamada.numero, chamada.nome, equipe);
  return (
    <div className="chamada-recebida" role="alertdialog" aria-live="assertive" aria-label={`Chamada recebida de ${quem.titulo}${quem.sub ? `, ${quem.sub}` : ""}`}>
      <span className="chamada-recebida-icone" aria-hidden="true"><Phone size={18} /></span>
      <div className="chamada-recebida-texto">
        <strong>{quem.titulo}</strong>
        <small>{quem.sub ? `${quem.sub} · ` : ""}Chamada recebida</small>
        <ResumoClienteLigacao numero={chamada.numero} externo={quem.externo} />
      </div>
      <button type="button" className="recusar" onClick={() => void window.desktop?.phoneReject?.(chamada.id)} aria-label="Recusar">
        <PhoneOff size={18} aria-hidden="true" />
      </button>
      <button type="button" className="atender" autoFocus onClick={() => void window.desktop?.phoneAnswer?.(chamada.id)} aria-label="Atender">
        <Phone size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
