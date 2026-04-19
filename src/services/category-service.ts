import { eq, and, ilike, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { categorias, tipoCategorias, movimentacoes, dividas } from "../db/schema.js";
import { NotFoundError, BusinessRuleError, DuplicateError, isDuplicateKeyError } from "../lib/errors.js";

export interface CreateCategoryInput {
  nome: string;
  tipo: string;
}

export interface UpdateCategoryInput {
  nome: string;
  tipo: string;
}

export interface CategoryFilters {
  tipo?: string;
  busca?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedCategories {
  data: Array<{
    id: string;
    nome: string;
    tipo: string;
    createdAt: Date;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function findTipoCategoriaIdBySlug(slug: string): Promise<string | undefined> {
  const tipo = await db.query.tipoCategorias.findFirst({
    where: eq(tipoCategorias.slug, slug),
  });
  return tipo?.id;
}

async function assertNoVinculos(categoriaId: string): Promise<void> {
  const tables = [
    { table: movimentacoes, column: movimentacoes.categoriaId },
    { table: dividas, column: dividas.categoriaId },
  ];
  for (const { table, column } of tables) {
    try {
      const result = await db
        .select({ count: count() })
        .from(table)
        .where(eq(column, categoriaId));
      const row = result[0];
      if (row && Number(row.count) > 0) {
        throw new BusinessRuleError("Category has linked records and cannot be deleted");
      }
    } catch (err) {
      if (err instanceof BusinessRuleError) throw err;
      // Ignore errors for tables that do not exist yet
    }
  }
}

export async function createCategory(input: CreateCategoryInput) {
  const tipoId = await findTipoCategoriaIdBySlug(input.tipo);
  if (!tipoId) {
    throw new NotFoundError("Tipo categoria not found");
  }

  try {
    const [created] = await db
      .insert(categorias)
      .values({
        nome: input.nome,
        tipoCategoriaId: tipoId,
      })
      .returning();

    const tipo = await db.query.tipoCategorias.findFirst({
      where: eq(tipoCategorias.id, created.tipoCategoriaId),
    });

    return {
      id: created.id,
      nome: created.nome,
      tipo: tipo?.slug ?? input.tipo,
      createdAt: created.createdAt,
    };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new DuplicateError("Category with this name and type already exists");
    }
    throw err;
  }
}

export async function findCategoryById(id: string) {
  const result = await db
    .select({
      id: categorias.id,
      nome: categorias.nome,
      tipo: tipoCategorias.slug,
      createdAt: categorias.createdAt,
    })
    .from(categorias)
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .where(eq(categorias.id, id))
    .limit(1);

  return result[0] ?? null;
}

export async function findAllCategories(filters: CategoryFilters): Promise<PaginatedCategories> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 10));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (filters.tipo) {
    conditions.push(eq(tipoCategorias.slug, filters.tipo));
  }

  if (filters.busca) {
    conditions.push(ilike(categorias.nome, `%${filters.busca}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const query = db
    .select({
      id: categorias.id,
      nome: categorias.nome,
      tipo: tipoCategorias.slug,
      createdAt: categorias.createdAt,
    })
    .from(categorias)
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(categorias.nome);

  const countQuery = db
    .select({ total: count() })
    .from(categorias)
    .innerJoin(tipoCategorias, eq(categorias.tipoCategoriaId, tipoCategorias.id))
    .where(whereClause);

  const [data, countResult] = await Promise.all([query, countQuery]);
  const total = Number(countResult[0]?.total ?? 0);
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await findCategoryById(id);
  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  const tipoId = await findTipoCategoriaIdBySlug(input.tipo);
  if (!tipoId) {
    throw new NotFoundError("Tipo categoria not found");
  }

  try {
    const [updated] = await db
      .update(categorias)
      .set({
        nome: input.nome,
        tipoCategoriaId: tipoId,
        updatedAt: new Date(),
      })
      .where(eq(categorias.id, id))
      .returning();

    return {
      id: updated.id,
      nome: updated.nome,
      tipo: input.tipo,
      createdAt: updated.createdAt,
    };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new DuplicateError("Category with this name and type already exists");
    }
    throw err;
  }
}

export async function deleteCategory(id: string) {
  const existing = await findCategoryById(id);
  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  await assertNoVinculos(id);

  await db.delete(categorias).where(eq(categorias.id, id));
}
