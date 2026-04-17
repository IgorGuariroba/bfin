import { z } from "zod";
import {
  createDebt,
  findDebtsByAccount,
  confirmInstallmentPayment,
} from "../../services/debt-service.js";
import type { McpTool } from "../tool-types.js";

const isoDate = z.string().datetime({ offset: true }).transform((v) => new Date(v));

export const debtsList: McpTool<{
  contaId: string;
  status?: "pendente" | "quitada";
  page?: number;
  limit?: number;
}> = {
  name: "debts.list",
  description: "List debts for an account.",
  requiredScope: "debts:read",
  minRole: "viewer",
  inputSchema: z.object({
    contaId: z.string().uuid(),
    status: z.enum(["pendente", "quitada"]).optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  async handler({ input }) {
    return await findDebtsByAccount(input);
  },
};

export const debtsCreate: McpTool<{
  contaId: string;
  categoriaId: string;
  descricao: string;
  valorTotal: number;
  totalParcelas: number;
  dataInicio: Date;
}> = {
  name: "debts.create",
  description: "Create a new installment debt with generated parcelas.",
  requiredScope: "debts:write",
  minRole: "owner",
  inputSchema: z.object({
    contaId: z.string().uuid(),
    categoriaId: z.string().uuid(),
    descricao: z.string().min(1).max(255),
    valorTotal: z.number().positive(),
    totalParcelas: z.number().int().positive(),
    dataInicio: isoDate,
  }),
  async handler({ input, actingUserId }) {
    return await createDebt(input, actingUserId);
  },
};

export const debtsPayInstallment: McpTool<{
  dividaId: string;
  parcelaId: string;
  contaId: string;
  dataPagamento: Date;
}> = {
  name: "debts.pay-installment",
  description: "Confirm payment of a specific installment; emits a transaction.",
  requiredScope: "debts:write",
  minRole: "owner",
  inputSchema: z.object({
    dividaId: z.string().uuid(),
    parcelaId: z.string().uuid(),
    contaId: z.string().uuid(),
    dataPagamento: isoDate,
  }),
  async handler({ input, actingUserId }) {
    return await confirmInstallmentPayment(
      input.dividaId,
      input.parcelaId,
      { dataPagamento: input.dataPagamento },
      actingUserId
    );
  },
};
