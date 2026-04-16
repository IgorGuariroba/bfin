import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import {
  createDebt,
  findDebtById,
  findDebtsByAccount,
  deleteDebt,
  confirmInstallmentPayment,
} from "../services/debt-service.js";
import { NotFoundError } from "../lib/errors.js";
import { parseOrThrow, uuidSchema } from "../lib/validation.js";

const dividaParamsSchema = z.object({ dividaId: uuidSchema });
const parcelaParamsSchema = z.object({ dividaId: uuidSchema, parcelaId: uuidSchema });
const listQuerySchema = z.object({
  contaId: uuidSchema,
  status: z.enum(["pendente", "quitada"]).optional(),
});
const createBodySchema = z.object({
  contaId: uuidSchema,
  categoriaId: uuidSchema,
  descricao: z.string(),
  valorTotal: z.number(),
  totalParcelas: z.number().int(),
  dataInicio: z.string(),
});
const payBodySchema = z.object({ dataPagamento: z.string() });

function requireDebtOwner(minRole: "owner" | "viewer") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const params = parseOrThrow(dividaParamsSchema, request.params, "params");
    const divida = await findDebtById(params.dividaId);
    if (!divida) {
      throw new NotFoundError("Debt not found");
    }
    (request.params as { contaId?: string }).contaId = divida.conta_id;
    await requireAccountRole({ minRole })(request, reply);
  };
}

export async function debtRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/dividas",
    { preHandler: [requireAccountRole({ minRole: "owner" })] },
    async (request, reply) => {
      const user = request.user!;
      const body = parseOrThrow(createBodySchema, request.body, "body");

      const divida = await createDebt(
        {
          contaId: body.contaId,
          categoriaId: body.categoriaId,
          descricao: body.descricao,
          valorTotal: body.valorTotal,
          totalParcelas: body.totalParcelas,
          dataInicio: new Date(body.dataInicio),
        },
        user.id
      );

      return reply.status(201).send(divida);
    }
  );

  app.get(
    "/dividas",
    {
      onRequest: [
        requireAccountRole({
          minRole: "viewer",
          extractContaId: (req) => {
            const q = req.query as { contaId?: string };
            return q.contaId;
          },
        }),
      ],
    },
    async (request, reply) => {
      const rawQuery = request.query as Record<string, string | undefined>;
      const validated = parseOrThrow(listQuerySchema, {
        contaId: rawQuery.contaId,
        status: rawQuery.status,
      }, "query");

      const result = await findDebtsByAccount({
        contaId: validated.contaId,
        status: validated.status,
        page: rawQuery.page ? parseInt(rawQuery.page, 10) : undefined,
        limit: rawQuery.limit ? parseInt(rawQuery.limit, 10) : undefined,
      });

      return reply.status(200).send(result);
    }
  );

  app.delete(
    "/dividas/:dividaId",
    { preHandler: [requireDebtOwner("owner")] },
    async (request, reply) => {
      const { dividaId } = parseOrThrow(dividaParamsSchema, request.params, "params");
      await deleteDebt(dividaId);
      return reply.status(200).send({ ok: true });
    }
  );

  app.patch(
    "/dividas/:dividaId/parcelas/:parcelaId/pagamento",
    { preHandler: [requireDebtOwner("owner")] },
    async (request, reply) => {
      const { dividaId, parcelaId } = parseOrThrow(
        parcelaParamsSchema,
        request.params,
        "params"
      );
      const user = request.user!;
      const body = parseOrThrow(payBodySchema, request.body, "body");

      const result = await confirmInstallmentPayment(
        dividaId,
        parcelaId,
        { dataPagamento: new Date(body.dataPagamento) },
        user.id
      );

      return reply.status(200).send(result);
    }
  );
}
