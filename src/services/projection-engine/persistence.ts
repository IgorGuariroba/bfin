import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { projecao } from "../../db/schema.js";
import type { ProjecaoMensal } from "./types.js";

export interface ReadProjecaoResult {
  id: string;
  contaId: string;
  mes: string;
  dados: ProjecaoMensal;
  status: "atualizada" | "invalidada";
  recalculadoEm: Date;
}

export async function readProjecao(
  contaId: string,
  mes: string
): Promise<ReadProjecaoResult | null> {
  const rows = await db
    .select()
    .from(projecao)
    .where(and(eq(projecao.contaId, contaId), eq(projecao.mes, mes)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    contaId: row.contaId,
    mes: row.mes,
    dados: row.dados as ProjecaoMensal,
    status: row.status,
    recalculadoEm: row.recalculadoEm,
  };
}

export async function upsertProjecao(
  contaId: string,
  mes: string,
  dados: ProjecaoMensal
): Promise<ReadProjecaoResult> {
  const rows = await db
    .insert(projecao)
    .values({
      contaId,
      mes,
      dados,
      status: "atualizada",
      recalculadoEm: new Date(),
    })
    .onConflictDoUpdate({
      target: [projecao.contaId, projecao.mes],
      set: {
        dados,
        status: "atualizada",
        recalculadoEm: sql`NOW()`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();
  const row = rows[0];
  return {
    id: row.id,
    contaId: row.contaId,
    mes: row.mes,
    dados: row.dados as ProjecaoMensal,
    status: row.status,
    recalculadoEm: row.recalculadoEm,
  };
}

export async function getEarliestProjecaoMonth(
  contaId: string
): Promise<string | null> {
  const rows = await db.execute(
    sql`SELECT MIN(mes) AS mes FROM projecao WHERE conta_id = ${contaId}`
  );
  const first = (rows as Array<{ mes?: string | null }>)[0];
  return first?.mes ?? null;
}
