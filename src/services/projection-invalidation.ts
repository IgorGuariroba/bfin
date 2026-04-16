import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

export async function invalidateProjections(contaId: string, dataReferencia: Date): Promise<void> {
  const mes = `${dataReferencia.getFullYear()}-${String(dataReferencia.getMonth() + 1).padStart(2, "0")}`;
  try {
    await db.execute(
      sql`UPDATE projecao SET status = 'invalidada' WHERE conta_id = ${contaId} AND mes >= ${mes}`
    );
  } catch {
    // no-op if projecao table does not exist yet
  }
}
