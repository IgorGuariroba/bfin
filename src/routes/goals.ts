import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import { upsertMeta } from "../services/goal-service.js";
import { parseOrThrow, uuidSchema } from "../lib/validation.js";

const metaBodySchema = z.object({
  contaId: uuidSchema,
  porcentagem_reserva: z
    .number()
    .min(0, { message: "porcentagem_reserva must be >= 0" })
    .max(100, { message: "porcentagem_reserva must be <= 100" })
    .refine((v) => Number.isFinite(v), {
      message: "porcentagem_reserva must be a finite number",
    })
    .refine(
      (v) => {
        const parts = v.toString().split(".");
        return parts.length === 1 || parts[1].length <= 2;
      },
      { message: "porcentagem_reserva must have at most 2 decimal places" }
    ),
});

export async function goalRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/metas",
    { preHandler: [requireAccountRole({ minRole: "owner" })] },
    async (request, reply) => {
      const body = parseOrThrow(metaBodySchema, request.body, "body");

      const result = await upsertMeta({
        contaId: body.contaId,
        porcentagemReserva: body.porcentagem_reserva,
      });

      const payload = {
        id: result.id,
        contaId: result.contaId,
        porcentagem_reserva: result.porcentagem_reserva,
        created_at: result.created_at.toISOString(),
        updated_at: result.updated_at.toISOString(),
      };

      return reply.status(result.wasCreated ? 201 : 200).send(payload);
    }
  );
}
