import { and, eq, lte, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { contas, movimentacoes, categorias, tipoCategorias } from "../db/schema.js";
import { toCents, fromCents, roundCentsHalfEven } from "../lib/money.js";
import { NotFoundError } from "../lib/errors.js";

export interface CalcularLimiteDiarioV2Input {
  contaId: string;
  hoje?: Date;
}

export interface LimiteDiarioV2Result {
  janela_inicio: string;
  janela_fim: string;
  horizonte_dias: number;
  saldo_atual: string;
  limite_diario: string;
  calculado_em: string;
}

export async function calcularLimiteDiarioV2(
  input: CalcularLimiteDiarioV2Input
): Promise<LimiteDiarioV2Result> {
  const now = input.hoje ?? new Date();

  const contaRows = await db
    .select({ id: contas.id, saldoInicial: contas.saldoInicial })
    .from(contas)
    .where(eq(contas.id, input.contaId))
    .limit(1);
  if (contaRows.length === 0) {
    throw new NotFoundError("Conta not found");
  }

  let saldoCents = toCents(contaRows[0].saldoInicial);

  const movs = await db
    .select({ valor: movimentacoes.valor, tipo: tipoCategorias.slug })
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

  for (const row of movs) {
    const cents = toCents(row.valor);
    if (row.tipo === "receita") saldoCents += cents;
    else saldoCents -= cents;
  }

  const limiteDiarioCents =
    saldoCents <= 0n ? 0n : roundCentsHalfEven(saldoCents, 30n);

  const janelaFim = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    janela_inicio: now.toISOString(),
    janela_fim: janelaFim.toISOString(),
    horizonte_dias: 30,
    saldo_atual: fromCents(saldoCents),
    limite_diario: fromCents(limiteDiarioCents),
    calculado_em: now.toISOString(),
  };
}
