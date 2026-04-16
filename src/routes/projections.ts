import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import { resolveProjecao, loadMeta } from "../services/projection-engine/index.js";
import { parseOrThrow, uuidSchema } from "../lib/validation.js";

const projectionQuerySchema = z.object({
  contaId: uuidSchema,
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "mes must be YYYY-MM",
  }),
});

export async function projectionRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/projecao",
    {
      onRequest: [
        requireAccountRole({
          minRole: "viewer",
          extractContaId: (req: FastifyRequest) => {
            const q = req.query as { contaId?: string };
            return q.contaId;
          },
        }),
      ],
    },
    async (request, reply) => {
      const query = parseOrThrow(
        projectionQuerySchema,
        request.query,
        "query"
      );

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
