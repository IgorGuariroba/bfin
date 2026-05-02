import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import { resolveProjecao, loadMeta } from "../services/projection-engine/index.js";
import { uuidSchema } from "../lib/validation.js";
import { commonErrors } from "../lib/schemas.js";

const projectionQuerySchema = z.object({
  contaId: uuidSchema,
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "mes must be YYYY-MM",
  }),
});

const projectionResponseSchema = z.object({
  contaId: z.string().uuid(),
  mes: z.string(),
  status: z.string(),
  recalculado_em: z.string().datetime(),
  meta_reserva: z.object({ porcentagem_reserva: z.string() }).nullable(),
  projecao: z.array(z.any()),
  resumo: z.any(),
});

export async function projectionRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/projecao",
    {
      preHandler: [
        requireAccountRole({
          minRole: "viewer",
          extractContaId: (req: FastifyRequest) => {
            const q = req.query as { contaId?: string };
            return q.contaId;
          },
        }),
      ],
      schema: {
        querystring: projectionQuerySchema,
        response: {
          200: projectionResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const query = request.query;

      const resultado = await resolveProjecao({
        contaId: query.contaId,
        mes: query.mes,
      });

      const meta = await loadMeta(query.contaId);

      return reply.status(200).send({
        contaId: resultado.contaId,
        mes: resultado.mes,
        status: resultado.status,
        recalculado_em: resultado.recalculadoEm.toISOString(),
        meta_reserva: meta ? { porcentagem_reserva: meta.porcentagemReserva } : null,
        projecao: resultado.dados.dias,
        resumo: resultado.dados.resumo,
      });
    }
  );
}
