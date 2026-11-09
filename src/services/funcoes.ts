import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useSession } from "../stores/workspace";

/** Módulos liberados para a pessoa pelo setor dela (Admin > Funções). `null` = sem restrição. */
export function useFuncoes() {
  const user = useSession((s) => s.user);
  const q = useQuery({
    queryKey: ["funcoes", user?.id],
    queryFn: async () => (await api.get<{ modulos: string[] | null }>("/me/funcoes")).data.modulos,
    enabled: !!user,
    staleTime: 60000,
  });
  const lista = q.data ?? null;
  const admin = user?.perfil === "admin";
  return {
    /** Enquanto carrega ou se der erro, não esconde nada (o servidor continua barrando o que for sensível). */
    pode: (id: string) => admin || lista === null || lista.includes(id),
  };
}
