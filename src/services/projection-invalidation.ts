import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { eventBus } from "../lib/event-bus.js";
import { monthKey } from "../lib/month.js";

function isUndefinedTableError(err: unknown): boolean {
  const code =
    (err as { code?: string; cause?: { code?: string } } | null | undefined)?.code ??
    (err as { cause?: { code?: string } } | null | undefined)?.cause?.code;
  return code === "42P01";
}

export async function invalidateProjections(
  contaId: string,
  dataReferencia: Date
): Promise<void> {
  const mes = monthKey(dataReferencia);
  try {
    await db.execute(
      sql`UPDATE projecao SET status = 'invalidada', updated_at = NOW() WHERE conta_id = ${contaId} AND mes >= ${mes}`
    );
  } catch (err) {
    if (!isUndefinedTableError(err)) {
      throw err;
    }
  }
  eventBus.emit("projecao:recalcular", { contaId, mesInicial: mes });
}

export async function invalidateAllProjections(contaId: string): Promise<void> {
  try {
    await db.execute(
      sql`UPDATE projecao SET status = 'invalidada', updated_at = NOW() WHERE conta_id = ${contaId}`
    );
  } catch (err) {
    if (!isUndefinedTableError(err)) {
      throw err;
    }
  }
}

export async function getEarliestPersistedMonth(contaId: string): Promise<string | null> {
  try {
    const rows = await db.execute(
      sql`SELECT MIN(mes) AS mes FROM projecao WHERE conta_id = ${contaId}`
    );
    const first = (rows as Array<{ mes?: string | null }>)[0];
    return first?.mes ?? null;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return null;
    }
    throw err;
  }
}
