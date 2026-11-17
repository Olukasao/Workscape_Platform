import { useState } from "react";
import L from "leaflet";
import { Map as MapIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import { LeafletMap, escapeHtml } from "../agenda/LeafletMap";
import type { CtoMapa, PontoAfetado } from "../../services/redeOlt";

const COR = { semEnergia: "#ffb020", loss: "#ff4d55" } as const;
const ROTULO = { semEnergia: "Sem energia", loss: "LOSS (perda de sinal)" } as const;

/**
 * Mapa da queda: cada ponto é um cliente afetado (âmbar = sem energia, vermelho = LOSS), nas coordenadas do cadastro do SGP.
 * Os pontos cinza são CTOs da região. Energia costuma aparecer como manchas por bairro; fibra rompida, como uma linha ou região
 * contínua de LOSS. Sem nome nem contrato no mapa.
 */
export default function MapaQueda({ pontos, ctos, total }: { pontos: PontoAfetado[]; ctos: CtoMapa[]; total: number }) {
  const [aberto, setAberto] = useState(false);
  const [satelite, setSatelite] = useState(false);
  const semEnergia = pontos.filter((p) => p.estado === "semEnergia").length;
  return (
    <div className="rede-mapa-bloco">
      <div className="rede-mapa-topo">
        <Button variant={aberto ? "soft" : "outline"} size="sm" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          <MapIcon size={15} /> {aberto ? "Esconder mapa" : "Ver no mapa"}
        </Button>
        <span className="muted">{pontos.length} de {total} clientes com localização cadastrada</span>
        {aberto ? (
          <label className="rede-mapa-sat">
            <input type="checkbox" checked={satelite} onChange={(e) => setSatelite(e.target.checked)} /> Satélite
          </label>
        ) : null}
      </div>
      {aberto ? (
        <>
          <LeafletMap
            className="rede-mapa"
            satelite={satelite}
            fitKey={`${pontos.length}|${pontos[0]?.lat}|${pontos[0]?.lng}`}
            deps={[pontos, ctos]}
            draw={(layer) => {
              const bounds = L.latLngBounds([]);
              for (const c of ctos) {
                L.circleMarker([c.lat, c.lng], { radius: 3, color: "#8aa0b8", weight: 1, fillColor: "#8aa0b8", fillOpacity: 0.55 })
                  .bindTooltip(`CTO${c.portas ? ` · ${c.portas} portas` : ""}`)
                  .addTo(layer);
              }
              for (const p of pontos) {
                L.circleMarker([p.lat, p.lng], { radius: 7, color: "#0b1226", weight: 1.5, fillColor: COR[p.estado], fillOpacity: 0.92 })
                  .bindPopup(`<strong>${escapeHtml(ROTULO[p.estado])}</strong><br>${escapeHtml(p.bairro)}`)
                  .addTo(layer);
                bounds.extend([p.lat, p.lng]);
              }
              return bounds;
            }}
          />
          <div className="rede-mapa-legenda" aria-label="Legenda do mapa">
            <span><i style={{ background: COR.semEnergia }} /> Sem energia ({semEnergia})</span>
            <span><i style={{ background: COR.loss }} /> LOSS ({pontos.length - semEnergia})</span>
            {ctos.length ? <span><i className="cto" /> CTOs da região ({ctos.length})</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
