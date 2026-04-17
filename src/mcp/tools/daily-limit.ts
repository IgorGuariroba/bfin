import { z } from "zod";
import { calcularLimiteDiario } from "../../services/daily-limit-service.js";
import { upsertMeta } from "../../services/goal-service.js";
import type { McpTool } from "../tool-types.js";

const isoDate = z.string().datetime({ offset: true }).transform((v) => new Date(v));

export const dailyLimitGet: McpTool<{ contaId: string; hoje?: Date }> = {
  name: "daily-limit.get",
  description: "Compute the daily spending limit for an account for the current month.",
  requiredScope: "daily-limit:read",
  minRole: "viewer",
  inputSchema: z.object({
    contaId: z.string().uuid(),
    hoje: isoDate.optional(),
  }),
  async handler({ input }) {
    const result = await calcularLimiteDiario({
      contaId: input.contaId,
      hoje: input.hoje,
    });
    return { contaId: input.contaId, ...result };
  },
};

export const dailyLimitSet: McpTool<{ contaId: string; porcentagemReserva: number }> = {
  name: "daily-limit.set",
  description: "Configure the reserve percentage that affects daily-limit calculation.",
  requiredScope: "daily-limit:write",
  minRole: "owner",
  inputSchema: z.object({
    contaId: z.string().uuid(),
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
      wasCreated: result.wasCreated,
    };
  },
};
