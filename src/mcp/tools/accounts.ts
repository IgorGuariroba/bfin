import { z } from "zod";
import {
  createAccount,
  findAccountsByUser,
  findAccountById,
} from "../../services/account-service.js";
import { NotFoundError } from "../../lib/errors.js";
import type { McpTool } from "../tool-types.js";

const paginationSchema = {
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
};

export const accountsList: McpTool<{
  busca?: string;
  page?: number;
  limit?: number;
}> = {
  name: "accounts_list",
  description: "List accounts accessible by the service account's acting user.",
  requiredScope: "accounts:read",
  inputSchema: z.object({
    busca: z.string().optional(),
    ...paginationSchema,
  }),
  async handler({ input, actingUserId }) {
    return await findAccountsByUser({
      usuarioId: actingUserId,
      busca: input.busca,
      page: input.page,
      limit: input.limit,
    });
  },
};

export const accountsGet: McpTool<{ contaId: string }> = {
  name: "accounts_get",
  description: "Get details of a specific account by id.",
  requiredScope: "accounts:read",
  minRole: "viewer",
  inputSchema: z.object({
    contaId: z.uuid(),
  }),
  async handler({ input }) {
    const account = await findAccountById(input.contaId);
    if (!account) throw new NotFoundError("Conta not found");
    return account;
  },
};

export const accountsCreate: McpTool<{
  nome: string;
  saldoInicial?: number;
}> = {
  name: "accounts_create",
  description: "Create a new account; the service account becomes the owner.",
  requiredScope: "accounts:write",
  inputSchema: z.object({
    nome: z.string().min(1).max(255),
    saldoInicial: z.number().optional(),
  }),
  async handler({ input, actingUserId }) {
    return await createAccount(
      { nome: input.nome, saldoInicial: input.saldoInicial },
      actingUserId
    );
  },
};
