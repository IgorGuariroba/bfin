import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import {
  createAccount,
  findAccountsByUser,
  updateAccount,
} from "../services/account-service.js";
import { calcularLimiteDiario } from "../services/daily-limit-service.js";
import { calcularLimiteDiarioV2 } from "../services/daily-limit-v2-service.js";
import { parseOrThrow, uuidSchema } from "../lib/validation.js";

const contaParamsSchema = z.object({ contaId: uuidSchema });

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.post("/contas", async (request, reply) => {
    const user = request.user!;
    const body = request.body as { nome: string; saldo_inicial?: number };
    const account = await createAccount(
      {
        nome: body.nome,
        saldoInicial: body.saldo_inicial,
      },
      user.id
    );
    return reply.status(201).send(account);
  });

  app.get("/contas", async (request, reply) => {
    const user = request.user!;
    const query = request.query as {
      busca?: string;
      page?: string;
      limit?: string;
    };

    const result = await findAccountsByUser({
      usuarioId: user.id,
      busca: query.busca,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.status(200).send(result);
  });

  app.patch(
    "/contas/:contaId",
    { onRequest: [requireAccountRole({ minRole: "owner" })] },
    async (request, reply) => {
      const { contaId } = parseOrThrow(contaParamsSchema, request.params, "params");
      const body = request.body as { nome?: string; saldo_inicial?: number };
      const account = await updateAccount(contaId, {
        nome: body.nome,
        saldoInicial: body.saldo_inicial,
      });
      return reply.status(200).send(account);
    }
  );

  app.get(
    "/contas/:contaId/limite-diario",
    { onRequest: [requireAccountRole({ minRole: "viewer" })] },
    async (request, reply) => {
      const { contaId } = parseOrThrow(contaParamsSchema, request.params, "params");
      const result = await calcularLimiteDiario({ contaId });
      return reply.status(200).send({ contaId, ...result });
    }
  );

  app.get(
    "/contas/:contaId/limite-diario-v2",
    { onRequest: [requireAccountRole({ minRole: "viewer" })] },
    async (request, reply) => {
      const { contaId } = parseOrThrow(contaParamsSchema, request.params, "params");
      const result = await calcularLimiteDiarioV2({ contaId });
      return reply.status(200).send({ contaId, ...result });
    }
  );
}
