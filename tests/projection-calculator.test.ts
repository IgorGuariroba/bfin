import { describe, it, expect } from "vitest";
import { calcularMes } from "../src/services/projection-engine/calculator.js";
import { toCents } from "../src/lib/money.js";
import {
  calcularReservaIdealCentavos,
  classificarIndicador,
} from "../src/services/projection-engine/reserve-indicator.js";

describe("calcularMes", () => {
  it("returns an entry per day with no movements", () => {
    const result = calcularMes({
      saldoInicialCentavos: 100000n,
      mes: "2024-03",
      receitas: [],
      despesas: [],
      parcelas: [],
      meta: null,
    });
    expect(result.dias).toHaveLength(31);
    expect(result.dias[0].saldo_projetado).toBe("1000.00");
    expect(result.dias[30].saldo_projetado).toBe("1000.00");
    expect(result.resumo.saldo_final_projetado).toBe("1000.00");
    expect(result.resumo.total_receitas).toBe("0.00");
    expect(result.resumo.indicador_reserva_final).toBeNull();
  });

  it("accumulates receitas e despesas dia a dia", () => {
    const result = calcularMes({
      saldoInicialCentavos: toCents(3000),
      mes: "2024-03",
      receitas: [
        {
          id: "r1",
          valor: "500.00",
          data: new Date(Date.UTC(2024, 2, 5)),
          recorrente: false,
          dataFim: null,
        },
      ],
      despesas: [
        {
          id: "d1",
          valor: "200.00",
          data: new Date(Date.UTC(2024, 2, 5)),
          recorrente: false,
          dataFim: null,
        },
      ],
      parcelas: [],
      meta: null,
    });
    expect(result.dias[3].saldo_projetado).toBe("3000.00");
    expect(result.dias[4].saldo_projetado).toBe("3300.00");
    expect(result.resumo.total_receitas).toBe("500.00");
    expect(result.resumo.total_despesas).toBe("200.00");
  });

  it("replicates recorrente até data_fim", () => {
    const result = calcularMes({
      saldoInicialCentavos: 0n,
      mes: "2024-07",
      receitas: [
        {
          id: "r-rec",
          valor: "1000.00",
          data: new Date(Date.UTC(2024, 0, 15)),
          recorrente: true,
          dataFim: new Date(Date.UTC(2024, 5, 30)),
        },
      ],
      despesas: [],
      parcelas: [],
      meta: null,
    });
    expect(result.resumo.total_receitas).toBe("0.00");
  });

  it("replicates recorrente sem data_fim no mês futuro", () => {
    const result = calcularMes({
      saldoInicialCentavos: 0n,
      mes: "2024-07",
      receitas: [
        {
          id: "r-rec",
          valor: "1000.00",
          data: new Date(Date.UTC(2024, 0, 15)),
          recorrente: true,
          dataFim: null,
        },
      ],
      despesas: [],
      parcelas: [],
      meta: null,
    });
    expect(result.resumo.total_receitas).toBe("1000.00");
    expect(result.dias[14].receitas_dia).toBe("1000.00");
  });

  it("não aplica parcela futura antes do vencimento", () => {
    const result = calcularMes({
      saldoInicialCentavos: toCents(2000),
      mes: "2024-03",
      receitas: [],
      despesas: [],
      parcelas: [
        {
          id: "p1",
          valor: "500.00",
          dataVencimento: new Date(Date.UTC(2024, 2, 15)),
          dataPagamento: null,
        },
      ],
      meta: null,
    });
    expect(result.dias[9].total_dividas_pendentes).toBe("0.00");
    expect(result.dias[9].saldo_liquido).toBe("2000.00");
    expect(result.dias[14].total_dividas_pendentes).toBe("500.00");
    expect(result.dias[14].saldo_liquido).toBe("1500.00");
  });

  it("soma múltiplas parcelas vencidas não pagas", () => {
    const result = calcularMes({
      saldoInicialCentavos: toCents(2000),
      mes: "2024-03",
      receitas: [],
      despesas: [],
      parcelas: [
        {
          id: "p1",
          valor: "300.00",
          dataVencimento: new Date(Date.UTC(2024, 2, 1)),
          dataPagamento: null,
        },
        {
          id: "p2",
          valor: "400.00",
          dataVencimento: new Date(Date.UTC(2024, 2, 15)),
          dataPagamento: null,
        },
      ],
      meta: null,
    });
    expect(result.dias[19].total_dividas_pendentes).toBe("700.00");
    expect(result.resumo.total_dividas_pendentes).toBe("700.00");
  });

  it("desconta parcela paga do saldo no dia do pagamento", () => {
    const result = calcularMes({
      saldoInicialCentavos: toCents(2000),
      mes: "2024-03",
      receitas: [],
      despesas: [],
      parcelas: [
        {
          id: "p1",
          valor: "500.00",
          dataVencimento: new Date(Date.UTC(2024, 2, 15)),
          dataPagamento: new Date(Date.UTC(2024, 2, 10)),
        },
      ],
      meta: null,
    });
    expect(result.dias[9].parcelas_pagas_dia).toBe("500.00");
    expect(result.dias[9].saldo_projetado).toBe("1500.00");
    expect(result.dias[14].total_dividas_pendentes).toBe("0.00");
  });

  it("define reserva_ideal e indicador com meta", () => {
    const result = calcularMes({
      saldoInicialCentavos: toCents(1000),
      mes: "2024-03",
      receitas: [
        {
          id: "r1",
          valor: "5000.00",
          data: new Date(Date.UTC(2024, 2, 5)),
          recorrente: false,
          dataFim: null,
        },
      ],
      despesas: [
        {
          id: "d1",
          valor: "2500.00",
          data: new Date(Date.UTC(2024, 2, 10)),
          recorrente: false,
          dataFim: null,
        },
      ],
      parcelas: [],
      meta: { porcentagemReserva: "20.00" },
    });
    expect(result.resumo.reserva_ideal).toBe("1000.00");
    expect(result.resumo.saldo_final_projetado).toBe("3500.00");
    expect(result.resumo.reserva_atingida).toBe(true);
    expect(result.resumo.indicador_reserva_final).toBe("verde");
  });
});

describe("reserve-indicator helpers", () => {
  it("calcularReservaIdealCentavos aplica porcentagem", () => {
    expect(calcularReservaIdealCentavos(toCents(5000), "20")).toBe(toCents(1000));
    expect(calcularReservaIdealCentavos(toCents(1234.56), "15.50")).toBe(
      toCents(191.36)
    );
  });

  it("classificarIndicador distingue verde/amarelo/vermelho", () => {
    expect(classificarIndicador(toCents(1200), toCents(1000))).toBe("verde");
    expect(classificarIndicador(toCents(500), toCents(1000))).toBe("amarelo");
    expect(classificarIndicador(toCents(0), toCents(1000))).toBe("vermelho");
    expect(classificarIndicador(toCents(-200), toCents(1000))).toBe("vermelho");
  });
});
