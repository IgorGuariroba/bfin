import { FastifyInstance } from "fastify";
import { requireAccountRole } from "../plugins/account-authorization.js";
import {
  createAccount,
  findAccountsByUser,
  updateAccount,
} from "../services/account-service.js";

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
      const { contaId } = request.params as { contaId: string };
      const body = request.body as { nome?: string; saldo_inicial?: number };
      const account = await updateAccount(contaId, {
        nome: body.nome,
        saldoInicial: body.saldo_inicial,
      });
      return reply.status(200).send(account);
    }
  );
}
