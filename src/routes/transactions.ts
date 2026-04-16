import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAccountRole, AccountRole } from "../plugins/account-authorization.js";
import {
  createTransaction,
  findTransactionById,
  updateTransaction,
  deleteTransaction,
  findTransactionsByAccount,
} from "../services/transaction-service.js";
import { NotFoundError } from "../lib/errors.js";
import { parseOrThrow, uuidSchema } from "../lib/validation.js";

const movimentacaoParamsSchema = z.object({ movimentacaoId: uuidSchema });
const listQuerySchema = z.object({ contaId: uuidSchema, categoriaId: uuidSchema.optional() });
const createBodySchema = z.object({
  contaId: uuidSchema,
  tipo: z.enum(["receita", "despesa"]),
  categoriaId: uuidSchema,
  descricao: z.string().optional(),
  valor: z.number(),
  data: z.string(),
  recorrente: z.boolean().optional(),
  data_fim: z.string().nullable().optional(),
});
const updateBodySchema = z.object({
  contaId: uuidSchema.optional(),
  tipo: z.enum(["receita", "despesa"]).optional(),
  categoriaId: uuidSchema.optional(),
  descricao: z.string().nullable().optional(),
  valor: z.number().optional(),
  data: z.string().optional(),
  recorrente: z.boolean().optional(),
  data_fim: z.string().nullable().optional(),
});

function requireTransactionOwner(minRole: AccountRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { movimentacaoId } = parseOrThrow(
      movimentacaoParamsSchema,
      request.params,
      "params"
    );
    const tx = await findTransactionById(movimentacaoId);
    if (!tx) {
      throw new NotFoundError("Transaction not found");
    }
    (request.params as { contaId?: string }).contaId = tx.contaId;
    await requireAccountRole({ minRole })(request, reply);
  };
}

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/movimentacoes",
    { preHandler: [requireAccountRole({ minRole: "owner" })] },
    async (request, reply) => {
      const user = request.user!;
      const body = parseOrThrow(createBodySchema, request.body, "body");

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

      return reply.status(201).send(transaction);
    }
  );

  app.get(
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
    },
    async (request, reply) => {
      const rawQuery = request.query as Record<string, string | undefined>;
      const validated = parseOrThrow(listQuerySchema, {
        contaId: rawQuery.contaId,
        categoriaId: rawQuery.categoriaId,
      }, "query");

      const result = await findTransactionsByAccount({
        contaId: validated.contaId,
        dataInicio: rawQuery.data_inicio ? new Date(rawQuery.data_inicio) : undefined,
        dataFim: rawQuery.data_fim ? new Date(rawQuery.data_fim) : undefined,
        tipo: rawQuery.tipo as "receita" | "despesa" | undefined,
        categoriaId: validated.categoriaId,
        busca: rawQuery.busca,
        page: rawQuery.page ? parseInt(rawQuery.page, 10) : undefined,
        limit: rawQuery.limit ? parseInt(rawQuery.limit, 10) : undefined,
      });

      return reply.status(200).send(result);
    }
  );

  app.put(
    "/movimentacoes/:movimentacaoId",
    { preHandler: [requireTransactionOwner("owner")] },
    async (request, reply) => {
      const { movimentacaoId } = parseOrThrow(
        movimentacaoParamsSchema,
        request.params,
        "params"
      );
      const body = parseOrThrow(updateBodySchema, request.body, "body");

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

      return reply.status(200).send(transaction);
    }
  );

  app.delete(
    "/movimentacoes/:movimentacaoId",
    { preHandler: [requireTransactionOwner("owner")] },
    async (request, reply) => {
      const { movimentacaoId } = parseOrThrow(
        movimentacaoParamsSchema,
        request.params,
        "params"
      );
      await deleteTransaction(movimentacaoId);
      return reply.status(200).send({ ok: true });
    }
  );
}
