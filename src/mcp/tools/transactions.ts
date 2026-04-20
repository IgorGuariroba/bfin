import { z } from "zod";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  findTransactionsByAccount,
  findTransactionById,
} from "../../services/transaction-service.js";
import { assertAccountRole } from "../../lib/account-authorization.js";
import { NotFoundError } from "../../lib/errors.js";
import type { McpTool } from "../tool-types.js";

const isoDate = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

export const transactionsList: McpTool<{
  contaId: string;
  dataInicio?: Date;
  dataFim?: Date;
  tipo?: "receita" | "despesa";
  categoriaId?: string;
  busca?: string;
  page?: number;
  limit?: number;
}> = {
  name: "transactions_list",
  description: "List transactions for an account.",
  requiredScope: "transactions:read",
  minRole: "viewer",
  inputSchema: z.object({
    contaId: z.uuid(),
    dataInicio: isoDate.optional(),
    dataFim: isoDate.optional(),
    tipo: z.enum(["receita", "despesa"]).optional(),
    categoriaId: z.uuid().optional(),
    busca: z.string().optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  async handler({ input }) {
    return await findTransactionsByAccount(input);
  },
};

export const transactionsCreate: McpTool<{
  contaId: string;
  tipo: "receita" | "despesa";
  categoriaId: string;
  descricao?: string;
  valor: number;
  data: Date;
  recorrente?: boolean;
  dataFim?: Date | null;
}> = {
  name: "transactions_create",
  description: "Create a new transaction in an account.",
  requiredScope: "transactions:write",
  minRole: "owner",
  inputSchema: z.object({
    contaId: z.uuid(),
    tipo: z.enum(["receita", "despesa"]),
    categoriaId: z.uuid(),
    descricao: z.string().max(255).optional(),
    valor: z.number().positive(),
    data: isoDate,
    recorrente: z.boolean().optional(),
    dataFim: isoDate.nullable().optional(),
  }),
  async handler({ input, actingUserId }) {
    return await createTransaction(input, actingUserId);
  },
};

export const transactionsUpdate: McpTool<{
  id: string;
  contaId: string;
  tipo?: "receita" | "despesa";
  categoriaId?: string;
  descricao?: string | null;
  valor?: number;
  data?: Date;
  recorrente?: boolean;
  dataFim?: Date | null;
}> = {
  name: "transactions_update",
  description: "Update an existing transaction.",
  requiredScope: "transactions:write",
  inputSchema: z.object({
    id: z.uuid(),
    contaId: z.uuid(),
    tipo: z.enum(["receita", "despesa"]).optional(),
    categoriaId: z.uuid().optional(),
    descricao: z.string().max(255).nullable().optional(),
    valor: z.number().positive().optional(),
    data: isoDate.optional(),
    recorrente: z.boolean().optional(),
    dataFim: isoDate.nullable().optional(),
  }),
  async handler({ input, actingUserId }) {
    const tx = await findTransactionById(input.id);
    if (!tx) throw new NotFoundError("Transaction not found");
    await assertAccountRole(actingUserId, tx.contaId, "owner");

    const { id } = input;
    const rest = {
      tipo: input.tipo,
      categoriaId: input.categoriaId,
      descricao: input.descricao,
      valor: input.valor,
      data: input.data,
      recorrente: input.recorrente,
      dataFim: input.dataFim,
    };
    return await updateTransaction(id, rest);
  },
};

export const transactionsDelete: McpTool<{ id: string; contaId: string }> = {
  name: "transactions_delete",
  description: "Delete an existing transaction.",
  requiredScope: "transactions:write",
  inputSchema: z.object({
    id: z.uuid(),
    contaId: z.uuid(),
  }),
  async handler({ input, actingUserId }) {
    const tx = await findTransactionById(input.id);
    if (!tx) throw new NotFoundError("Transaction not found");
    await assertAccountRole(actingUserId, tx.contaId, "owner");

    await deleteTransaction(input.id);
    return { deleted: true, id: input.id };
  },
};
