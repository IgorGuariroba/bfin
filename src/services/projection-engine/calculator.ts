import { toCents, fromCents } from "../../lib/money.js";
import {
  daysInMonth,
  firstDayOfMonth,
  lastDayOfMonth,
  parseMonthKey,
} from "../../lib/month.js";
import {
  calcularReservaIdealCentavos,
  classificarIndicador,
} from "./reserve-indicator.js";
import type {
  CalcularMesInput,
  DiaProjecao,
  IndicadorReserva,
  ProjecaoMensal,
  ProjecaoMovimentacaoInput,
  ProjecaoParcelaInput,
  ResumoMes,
} from "./types.js";

function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sameUTCDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function occurrenceInMonth(
  original: Date,
  year: number,
  month: number
): Date | null {
  const originalDay = original.getUTCDate();
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(originalDay, last);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate;
}

function expandOccurrences(
  items: ProjecaoMovimentacaoInput[],
  mesInicio: Date,
  mesFim: Date,
  year: number,
  month: number
): Array<{ data: Date; valor: bigint }> {
  const result: Array<{ data: Date; valor: bigint }> = [];
  for (const item of items) {
    const valor = toCents(item.valor);
    if (!item.recorrente) {
      if (item.data >= mesInicio && item.data <= mesFim) {
        result.push({ data: item.data, valor });
      }
      continue;
    }
    if (item.data > mesFim) continue;
    if (item.dataFim !== null && item.dataFim < mesInicio) continue;
    const occurrence = occurrenceInMonth(item.data, year, month);
    if (occurrence === null) continue;
    if (item.dataFim !== null && occurrence > item.dataFim) continue;
    if (occurrence < item.data) continue;
    result.push({ data: occurrence, valor });
  }
  return result;
}

export function calcularMes(input: CalcularMesInput): ProjecaoMensal {
  const { year, month } = parseMonthKey(input.mes);
  const mesInicio = firstDayOfMonth(input.mes);
  const mesFim = lastDayOfMonth(input.mes);
  const totalDias = daysInMonth(input.mes);

  const receitasOcor = expandOccurrences(
    input.receitas,
    mesInicio,
    mesFim,
    year,
    month
  );
  const despesasOcor = expandOccurrences(
    input.despesas,
    mesInicio,
    mesFim,
    year,
    month
  );

  const parcelasPagasNoMes: Array<{ data: Date; valor: bigint }> = [];
  for (const p of input.parcelas) {
    if (p.dataPagamento === null) continue;
    if (p.dataPagamento < mesInicio || p.dataPagamento > mesFim) continue;
    parcelasPagasNoMes.push({
      data: p.dataPagamento,
      valor: toCents(p.valor),
    });
  }

  const parcelasPendentes: Array<{ vencimento: Date; valor: bigint }> = [];
  for (const p of input.parcelas) {
    if (p.dataPagamento !== null) continue;
    parcelasPendentes.push({
      vencimento: p.dataVencimento,
      valor: toCents(p.valor),
    });
  }

  let receitasBrutasCentavos = 0n;
  for (const r of receitasOcor) receitasBrutasCentavos += r.valor;

  let reservaIdealCentavos: bigint | null = null;
  if (input.meta !== null) {
    reservaIdealCentavos = calcularReservaIdealCentavos(
      receitasBrutasCentavos,
      input.meta.porcentagemReserva
    );
  }

  const dias: DiaProjecao[] = [];
  let saldoProjetado = input.saldoInicialCentavos;
  let totalReceitas = 0n;
  let totalDespesas = 0n;
  let totalParcelasPagas = 0n;

  for (let d = 1; d <= totalDias; d++) {
    const currentDate = new Date(Date.UTC(year, month - 1, d));
    let receitasDia = 0n;
    let despesasDia = 0n;
    let parcelasPagasDia = 0n;

    for (const r of receitasOcor) {
      if (sameUTCDay(r.data, currentDate)) receitasDia += r.valor;
    }
    for (const e of despesasOcor) {
      if (sameUTCDay(e.data, currentDate)) despesasDia += e.valor;
    }
    for (const p of parcelasPagasNoMes) {
      if (sameUTCDay(p.data, currentDate)) parcelasPagasDia += p.valor;
    }

    saldoProjetado = saldoProjetado + receitasDia - despesasDia - parcelasPagasDia;
    totalReceitas += receitasDia;
    totalDespesas += despesasDia;
    totalParcelasPagas += parcelasPagasDia;

    let totalDividasPendentes = 0n;
    for (const p of parcelasPendentes) {
      if (p.vencimento <= currentDate) {
        totalDividasPendentes += p.valor;
      }
    }

    const saldoLiquido = saldoProjetado - totalDividasPendentes;

    let indicador: IndicadorReserva | null = null;
    if (reservaIdealCentavos !== null) {
      indicador = classificarIndicador(saldoLiquido, reservaIdealCentavos);
    }

    dias.push({
      data: ymd(currentDate),
      saldo_projetado: fromCents(saldoProjetado),
      receitas_dia: fromCents(receitasDia),
      despesas_dia: fromCents(despesasDia),
      parcelas_pagas_dia: fromCents(parcelasPagasDia),
      total_dividas_pendentes: fromCents(totalDividasPendentes),
      saldo_liquido: fromCents(saldoLiquido),
      indicador_reserva: indicador,
    });
  }

  const ultimo = dias[dias.length - 1];
  const totalDividasFimMes = toCents(ultimo.total_dividas_pendentes);
  const saldoFinal = saldoProjetado;
  const saldoLiquidoFinal = saldoFinal - totalDividasFimMes;

  let reservaIdealOut: string | null = null;
  let reservaAtingida: boolean | null = null;
  let indicadorFinal: IndicadorReserva | null = null;

  if (reservaIdealCentavos !== null) {
    reservaIdealOut = fromCents(reservaIdealCentavos);
    reservaAtingida = saldoLiquidoFinal >= reservaIdealCentavos;
    indicadorFinal = classificarIndicador(saldoLiquidoFinal, reservaIdealCentavos);
  }

  const resumo: ResumoMes = {
    total_receitas: fromCents(totalReceitas),
    total_despesas: fromCents(totalDespesas),
    total_parcelas_pagas: fromCents(totalParcelasPagas),
    total_dividas_pendentes: fromCents(totalDividasFimMes),
    saldo_final_projetado: fromCents(saldoFinal),
    saldo_liquido_final: fromCents(saldoLiquidoFinal),
    reserva_ideal: reservaIdealOut,
    reserva_atingida: reservaAtingida,
    indicador_reserva_final: indicadorFinal,
  };

  return { dias, resumo };
}

export function saldoFinalCentavos(dias: DiaProjecao[]): bigint {
  const ultimo = dias[dias.length - 1];
  return toCents(ultimo.saldo_projetado);
}
