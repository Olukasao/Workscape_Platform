import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { RotateCcw, Save } from "lucide-react";
import { api, errorMessage } from "../services/api";

// Funções: marca, para cada setor, quais áreas do Workspace aparecem. Setor sem marcação salva vê tudo (padrão).
// Administradores sempre veem tudo.
interface Modulo { id: string; rotulo: string; grupo: string }
interface Setor { id: number; nome: string; pessoas: number; modulos: string[] | null }
interface Resposta { modulos: Modulo[]; setores: Setor[] }
const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));

export default function ControleFuncoes() {
  const cliente = useQueryClient();
  const dados = useQuery({ queryKey: ["admin", "funcoes"], queryFn: async () => (await api.get<Resposta>("/admin/funcoes")).data });
  const [setorId, setSetorId] = useState<number | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const setor = dados.data?.setores.find((s) => s.id === setorId) ?? null;

  useEffect(() => {
    if (setorId === null && dados.data?.setores.length) setSetorId(dados.data.setores[0].id);
  }, [dados.data, setorId]);
  useEffect(() => {
    if (!dados.data || !setor) return;
    setMarcados(new Set(setor.modulos ?? dados.data.modulos.map((m) => m.id)));
    setAviso(""); setErro("");
  }, [setor?.id, setor?.modulos, dados.data]);

  const salvar = useMutation({
    mutationFn: async (modulos: string[] | null) => api.put(`/admin/funcoes/${setorId}`, { modulos }),
    onSuccess: (_r, modulos) => {
      setAviso(modulos === null ? "Voltou ao padrão: o setor vê tudo." : "Função salva. Vale no próximo carregamento de cada pessoa (até 1 minuto).");
      setErro("");
      void cliente.invalidateQueries({ queryKey: ["admin", "funcoes"] });
    },
    onError: (e) => { setErro(msgDe(e)); setAviso(""); },
  });

  const alternar = (id: string) => setMarcados((atual) => {
    const novo = new Set(atual);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  if (dados.isLoading) return <p>Carregando funções…</p>;
  if (dados.error) return <p role="alert">{msgDe(dados.error)}</p>;
  const todos = dados.data!.modulos;
  const grupos = [...new Set(todos.map((m) => m.grupo))];

  return (
    <section aria-label="Funções por setor" style={{ display: "grid", gap: 16, maxWidth: 760 }}>
      <header>
        <h2 style={{ margin: 0 }}>Funções</h2>
        <p style={{ margin: "4px 0 0", opacity: 0.75 }}>
          Escolha o que cada setor enxerga no Workspace. Quem é administrador sempre vê tudo. Setor sem função salva vê tudo.
        </p>
      </header>

      <label style={{ display: "grid", gap: 4 }}>
        <span>Setor</span>
        <select value={setorId ?? ""} onChange={(e) => setSetorId(Number(e.target.value))}>
          {dados.data!.setores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} — {s.pessoas} {s.pessoas === 1 ? "pessoa" : "pessoas"}{s.modulos ? " · personalizado" : ""}
            </option>
          ))}
        </select>
      </label>

      {setor && (
        <>
          {grupos.map((g) => (
            <fieldset key={g} style={{ border: "1px solid rgba(128,128,128,.3)", borderRadius: 8, padding: "8px 14px" }}>
              <legend>{g}</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 6 }}>
                {todos.filter((m) => m.grupo === g).map((m) => (
                  <label key={m.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={marcados.has(m.id)} onChange={() => alternar(m.id)} />
                    {m.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p style={{ margin: 0, opacity: 0.7 }}>Início, Perfil, Configurações e Notificações ficam sempre liberados.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={salvar.isPending} onClick={() => salvar.mutate([...marcados])}>
              <Save size={15} aria-hidden="true" /> Salvar função de {setor.nome}
            </button>
            <button type="button" disabled={salvar.isPending || !setor.modulos} onClick={() => salvar.mutate(null)}>
              <RotateCcw size={15} aria-hidden="true" /> Voltar ao padrão (ver tudo)
            </button>
          </div>
          {aviso && <p role="status">{aviso}</p>}
          {erro && <p role="alert">{erro}</p>}
        </>
      )}
    </section>
  );
}
