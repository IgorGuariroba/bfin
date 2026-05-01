import { eq, and, ilike, count, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { contas, contaUsuarios } from "../db/schema.js";
import { NotFoundError } from "../lib/errors.js";
import {
  invalidateAllProjections,
  getEarliestPersistedMonth,
} from "./projection-invalidation.js";
import { eventBus } from "../lib/event-bus.js";
import { monthKey } from "../lib/month.js";
import { assertNotDemoAccount } from "../lib/demo-account.js";

export interface CreateAccountInput {
  nome: string;
  saldoInicial?: number;
}

export interface UpdateAccountInput {
  nome?: string;
  saldoInicial?: number;
}

export interface AccountFilters {
  usuarioId: string;
  busca?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAccounts {
  data: Array<{
    id: string;
    nome: string;
    saldoInicial: string;
    papel: string;
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

export async function createAccount(input: CreateAccountInput, usuarioId: string) {
  return await db.transaction(async (tx) => {
    const [conta] = await tx
      .insert(contas)
      .values({
        nome: input.nome,
        saldoInicial: input.saldoInicial !== undefined ? String(input.saldoInicial) : "0.00",
      })
      .returning();

    await tx.insert(contaUsuarios).values({
      contaId: conta.id,
      usuarioId,
      papel: "owner",
    });

    return {
      id: conta.id,
      nome: conta.nome,
      saldoInicial: conta.saldoInicial,
      papel: "owner",
      createdAt: conta.createdAt,
    };
  });
}

export async function findAccountsByUser(filters: AccountFilters): Promise<PaginatedAccounts> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 10));
  const offset = (page - 1) * limit;

  const conditions = [eq(contaUsuarios.usuarioId, filters.usuarioId)];

  if (filters.busca) {
    conditions.push(ilike(contas.nome, `%${filters.busca}%`));
  }

  const whereClause = and(...conditions);

  const query = db
    .select({
      id: contas.id,
      nome: contas.nome,
      saldoInicial: contas.saldoInicial,
      papel: contaUsuarios.papel,
      createdAt: contas.createdAt,
    })
    .from(contas)
    .innerJoin(contaUsuarios, eq(contas.id, contaUsuarios.contaId))
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(contas.createdAt));

  const countQuery = db
    .select({ total: count() })
    .from(contas)
    .innerJoin(contaUsuarios, eq(contas.id, contaUsuarios.contaId))
    .where(whereClause);

  const [data, countResult] = await Promise.all([query, countQuery]);
  const total = Number(countResult[0]?.total ?? 0);
  const totalPages = Math.ceil(total / limit);

  return {
    data,
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

export async function findAccountById(contaId: string) {
  const result = await db
    .select({
      id: contas.id,
      nome: contas.nome,
      saldoInicial: contas.saldoInicial,
      createdAt: contas.createdAt,
    })
    .from(contas)
    .where(eq(contas.id, contaId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateAccount(contaId: string, input: UpdateAccountInput) {
  assertNotDemoAccount(contaId);
  const existing = await findAccountById(contaId);
  if (!existing) {
    throw new NotFoundError("Conta not found");
  }

  const saldoInicialChanged =
    input.saldoInicial !== undefined &&
    String(input.saldoInicial) !== existing.saldoInicial;

  if (saldoInicialChanged) {
    await invalidateAllProjections(contaId);
  }

  const [updated] = await db
    .update(contas)
    .set({
      ...(input.nome !== undefined && { nome: input.nome }),
      ...(input.saldoInicial !== undefined && { saldoInicial: String(input.saldoInicial) }),
      updatedAt: new Date(),
    })
    .where(eq(contas.id, contaId))
    .returning();

  if (saldoInicialChanged) {
    const earliest = await getEarliestPersistedMonth(contaId);
    const mesInicial = earliest ?? monthKey(new Date());
    eventBus.emit("projecao:recalcular", { contaId, mesInicial });
  }

  return {
    id: updated.id,
    nome: updated.nome,
    saldoInicial: updated.saldoInicial,
    createdAt: updated.createdAt,
  };
}
