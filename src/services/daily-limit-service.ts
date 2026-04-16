import { and, eq, gte, lte, isNull, or, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  contas,
  movimentacoes,
  categorias,
  tipoCategorias,
  dividas,
  parcelasDivida,
} from "../db/schema.js";
import {
  firstDayOfMonth,
  lastDayOfMonth,
  monthKey,
} from "../lib/month.js";
import { toCents, fromCents, roundCentsHalfEven } from "../lib/money.js";
import { NotFoundError } from "../lib/errors.js";

export interface CalcularLimiteDiarioInput {
  contaId: string;
  hoje?: Date;
}

export interface LimiteDiarioResult {
  mes_referencia: string;
  saldo_disponivel: string;
  despesas_fixas_pendentes: string;
  dias_restantes: number;
  limite_diario: string;
  calculado_em: string;
}

export async function calcularLimiteDiario(
  input: CalcularLimiteDiarioInput
): Promise<LimiteDiarioResult> {
  const now = input.hoje ?? new Date();
  const mes = monthKey(now);
  const mesInicio = firstDayOfMonth(mes);
  const mesFim = lastDayOfMonth(mes);
  const ultimoDia = mesFim.getUTCDate();
  const hojeDia = now.getUTCDate();
  const diasRestantes = ultimoDia - hojeDia + 1;

  const contaRows = await db
    .select({ id: contas.id, saldoInicial: contas.saldoInicial })
    .from(contas)
    .where(eq(contas.id, input.contaId))
    .limit(1);
  if (contaRows.length === 0) {
    throw new NotFoundError("Conta not found");
  }
  let saldoConta = toCents(contaRows[0].saldoInicial);

  const movimentacoesRealizadas = await db
    .select({
      valor: movimentacoes.valor,
      tipo: tipoCategorias.slug,
    })
    .from(movimentacoes)
    .innerJoin(categorias, eq(movimentacoes.categoriaId, categorias.id))
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .where(
      and(
        eq(movimentacoes.contaId, input.contaId),
        lte(movimentacoes.data, now),
        inArray(tipoCategorias.slug, ["receita", "despesa"])
      )
    );

  for (const row of movimentacoesRealizadas) {
    const cents = toCents(row.valor);
    if (row.tipo === "receita") saldoConta += cents;
    else if (row.tipo === "despesa") saldoConta -= cents;
  }

  const recorrentesDoMes = await db
    .select({
      valor: movimentacoes.valor,
      data: movimentacoes.data,
      dataFim: movimentacoes.dataFim,
    })
    .from(movimentacoes)
    .innerJoin(categorias, eq(movimentacoes.categoriaId, categorias.id))
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .where(
      and(
        eq(movimentacoes.contaId, input.contaId),
        eq(tipoCategorias.slug, "despesa"),
        eq(movimentacoes.recorrente, true),
        lte(movimentacoes.data, mesFim),
        or(isNull(movimentacoes.dataFim), gte(movimentacoes.dataFim, mesInicio))
      )
    );

  let despesasPendentes = 0n;
  for (const r of recorrentesDoMes) {
    const originalDay = r.data.getUTCDate();
    const occurrenceDay = Math.min(originalDay, ultimoDia);
    const occurrence = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), occurrenceDay)
    );
    if (r.data > occurrence) continue;
    if (r.dataFim !== null && occurrence > r.dataFim) continue;
    if (occurrence <= now) continue;
    despesasPendentes += toCents(r.valor);
  }

  const parcelasPendentes = await db
    .select({ valor: parcelasDivida.valor })
    .from(parcelasDivida)
    .innerJoin(dividas, eq(parcelasDivida.dividaId, dividas.id))
    .where(
      and(
        eq(dividas.contaId, input.contaId),
        isNull(parcelasDivida.dataPagamento),
        gte(parcelasDivida.dataVencimento, mesInicio),
        lte(parcelasDivida.dataVencimento, mesFim)
      )
    );

  for (const p of parcelasPendentes) {
    despesasPendentes += toCents(p.valor);
  }

  const saldoDisponivel = saldoConta - despesasPendentes;
  let limiteDiarioCentavos: bigint;
  if (saldoDisponivel <= 0n) {
    limiteDiarioCentavos = 0n;
  } else if (diasRestantes <= 1) {
    limiteDiarioCentavos = saldoDisponivel;
  } else {
    limiteDiarioCentavos = roundCentsHalfEven(
      saldoDisponivel,
      BigInt(diasRestantes)
    );
  }

  return {
    mes_referencia: mes,
    saldo_disponivel: fromCents(saldoDisponivel),
    despesas_fixas_pendentes: fromCents(despesasPendentes),
    dias_restantes: diasRestantes,
    limite_diario: fromCents(limiteDiarioCentavos),
    calculado_em: now.toISOString(),
  };
}
