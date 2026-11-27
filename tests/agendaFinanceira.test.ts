import { describe, expect, it } from "vitest";
import type { Ocorrencia } from "../src/services/agendaFinanceira";
import { FILTROS_VAZIOS, formatarEspera, passaNosFiltros, type Filtros } from "../src/services/agendaFinanceiraLogica";
import { isAgendaWrite } from "../electron/policy";

const oc = (extra: Partial<Ocorrencia> = {}): Ocorrencia => ({
  id: "1", numero: "27112026101010", cliente: "Maria da Silva", contrato: 4242, contratoStatus: "Ativo", tipo: "ATIVAÇÃO DE CONTRATO - COMUM", metodo: "Telefone", pop: "", status: "Aberta", statusId: 0,
  statusRotulo: "Aguardando distribuição", abertoEm: "2026-11-27T13:10:10.000Z", aberturaComHora: true, aguardandoMin: 30, prioridade: "normal", dataAgendamento: "", dataFinalizacao: "", usuarioFinalizacao: "", usuarioAbertura: "",
  responsavelSgp: null, responsavel: null, responsavelUsuario: null, outroResponsavel: null, origemResponsavel: "sgp", naoGravadoNoSgp: false, ordem: null, versao: 0, descricao: "", observacoes: [], ordensServico: 0, linkSgp: "", ...extra,
});
const filtros = (f: Partial<Filtros>): Filtros => ({ ...FILTROS_VAZIOS, ...f });

describe("Agenda Financeira: formatação", () => {
  it("espera em minutos, horas e dias", () => {
    expect(formatarEspera(null)).toBe("—");
    expect(formatarEspera(0)).toBe("agora");
    expect(formatarEspera(45)).toBe("45 min");
    expect(formatarEspera(60)).toBe("1h");
    expect(formatarEspera(135)).toBe("2h 15min");
    expect(formatarEspera(1440)).toBe("1 dia");
    expect(formatarEspera(3000)).toBe("2 dias 2h");
  });
});

describe("Agenda Financeira: filtros e pesquisa", () => {
  it("filtra por colaboradora, fila, status, prioridade, tipo e sem responsável", () => {
    const na = oc({ id: "2", responsavel: "carina", responsavelUsuario: "carinamacedo", statusRotulo: "Pendente", prioridade: "urgente" });
    expect(passaNosFiltros(na, filtros({ colaboradora: "carina" }), "carina")).toBe(true);
    expect(passaNosFiltros(na, filtros({ colaboradora: "helena" }), "carina")).toBe(false);
    expect(passaNosFiltros(oc(), filtros({ colaboradora: "fila" }), null)).toBe(true);
    expect(passaNosFiltros(na, filtros({ status: "Pendente" }), "carina")).toBe(true);
    expect(passaNosFiltros(na, filtros({ status: "Em atendimento" }), "carina")).toBe(false);
    expect(passaNosFiltros(na, filtros({ prioridade: "urgente" }), "carina")).toBe(true);
    expect(passaNosFiltros(na, filtros({ prioridade: "normal" }), "carina")).toBe(false);
    expect(passaNosFiltros(na, filtros({ tipo: "ATIVAÇÃO DE CONTRATO - TELEFONE FIXO" }), "carina")).toBe(false);
    expect(passaNosFiltros(na, filtros({ semResponsavel: true }), "carina")).toBe(false);
    expect(passaNosFiltros(oc(), filtros({ semResponsavel: true }), null)).toBe(true);
    // responsável de outro setor no SGP não é "sem responsável"
    expect(passaNosFiltros(oc({ responsavelUsuario: "carloshenrique", outroResponsavel: "carloshenrique" }), filtros({ semResponsavel: true }), null)).toBe(false);
  });
  it("pesquisa cliente (sem acento/caixa), contrato, número e CPF resolvido pelo servidor", () => {
    expect(passaNosFiltros(oc(), filtros({ busca: "MARIA" }), null)).toBe(true);
    expect(passaNosFiltros(oc({ cliente: "José Antônio" }), filtros({ busca: "jose antonio" }), null)).toBe(true);
    expect(passaNosFiltros(oc(), filtros({ busca: "4242" }), null)).toBe(true);
    expect(passaNosFiltros(oc(), filtros({ busca: "27112026" }), null)).toBe(true);
    expect(passaNosFiltros(oc(), filtros({ busca: "pedro" }), null)).toBe(false);
    expect(passaNosFiltros(oc(), filtros({ busca: "123.456.789-09", idsDocumento: ["1"] }), null)).toBe(true);
    expect(passaNosFiltros(oc({ id: "9" }), filtros({ busca: "123.456.789-09", idsDocumento: ["1"] }), null)).toBe(false);
  });
});

describe("Agenda Financeira: permissão de escrita no desktop", () => {
  it("só POST /api/agenda-financeira/mover com a sessão da agenda", () => {
    expect(isAgendaWrite("agenda", "POST", "/api/agenda-financeira/mover", "sessao")).toBe(true);
    expect(isAgendaWrite("agenda", "POST", "/api/agenda-financeira/mover", undefined)).toBe(false);
    expect(isAgendaWrite("agenda", "PUT", "/api/agenda-financeira/mover", "sessao")).toBe(false);
    expect(isAgendaWrite("agenda", "POST", "/api/agenda-financeira/outra", "sessao")).toBe(false);
    expect(isAgendaWrite("chat", "POST", "/api/agenda-financeira/mover", "sessao")).toBe(false);
  });
});
