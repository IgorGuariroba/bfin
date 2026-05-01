import { eq, count, desc, sql, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { dividas, parcelasDivida, movimentacoes, categorias, tipoCategorias } from "../db/schema.js";
import { NotFoundError, BusinessRuleError, AlreadyPaidError, DebtHasPaymentsError } from "../lib/errors.js";
import { assertNotDemoAccount } from "../lib/demo-account.js";
import { invalidateProjections } from "./projection-invalidation.js";

export interface CreateDebtInput {
  contaId: string;
  categoriaId: string;
  descricao: string;
  valorTotal: number;
  totalParcelas: number;
  dataInicio: Date;
}

export interface DebtFilters {
  contaId: string;
  status?: "pendente" | "quitada";
  page?: number;
  limit?: number;
}

export interface PaginatedDebts {
  data: Array<{
    id: string;
    conta_id: string;
    categoria: { id: string; nome: string };
    descricao: string;
    valor_total: string;
    total_parcelas: number;
    valor_parcela: string;
    data_inicio: Date;
    total_parcelas_count: number;
    parcelas_pagas: number;
    parcelas_pendentes: number;
    created_at: Date;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ConfirmPaymentInput {
  dataPagamento: Date;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  const expectedMonth = ((targetMonth % 12) + 12) % 12;
  if (result.getMonth() !== expectedMonth) {
    result.setDate(0);
  }
  return result;
}

async function validateCategoriaDivida(categoriaId: string): Promise<void> {
  const categoria = await db
    .select({ slug: tipoCategorias.slug })
    .from(categorias)
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .where(eq(categorias.id, categoriaId))
    .limit(1);

  if (categoria.length === 0) {
    throw new BusinessRuleError("Categoria not found");
  }

  if (categoria[0].slug !== "divida") {
    throw new BusinessRuleError("Categoria must be of type 'divida'");
  }
}

export function generateInstallments(
  valorTotal: number,
  totalParcelas: number,
  dataInicio: Date
): Array<{ numero: number; valor: number; dataVencimento: Date }> {
  const totalCentavos = Math.round(valorTotal * 100);
  const baseCentavos = Math.floor(totalCentavos / totalParcelas);
  const residuoCentavos = totalCentavos - baseCentavos * totalParcelas;

  return Array.from({ length: totalParcelas }, (_, i) => {
    const numero = i + 1;
    const centavos = numero === totalParcelas ? baseCentavos + residuoCentavos : baseCentavos;
    return {
      numero,
      valor: centavos / 100,
      dataVencimento: addMonths(dataInicio, i),
    };
  });
}

export async function createDebt(input: CreateDebtInput, usuarioId: string) {
  assertNotDemoAccount(input.contaId);
  if (input.valorTotal <= 0) {
    throw new BusinessRuleError("valor_total must be greater than zero");
  }
  if (input.totalParcelas < 1) {
    throw new BusinessRuleError("total_parcelas must be at least 1");
  }

  await validateCategoriaDivida(input.categoriaId);

  const parcelas = generateInstallments(input.valorTotal, input.totalParcelas, input.dataInicio);
  const valorParcelaBase = parcelas[0].valor;

  let createdId: string;

  await db.transaction(async (tx) => {
    const [divida] = await tx
      .insert(dividas)
      .values({
        contaId: input.contaId,
        usuarioId,
        categoriaId: input.categoriaId,
        descricao: input.descricao,
        valorTotal: String(input.valorTotal),
        totalParcelas: input.totalParcelas,
        valorParcela: String(valorParcelaBase),
        dataInicio: input.dataInicio,
      })
      .returning();

    createdId = divida.id;

    await tx.insert(parcelasDivida).values(
      parcelas.map((p) => ({
        dividaId: divida.id,
        numeroParcela: p.numero,
        valor: String(p.valor),
        dataVencimento: p.dataVencimento,
      }))
    );
  });

  await invalidateProjections(input.contaId, input.dataInicio);

  return findDebtById(createdId!);
}

export async function findDebtById(id: string) {
  const divida = await db
    .select({
      id: dividas.id,
      contaId: dividas.contaId,
      categoriaId: categorias.id,
      categoriaNome: categorias.nome,
      descricao: dividas.descricao,
      valorTotal: dividas.valorTotal,
      totalParcelas: dividas.totalParcelas,
      valorParcela: dividas.valorParcela,
      dataInicio: dividas.dataInicio,
      createdAt: dividas.createdAt,
      updatedAt: dividas.updatedAt,
    })
    .from(dividas)
    .innerJoin(categorias, eq(dividas.categoriaId, categorias.id))
    .where(eq(dividas.id, id))
    .limit(1);

  if (divida.length === 0) return null;

  const row = divida[0];

  const parcelas = await db
    .select()
    .from(parcelasDivida)
    .where(eq(parcelasDivida.dividaId, id))
    .orderBy(asc(parcelasDivida.numeroParcela));

  return {
    id: row.id,
    conta_id: row.contaId,
    categoria: { id: row.categoriaId, nome: row.categoriaNome },
    descricao: row.descricao,
    valor_total: row.valorTotal,
    total_parcelas: row.totalParcelas,
    valor_parcela: row.valorParcela,
    data_inicio: row.dataInicio,
    parcelas: parcelas.map((p) => ({
      id: p.id,
      numero_parcela: p.numeroParcela,
      valor: p.valor,
      data_vencimento: p.dataVencimento,
      data_pagamento: p.dataPagamento,
      created_at: p.createdAt,
    })),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function findDebtsByAccount(filters: DebtFilters): Promise<PaginatedDebts> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 10));
  const offset = (page - 1) * limit;

  const parcelasPagasExpr = sql<number>`COUNT(${parcelasDivida.id}) FILTER (WHERE ${parcelasDivida.dataPagamento} IS NOT NULL)`;
  const parcelasPendentesExpr = sql<number>`COUNT(${parcelasDivida.id}) FILTER (WHERE ${parcelasDivida.dataPagamento} IS NULL)`;

  let havingClause = sql`1=1`;
  if (filters.status === "quitada") {
    havingClause = sql`COUNT(${parcelasDivida.id}) FILTER (WHERE ${parcelasDivida.dataPagamento} IS NULL) = 0`;
  } else if (filters.status === "pendente") {
    havingClause = sql`COUNT(${parcelasDivida.id}) FILTER (WHERE ${parcelasDivida.dataPagamento} IS NULL) > 0`;
  }

  const baseQuery = db
    .select({
      id: dividas.id,
      contaId: dividas.contaId,
      categoriaId: categorias.id,
      categoriaNome: categorias.nome,
      descricao: dividas.descricao,
      valorTotal: dividas.valorTotal,
      totalParcelas: dividas.totalParcelas,
      valorParcela: dividas.valorParcela,
      dataInicio: dividas.dataInicio,
      createdAt: dividas.createdAt,
      totalParcelasCount: sql<number>`COUNT(${parcelasDivida.id})`,
      parcelasPagas: parcelasPagasExpr,
      parcelasPendentes: parcelasPendentesExpr,
    })
    .from(dividas)
    .innerJoin(categorias, eq(dividas.categoriaId, categorias.id))
    .leftJoin(parcelasDivida, eq(parcelasDivida.dividaId, dividas.id))
    .where(eq(dividas.contaId, filters.contaId))
    .groupBy(dividas.id, categorias.id)
    .having(havingClause);

  const [rows, countRows] = await Promise.all([
    baseQuery.orderBy(desc(dividas.createdAt)).limit(limit).offset(offset),
    db
      .select({ total: count() })
      .from(
        db
          .select({ id: dividas.id })
          .from(dividas)
          .leftJoin(parcelasDivida, eq(parcelasDivida.dividaId, dividas.id))
          .where(eq(dividas.contaId, filters.contaId))
          .groupBy(dividas.id)
          .having(havingClause)
          .as("sub")
      ),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.ceil(total / limit);

  return {
    data: rows.map((row) => ({
      id: row.id,
      conta_id: row.contaId,
      categoria: { id: row.categoriaId, nome: row.categoriaNome },
      descricao: row.descricao,
      valor_total: row.valorTotal,
      total_parcelas: row.totalParcelas,
      valor_parcela: row.valorParcela,
      data_inicio: row.dataInicio,
      total_parcelas_count: Number(row.totalParcelasCount),
      parcelas_pagas: Number(row.parcelasPagas),
      parcelas_pendentes: Number(row.parcelasPendentes),
      created_at: row.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
}

export async function deleteDebt(id: string) {
  const { contaId, dataInicio } = await db.transaction(async (tx) => {
    const divida = await tx
      .select({ id: dividas.id, contaId: dividas.contaId, dataInicio: dividas.dataInicio })
      .from(dividas)
      .where(eq(dividas.id, id))
      .limit(1);

    if (divida.length === 0) {
      throw new NotFoundError("Debt not found");
    }

    assertNotDemoAccount(divida[0].contaId);

    const lockedParcelas = await tx.execute(
      sql`SELECT id, data_pagamento FROM parcelas_divida WHERE divida_id = ${id} FOR UPDATE`
    );

    const hasPaid = lockedParcelas.some((p: Record<string, unknown>) => p.data_pagamento !== null);

    if (hasPaid) {
      throw new DebtHasPaymentsError("Cannot delete debt with paid installments");
    }

    await tx.delete(dividas).where(eq(dividas.id, id));

    return { contaId: divida[0].contaId, dataInicio: divida[0].dataInicio };
  });

  await invalidateProjections(contaId, dataInicio);
}

export async function confirmInstallmentPayment(
  dividaId: string,
  parcelaId: string,
  input: ConfirmPaymentInput,
  usuarioId: string
) {
  return await db.transaction(async (tx) => {
    const [parcelaRow] = await tx.execute(
      sql`SELECT p.*, d.conta_id, d.categoria_id, d.descricao as divida_descricao, d.total_parcelas
          FROM parcelas_divida p
          JOIN dividas d ON d.id = p.divida_id
          WHERE p.id = ${parcelaId} AND p.divida_id = ${dividaId}
          FOR UPDATE`
    );

    if (!parcelaRow) {
      throw new NotFoundError("Installment not found");
    }

    assertNotDemoAccount(parcelaRow.conta_id as string);

    if (parcelaRow.data_pagamento != null) {
      throw new AlreadyPaidError("Installment has already been paid");
    }

    const now = new Date();

    await tx
      .update(parcelasDivida)
      .set({ dataPagamento: input.dataPagamento, updatedAt: now })
      .where(eq(parcelasDivida.id, parcelaId));

    const descricaoMovimentacao = `Parcela ${parcelaRow.numero_parcela}/${parcelaRow.total_parcelas} — ${parcelaRow.divida_descricao}`;

    const [movimentacao] = await tx
      .insert(movimentacoes)
      .values({
        contaId: parcelaRow.conta_id as string,
        usuarioId,
        categoriaId: parcelaRow.categoria_id as string,
        descricao: descricaoMovimentacao,
        valor: String(parcelaRow.valor),
        data: input.dataPagamento,
        recorrente: false,
        parcelaDividaId: parcelaId,
      })
      .returning();

    const dataVencimento = new Date(parcelaRow.data_vencimento as string);
    const dataReferencia =
      input.dataPagamento < dataVencimento ? input.dataPagamento : dataVencimento;
    await invalidateProjections(parcelaRow.conta_id as string, dataReferencia);

    const parcelaAtualizada = await tx
      .select()
      .from(parcelasDivida)
      .where(eq(parcelasDivida.id, parcelaId))
      .limit(1);

    return {
      id: parcelaAtualizada[0].id,
      numero_parcela: parcelaAtualizada[0].numeroParcela,
      valor: parcelaAtualizada[0].valor,
      data_vencimento: parcelaAtualizada[0].dataVencimento,
      data_pagamento: parcelaAtualizada[0].dataPagamento,
      movimentacao_gerada: {
        id: movimentacao.id,
        tipo: "despesa" as const,
        valor: movimentacao.valor,
        data: movimentacao.data,
        parcela_divida_id: movimentacao.parcelaDividaId,
      },
    };
  });
}
