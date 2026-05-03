import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import { getMetaByContaId, upsertMeta } from "../services/goal-service.js";
import { uuidSchema } from "../lib/validation.js";
import { commonErrors } from "../lib/schemas.js";
import { NotFoundError } from "../lib/errors.js";

const metaQuerySchema = z.object({
  contaId: uuidSchema,
});

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

const metaResponseSchema = z.object({
  id: z.string().uuid(),
  contaId: z.string().uuid(),
  porcentagem_reserva: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export async function goalRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/metas",
    {
      preHandler: [
        requireAccountRole({
          minRole: "viewer",
          extractContaId: (request) => (request.query as { contaId?: string }).contaId,
        }),
      ],
      schema: {
        querystring: metaQuerySchema,
        response: {
          200: metaResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { contaId } = request.query;
      const result = await getMetaByContaId(contaId);
      if (!result) {
        throw new NotFoundError("Meta não encontrada");
      }
      return reply.status(200).send({
        id: result.id,
        contaId: result.contaId,
        porcentagem_reserva: result.porcentagem_reserva,
        created_at: result.created_at.toISOString(),
        updated_at: result.updated_at.toISOString(),
      });
    }
  );

  typedApp.post(
    "/metas",
    {
      preHandler: [requireAccountRole({ minRole: "owner" })],
      schema: {
        body: metaBodySchema,
        response: {
          200: metaResponseSchema,
          201: metaResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

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
