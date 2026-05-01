import { eq, and, ilike, count, desc, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { movimentacoes, categorias, tipoCategorias, usuarios } from "../db/schema.js";
import { NotFoundError, BusinessRuleError, SystemGeneratedResourceError } from "../lib/errors.js";
import { assertNotDemoAccount } from "../lib/demo-account.js";
import { invalidateProjections } from "./projection-invalidation.js";

export interface CreateTransactionInput {
  contaId: string;
  tipo: "receita" | "despesa";
  categoriaId: string;
  descricao?: string;
  valor: number;
  data: Date;
  recorrente?: boolean;
  dataFim?: Date | null;
}

export interface UpdateTransactionInput {
  contaId?: string;
  tipo?: "receita" | "despesa";
  categoriaId?: string;
  descricao?: string | null;
  valor?: number;
  data?: Date;
  recorrente?: boolean;
  dataFim?: Date | null;
}

export interface TransactionFilters {
  contaId: string;
  dataInicio?: Date;
  dataFim?: Date;
  tipo?: "receita" | "despesa";
  categoriaId?: string;
  busca?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  data: Array<{
    id: string;
    tipo: string;
    categoria: { id: string; nome: string };
    descricao: string | null;
    valor: string;
    data: Date;
    recorrente: boolean;
    dataFim: Date | null;
    usuario: { id: string; nome: string };
    createdAt: Date;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function validateCategoriaTipo(categoriaId: string, tipo: "receita" | "despesa"): Promise<void> {
  const categoria = await db
    .select({
      categoriaId: categorias.id,
      tipoSlug: tipoCategorias.slug,
    })
    .from(categorias)
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .where(eq(categorias.id, categoriaId))
    .limit(1);

  if (categoria.length === 0) {
    throw new BusinessRuleError("Categoria not found");
  }

  if (categoria[0].tipoSlug !== tipo) {
    throw new BusinessRuleError("Categoria type does not match transaction type");
  }
}

function validateRecorrencia(input: { recorrente?: boolean; dataFim?: Date | null }): void {
  if (!input.recorrente && input.dataFim != null) {
    throw new BusinessRuleError("data_fim is only allowed when recorrente is true");
  }
}

function validateValor(valor: number): void {
  if (valor <= 0) {
    throw new BusinessRuleError("valor must be greater than zero");
  }
}

export async function createTransaction(input: CreateTransactionInput, usuarioId: string) {
  assertNotDemoAccount(input.contaId);
  validateValor(input.valor);
  validateRecorrencia(input);
  await validateCategoriaTipo(input.categoriaId, input.tipo);

  const [created] = await db
    .insert(movimentacoes)
    .values({
      contaId: input.contaId,
      usuarioId,
      categoriaId: input.categoriaId,
      descricao: input.descricao,
      valor: String(input.valor),
      data: input.data,
      recorrente: input.recorrente ?? false,
      dataFim: input.dataFim ?? null,
    })
    .returning();

  await invalidateProjections(input.contaId, input.data);

  return findTransactionById(created.id);
}

export async function findTransactionById(id: string) {
  const result = await db
    .select({
      id: movimentacoes.id,
      contaId: movimentacoes.contaId,
      tipo: tipoCategorias.slug,
      categoriaId: categorias.id,
      categoriaNome: categorias.nome,
      descricao: movimentacoes.descricao,
      valor: movimentacoes.valor,
      data: movimentacoes.data,
      recorrente: movimentacoes.recorrente,
      dataFim: movimentacoes.dataFim,
      usuarioId: usuarios.id,
      usuarioNome: usuarios.nome,
      createdAt: movimentacoes.createdAt,
    })
    .from(movimentacoes)
    .innerJoin(categorias, eq(movimentacoes.categoriaId, categorias.id))
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .innerJoin(usuarios, eq(movimentacoes.usuarioId, usuarios.id))
    .where(eq(movimentacoes.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0];
  return {
    id: row.id,
    contaId: row.contaId,
    tipo: row.tipo,
    categoria: { id: row.categoriaId, nome: row.categoriaNome },
    descricao: row.descricao,
    valor: row.valor,
    data: row.data,
    recorrente: row.recorrente,
    dataFim: row.dataFim,
    usuario: { id: row.usuarioId, nome: row.usuarioNome },
    createdAt: row.createdAt,
  };
}

export async function updateTransaction(id: string, input: UpdateTransactionInput) {
  const existing = await findTransactionById(id);
  if (!existing) {
    throw new NotFoundError("Transaction not found");
  }

  assertNotDemoAccount(existing.contaId);
  if (input.contaId !== undefined) assertNotDemoAccount(input.contaId);

  if (input.valor !== undefined) {
    validateValor(input.valor);
  }

  validateRecorrencia({
    recorrente: input.recorrente ?? existing.recorrente,
    dataFim: input.dataFim,
  });

  if (input.categoriaId && input.tipo) {
    await validateCategoriaTipo(input.categoriaId, input.tipo);
  } else if (input.categoriaId) {
    await validateCategoriaTipo(input.categoriaId, existing.tipo as "receita" | "despesa");
  } else if (input.tipo) {
    const current = await db
      .select({ categoriaId: movimentacoes.categoriaId })
      .from(movimentacoes)
      .where(eq(movimentacoes.id, id))
      .limit(1);
    await validateCategoriaTipo(current[0].categoriaId, input.tipo);
  }

  const updates: Partial<typeof movimentacoes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.contaId !== undefined) updates.contaId = input.contaId;
  if (input.categoriaId !== undefined) updates.categoriaId = input.categoriaId;
  if (input.descricao !== undefined) updates.descricao = input.descricao ?? null;
  if (input.valor !== undefined) updates.valor = String(input.valor);
  if (input.data !== undefined) updates.data = input.data;
  if (input.recorrente !== undefined) {
    updates.recorrente = input.recorrente;
    if (!input.recorrente) {
      updates.dataFim = null;
    }
  }
  if (input.dataFim !== undefined && (input.recorrente ?? existing.recorrente)) {
    updates.dataFim = input.dataFim ?? null;
  }

  const [updated] = await db
    .update(movimentacoes)
    .set(updates)
    .where(eq(movimentacoes.id, id))
    .returning();

  await invalidateProjections(updated.contaId, updated.data);

  return findTransactionById(updated.id);
}

export async function deleteTransaction(id: string) {
  const existing = await db
    .select({ parcelaDividaId: movimentacoes.parcelaDividaId, contaId: movimentacoes.contaId, data: movimentacoes.data })
    .from(movimentacoes)
    .where(eq(movimentacoes.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError("Transaction not found");
  }

  assertNotDemoAccount(existing[0].contaId);

  if (existing[0].parcelaDividaId != null) {
    throw new SystemGeneratedResourceError("System-generated transactions cannot be deleted");
  }

  await db.delete(movimentacoes).where(eq(movimentacoes.id, id));

  await invalidateProjections(existing[0].contaId, existing[0].data);
}

export async function findTransactionsByAccount(filters: TransactionFilters): Promise<PaginatedTransactions> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 10));
  const offset = (page - 1) * limit;

  const conditions = [eq(movimentacoes.contaId, filters.contaId)];

  if (filters.dataInicio) {
    conditions.push(gte(movimentacoes.data, filters.dataInicio));
  }
  if (filters.dataFim) {
    conditions.push(lte(movimentacoes.data, filters.dataFim));
  }
  if (filters.tipo) {
    conditions.push(eq(tipoCategorias.slug, filters.tipo));
  }
  if (filters.categoriaId) {
    conditions.push(eq(movimentacoes.categoriaId, filters.categoriaId));
  }
  if (filters.busca) {
    conditions.push(ilike(movimentacoes.descricao, `%${filters.busca}%`));
  }

  const whereClause = and(...conditions);

  const query = db
    .select({
      id: movimentacoes.id,
      tipo: tipoCategorias.slug,
      categoriaId: categorias.id,
      categoriaNome: categorias.nome,
      descricao: movimentacoes.descricao,
      valor: movimentacoes.valor,
      data: movimentacoes.data,
      recorrente: movimentacoes.recorrente,
      dataFim: movimentacoes.dataFim,
      usuarioId: usuarios.id,
      usuarioNome: usuarios.nome,
      createdAt: movimentacoes.createdAt,
    })
    .from(movimentacoes)
    .innerJoin(categorias, eq(movimentacoes.categoriaId, categorias.id))
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .innerJoin(usuarios, eq(movimentacoes.usuarioId, usuarios.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(movimentacoes.data));

  const countQuery = db
    .select({ total: count() })
    .from(movimentacoes)
    .innerJoin(categorias, eq(movimentacoes.categoriaId, categorias.id))
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .innerJoin(usuarios, eq(movimentacoes.usuarioId, usuarios.id))
    .where(whereClause);

  const [rows, countResult] = await Promise.all([query, countQuery]);
  const total = Number(countResult[0]?.total ?? 0);
  const totalPages = Math.ceil(total / limit);

  return {
    data: rows.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      categoria: { id: row.categoriaId, nome: row.categoriaNome },
      descricao: row.descricao,
      valor: row.valor,
      data: row.data,
      recorrente: row.recorrente,
      dataFim: row.dataFim,
      usuario: { id: row.usuarioId, nome: row.usuarioNome },
      createdAt: row.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export { invalidateProjections } from "./projection-invalidation.js";
