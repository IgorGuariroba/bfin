import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { meta } from "../../db/schema.js";
import { upsertMeta } from "../../services/goal-service.js";
import type { McpTool } from "../tool-types.js";

export const goalsList: McpTool<{ contaId: string }> = {
  name: "goals_list",
  description: "Get the current reserve goal (meta) for an account, or null if unset.",
  requiredScope: "goals:read",
  minRole: "viewer",
  inputSchema: z.object({
    contaId: z.uuid(),
  }),
  async handler({ input }) {
    const row = await db.query.meta.findFirst({
      where: eq(meta.contaId, input.contaId),
    });
    if (!row) return { contaId: input.contaId, meta: null };
    return {
      contaId: input.contaId,
      meta: {
        id: row.id,
        porcentagem_reserva: row.porcentagemReserva,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      },
    };
  },
};

export const goalsCreate: McpTool<{ contaId: string; porcentagemReserva: number }> = {
  name: "goals_create",
  description: "Create the reserve goal for an account.",
  requiredScope: "goals:write",
  minRole: "owner",
  inputSchema: z.object({
    contaId: z.uuid(),
    porcentagemReserva: z.number().min(0).max(100),
  }),
  async handler({ input }) {
    const result = await upsertMeta({
      contaId: input.contaId,
      porcentagemReserva: input.porcentagemReserva,
    });
    return {
      id: result.id,
      contaId: result.contaId,
      porcentagem_reserva: result.porcentagem_reserva,
      created_at: result.created_at,
      updated_at: result.updated_at,
      wasCreated: result.wasCreated,
    };
  },
};

export const goalsUpdate: McpTool<{ contaId: string; porcentagemReserva: number }> = {
  name: "goals_update",
  description: "Update the reserve goal for an account (upsert semantics).",
  requiredScope: "goals:write",
  minRole: "owner",
  inputSchema: z.object({
    contaId: z.uuid(),
    porcentagemReserva: z.number().min(0).max(100),
  }),
  async handler({ input }) {
    const result = await upsertMeta({
      contaId: input.contaId,
      porcentagemReserva: input.porcentagemReserva,
    });
    return {
      id: result.id,
      contaId: result.contaId,
      porcentagem_reserva: result.porcentagem_reserva,
      created_at: result.created_at,
      updated_at: result.updated_at,
      wasCreated: result.wasCreated,
    };
  },
};
