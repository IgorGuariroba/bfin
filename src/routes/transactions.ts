import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAccountRole, AccountRole } from "../plugins/account-authorization.js";
import {
  createTransaction,
  findTransactionById,
  updateTransaction,
  deleteTransaction,
  findTransactionsByAccount,
} from "../services/transaction-service.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { uuidSchema } from "../lib/validation.js";
import { commonErrors, paginatedResponseSchema } from "../lib/schemas.js";

const movimentacaoParamsSchema = z.object({ movimentacaoId: uuidSchema });

const transactionListItemSchema = z.object({
  id: z.string().uuid(),
  tipo: z.string(),
  categoria: z.object({ id: z.string().uuid(), nome: z.string() }),
  descricao: z.string().nullable(),
  valor: z.string(),
  data: z.coerce.date(),
  recorrente: z.boolean(),
  dataFim: z.coerce.date().nullable(),
  usuario: z.object({ id: z.string().uuid(), nome: z.string() }),
  createdAt: z.coerce.date(),
});

const transactionDetailSchema = transactionListItemSchema.extend({
  contaId: z.string().uuid(),
});

const paginatedTransactionsResponseSchema = paginatedResponseSchema(transactionListItemSchema);

function requireTransactionOwner(minRole: AccountRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { movimentacaoId } = movimentacaoParamsSchema.parse(request.params);
    const tx = await findTransactionById(movimentacaoId);
    if (!tx) {
      throw new NotFoundError("Transaction not found");
    }
    (request.params as { contaId?: string }).contaId = tx.contaId;
    await requireAccountRole({ minRole })(request, reply);
  };
}

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/movimentacoes",
    {
      preHandler: [requireAccountRole({ minRole: "owner" })],
      schema: {
        body: z.object({
          contaId: uuidSchema,
          tipo: z.enum(["receita", "despesa"]),
          categoriaId: uuidSchema,
          descricao: z.string().optional(),
          valor: z.number(),
          data: z.string(),
          recorrente: z.boolean().optional(),
          data_fim: z.string().nullable().optional(),
        }),
        response: {
          201: transactionDetailSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body;

      const transaction = await createTransaction(
        {
          contaId: body.contaId,
          tipo: body.tipo,
          categoriaId: body.categoriaId,
          descricao: body.descricao,
          valor: body.valor,
          data: new Date(body.data),
          recorrente: body.recorrente,
          dataFim: body.data_fim ? new Date(body.data_fim) : null,
        },
        user.id
      );
      if (!transaction) {
        throw new AppError("Failed to create transaction", 500, "INTERNAL_ERROR");
      }

      return reply.status(201).send(transaction);
    }
  );

  typedApp.get(
    "/movimentacoes",
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
          categoriaId: uuidSchema.optional(),
          data_inicio: z.string().optional(),
          data_fim: z.string().optional(),
          tipo: z.enum(["receita", "despesa"]).optional(),
          busca: z.string().optional(),
          page: z.coerce.number().optional(),
          limit: z.coerce.number().optional(),
        }),
        response: {
          200: paginatedTransactionsResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const query = request.query;

      const result = await findTransactionsByAccount({
        contaId: query.contaId,
        dataInicio: query.data_inicio ? new Date(query.data_inicio) : undefined,
        dataFim: query.data_fim ? new Date(query.data_fim) : undefined,
        tipo: query.tipo,
        categoriaId: query.categoriaId,
        busca: query.busca,
        page: query.page,
        limit: query.limit,
      });

      return reply.status(200).send(result);
    }
  );

  typedApp.put(
    "/movimentacoes/:movimentacaoId",
    {
      preHandler: [requireTransactionOwner("owner")],
      schema: {
        params: movimentacaoParamsSchema,
        body: z.object({
          contaId: uuidSchema.optional(),
          tipo: z.enum(["receita", "despesa"]).optional(),
          categoriaId: uuidSchema.optional(),
          descricao: z.string().nullable().optional(),
          valor: z.number().optional(),
          data: z.string().optional(),
          recorrente: z.boolean().optional(),
          data_fim: z.string().nullable().optional(),
        }),
        response: {
          200: transactionDetailSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { movimentacaoId } = request.params;
      const body = request.body;

      const transaction = await updateTransaction(movimentacaoId, {
        contaId: body.contaId,
        tipo: body.tipo,
        categoriaId: body.categoriaId,
        descricao: body.descricao,
        valor: body.valor,
        data: body.data ? new Date(body.data) : undefined,
        recorrente: body.recorrente,
        dataFim: body.data_fim !== undefined ? (body.data_fim ? new Date(body.data_fim) : null) : undefined,
      });
      if (!transaction) {
        throw new AppError("Failed to update transaction", 500, "INTERNAL_ERROR");
      }

      return reply.status(200).send(transaction);
    }
  );

  typedApp.delete(
    "/movimentacoes/:movimentacaoId",
    {
      preHandler: [requireTransactionOwner("owner")],
      schema: {
        params: movimentacaoParamsSchema,
        response: {
          200: z.object({ ok: z.boolean() }),
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { movimentacaoId } = request.params;
      await deleteTransaction(movimentacaoId);
      return reply.status(200).send({ ok: true });
    }
  );
}
