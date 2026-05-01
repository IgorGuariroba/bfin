import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import {
  createAccount,
  findAccountsByUser,
  updateAccount,
} from "../services/account-service.js";
import { calcularLimiteDiario } from "../services/daily-limit-service.js";
import { calcularLimiteDiarioV2 } from "../services/daily-limit-v2-service.js";
import { uuidSchema } from "../lib/validation.js";
import { DAILY_LIMIT_V1_SUNSET } from "../lib/deprecation.js";
import { commonErrors } from "../lib/schemas.js";

const contaParamsSchema = z.object({ contaId: uuidSchema });

const createAccountBodySchema = z.object({
  nome: z.string().min(1),
  saldo_inicial: z.number().optional(),
});

const accountResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  saldoInicial: z.string(),
  papel: z.string(),
  createdAt: z.date(),
});

const accountUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  saldoInicial: z.string(),
  createdAt: z.date(),
});

const paginatedAccountsResponseSchema = z.object({
  data: z.array(accountResponseSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

const limiteDiarioResponseSchema = z.object({
  contaId: z.string().uuid(),
  mes_referencia: z.string(),
  saldo_disponivel: z.string(),
  despesas_fixas_pendentes: z.string(),
  dias_restantes: z.number(),
  limite_diario: z.string(),
  calculado_em: z.string(),
});

const limiteDiarioV2ResponseSchema = z.object({
  contaId: z.string().uuid(),
  janela_inicio: z.string(),
  janela_fim: z.string(),
  horizonte_dias: z.number(),
  saldo_atual: z.string(),
  limite_diario: z.string(),
  calculado_em: z.string(),
});

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/contas",
    {
      schema: {
        body: createAccountBodySchema,
        response: {
          201: accountResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body;
      const account = await createAccount(
        {
          nome: body.nome,
          saldoInicial: body.saldo_inicial,
        },
        user.id
      );
      return reply.status(201).send(account);
    }
  );

  typedApp.get(
    "/contas",
    {
      schema: {
        querystring: z.object({
          busca: z.string().optional(),
          page: z.coerce.number().optional(),
          limit: z.coerce.number().optional(),
        }),
        response: {
          200: paginatedAccountsResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const query = request.query;

      const result = await findAccountsByUser({
        usuarioId: user.id,
        busca: query.busca,
        page: query.page,
        limit: query.limit,
      });

      return reply.status(200).send(result);
    }
  );

  typedApp.patch(
    "/contas/:contaId",
    {
      onRequest: [requireAccountRole({ minRole: "owner" })],
      schema: {
        params: contaParamsSchema,
        body: z.object({
          nome: z.string().min(1).optional(),
          saldo_inicial: z.number().optional(),
        }),
        response: {
          200: accountUpdateResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { contaId } = request.params;
      const body = request.body;
      const account = await updateAccount(contaId, {
        nome: body.nome,
        saldoInicial: body.saldo_inicial,
      });
      return reply.status(200).send(account);
    }
  );

  typedApp.get(
    "/contas/:contaId/limite-diario",
    {
      onRequest: [requireAccountRole({ minRole: "viewer" })],
      schema: {
        params: contaParamsSchema,
        response: {
          200: limiteDiarioResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { contaId } = request.params;
      const result = await calcularLimiteDiario({ contaId });
      return reply
        .status(200)
        .header("Deprecation", "true")
        .header("Sunset", DAILY_LIMIT_V1_SUNSET)
        .header("Link", `</contas/${contaId}/limite-diario-v2>; rel="successor-version"`)
        .send({ contaId, ...result });
    }
  );

  typedApp.get(
    "/contas/:contaId/limite-diario-v2",
    {
      onRequest: [requireAccountRole({ minRole: "viewer" })],
      schema: {
        params: contaParamsSchema,
        response: {
          200: limiteDiarioV2ResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { contaId } = request.params;
      const result = await calcularLimiteDiarioV2({ contaId });
      return reply.status(200).send({ contaId, ...result });
    }
  );
}
