import { z } from "zod";
import {
  findAllCategories,
  createCategory,
} from "../../services/category-service.js";
import type { McpTool } from "../tool-types.js";

export const categoriesList: McpTool<{
  tipo?: string;
  busca?: string;
  page?: number;
  limit?: number;
}> = {
  name: "categories.list",
  description: "List categories, optionally filtered by tipo or busca.",
  requiredScope: "categories:read",
  inputSchema: z.object({
    tipo: z.string().optional(),
    busca: z.string().optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  async handler({ input }) {
    return await findAllCategories(input);
  },
};

export const categoriesCreate: McpTool<{ nome: string; tipo: string; contaId: string }> = {
  name: "categories.create",
  description: "Create a new category. contaId is required to enforce role check.",
  requiredScope: "categories:write",
  minRole: "owner",
  inputSchema: z.object({
    contaId: z.string().uuid(),
    nome: z.string().min(1).max(255),
    tipo: z.string().min(1),
  }),
  async handler({ input }) {
    return await createCategory({ nome: input.nome, tipo: input.tipo });
  },
};
