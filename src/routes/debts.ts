import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import {
  createDebt,
  findDebtById,
  findDebtsByAccount,
  deleteDebt,
  confirmInstallmentPayment,
} from "../services/debt-service.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { uuidSchema } from "../lib/validation.js";
import { commonErrors, paginatedResponseSchema } from "../lib/schemas.js";

const dividaParamsSchema = z.object({ dividaId: uuidSchema });
const parcelaParamsSchema = z.object({ dividaId: uuidSchema, parcelaId: uuidSchema });

const parcelaSchema = z.object({
  id: z.string().uuid(),
  numero_parcela: z.number(),
  valor: z.string(),
  data_vencimento: z.coerce.date(),
  data_pagamento: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
});

const debtDetailResponseSchema = z.object({
  id: z.string().uuid(),
  conta_id: z.string().uuid(),
  categoria: z.object({ id: z.string().uuid(), nome: z.string() }),
  descricao: z.string(),
  valor_total: z.string(),
  total_parcelas: z.number(),
  valor_parcela: z.string(),
  data_inicio: z.coerce.date(),
  parcelas: z.array(parcelaSchema),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const debtListItemSchema = z.object({
  id: z.string().uuid(),
  conta_id: z.string().uuid(),
  categoria: z.object({ id: z.string().uuid(), nome: z.string() }),
  descricao: z.string(),
  valor_total: z.string(),
  total_parcelas: z.number(),
  valor_parcela: z.string(),
  data_inicio: z.coerce.date(),
  total_parcelas_count: z.number(),
  parcelas_pagas: z.number(),
  parcelas_pendentes: z.number(),
  created_at: z.coerce.date(),
});

const paginatedDebtsResponseSchema = paginatedResponseSchema(debtListItemSchema);

const payInstallmentResponseSchema = z.object({
  id: z.string().uuid(),
  numero_parcela: z.number(),
  valor: z.string(),
  data_vencimento: z.coerce.date(),
  data_pagamento: z.coerce.date().nullable(),
  movimentacao_gerada: z.object({
    id: z.string().uuid(),
    tipo: z.literal("despesa"),
    valor: z.string(),
    data: z.coerce.date(),
    parcela_divida_id: z.string().uuid().nullable(),
  }),
});

function requireDebtOwner(minRole: "owner" | "viewer") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const params = dividaParamsSchema.parse(request.params);
    const divida = await findDebtById(params.dividaId);
    if (!divida) {
      throw new NotFoundError("Debt not found");
    }
    (request.params as { contaId?: string }).contaId = divida.conta_id;
    await requireAccountRole({ minRole })(request, reply);
  };
}

export async function debtRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/dividas",
    {
      preHandler: [requireAccountRole({ minRole: "owner" })],
      schema: {
        body: z.object({
          contaId: uuidSchema,
          categoriaId: uuidSchema,
          descricao: z.string().min(1),
          valorTotal: z.number(),
          totalParcelas: z.number().int(),
          dataInicio: z.string(),
        }),
        response: {
          201: debtDetailResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body;

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
      if (!divida) {
        throw new AppError("Failed to create debt", 500, "INTERNAL_ERROR");
      }

      return reply.status(201).send(divida);
    }
  );

  typedApp.get(
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
      schema: {
        querystring: z.object({
          contaId: uuidSchema,
          status: z.enum(["pendente", "quitada"]).optional(),
          page: z.coerce.number().optional(),
          limit: z.coerce.number().optional(),
        }),
        response: {
          200: paginatedDebtsResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const query = request.query;

      const result = await findDebtsByAccount({
        contaId: query.contaId,
        status: query.status,
        page: query.page,
        limit: query.limit,
      });

      return reply.status(200).send(result);
    }
  );

  typedApp.delete(
    "/dividas/:dividaId",
    {
      preHandler: [requireDebtOwner("owner")],
      schema: {
        params: dividaParamsSchema,
        response: {
          200: z.object({ ok: z.boolean() }),
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { dividaId } = request.params;
      await deleteDebt(dividaId);
      return reply.status(200).send({ ok: true });
    }
  );

  typedApp.patch(
    "/dividas/:dividaId/parcelas/:parcelaId/pagamento",
    {
      preHandler: [requireDebtOwner("owner")],
      schema: {
        params: parcelaParamsSchema,
        body: z.object({
          dataPagamento: z.string(),
        }),
        response: {
          200: payInstallmentResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { dividaId, parcelaId } = request.params;
      const user = request.user!;
      const body = request.body;

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
