import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { meta } from "../db/schema.js";
import {
  invalidateAllProjections,
  getEarliestPersistedMonth,
} from "./projection-invalidation.js";
import { eventBus } from "../lib/event-bus.js";
import { monthKey } from "../lib/month.js";

export interface UpsertMetaInput {
  contaId: string;
  porcentagemReserva: number;
}

export interface UpsertMetaResult {
  id: string;
  contaId: string;
  porcentagem_reserva: string;
  created_at: Date;
  updated_at: Date;
  wasCreated: boolean;
}

export async function upsertMeta(input: UpsertMetaInput): Promise<UpsertMetaResult> {
  const valor = input.porcentagemReserva.toFixed(2);
  const existing = await db
    .select({ id: meta.id })
    .from(meta)
    .where(eq(meta.contaId, input.contaId))
    .limit(1);
  const wasCreated = existing.length === 0;

  const rows = await db
    .insert(meta)
    .values({
      contaId: input.contaId,
      porcentagemReserva: valor,
    })
    .onConflictDoUpdate({
      target: meta.contaId,
      set: {
        porcentagemReserva: valor,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();
  const row = rows[0];

  await invalidateAllProjections(input.contaId);
  const earliest = await getEarliestPersistedMonth(input.contaId);
  const mesInicial = earliest ?? monthKey(new Date());
  eventBus.emit("projecao:recalcular", {
    contaId: input.contaId,
    mesInicial,
  });

  return {
    id: row.id,
    contaId: row.contaId,
    porcentagem_reserva: row.porcentagemReserva,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    wasCreated,
  };
}
