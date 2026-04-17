import { z } from "zod";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  findTransactionsByAccount,
} from "../../services/transaction-service.js";
import type { McpTool } from "../tool-types.js";

const isoDate = z.string().datetime({ offset: true }).transform((v) => new Date(v));

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
  name: "transactions.list",
  description: "List transactions for an account.",
  requiredScope: "transactions:read",
  minRole: "viewer",
  inputSchema: z.object({
    contaId: z.string().uuid(),
    dataInicio: isoDate.optional(),
    dataFim: isoDate.optional(),
    tipo: z.enum(["receita", "despesa"]).optional(),
    categoriaId: z.string().uuid().optional(),
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
  name: "transactions.create",
  description: "Create a new transaction in an account.",
  requiredScope: "transactions:write",
  minRole: "owner",
  inputSchema: z.object({
    contaId: z.string().uuid(),
    tipo: z.enum(["receita", "despesa"]),
    categoriaId: z.string().uuid(),
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
  name: "transactions.update",
  description: "Update an existing transaction.",
  requiredScope: "transactions:write",
  minRole: "owner",
  inputSchema: z.object({
    id: z.string().uuid(),
    contaId: z.string().uuid(),
    tipo: z.enum(["receita", "despesa"]).optional(),
    categoriaId: z.string().uuid().optional(),
    descricao: z.string().max(255).nullable().optional(),
    valor: z.number().positive().optional(),
    data: isoDate.optional(),
    recorrente: z.boolean().optional(),
    dataFim: isoDate.nullable().optional(),
  }),
  async handler({ input }) {
    const { id, ...rest } = input;
    return await updateTransaction(id, rest);
  },
};

export const transactionsDelete: McpTool<{ id: string; contaId: string }> = {
  name: "transactions.delete",
  description: "Delete an existing transaction.",
  requiredScope: "transactions:write",
  minRole: "owner",
  inputSchema: z.object({
    id: z.string().uuid(),
    contaId: z.string().uuid(),
  }),
  async handler({ input }) {
    await deleteTransaction(input.id);
    return { deleted: true, id: input.id };
  },
};
