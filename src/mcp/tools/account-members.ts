import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contaUsuarios, usuarios } from "../../db/schema.js";
import type { McpTool } from "../tool-types.js";

export const accountMembersList: McpTool<{ contaId: string }> = {
  name: "account-members.list",
  description: "List members (users) associated with an account and their roles.",
  requiredScope: "account-members:read",
  minRole: "viewer",
  inputSchema: z.object({
    contaId: z.uuid(),
  }),
  async handler({ input }) {
    const members = await db
      .select({
        usuarioId: usuarios.id,
        email: usuarios.email,
        nome: usuarios.nome,
        papel: contaUsuarios.papel,
        createdAt: contaUsuarios.createdAt,
      })
      .from(contaUsuarios)
      .innerJoin(usuarios, eq(contaUsuarios.usuarioId, usuarios.id))
      .where(eq(contaUsuarios.contaId, input.contaId));

    return { contaId: input.contaId, data: members };
  },
};
