import { z } from "zod";
import {
  resolveProjecao,
  loadMeta,
} from "../../services/projection-engine/index.js";
import type { McpTool } from "../tool-types.js";

export const projectionsGet: McpTool<{ contaId: string; mes: string }> = {
  name: "projections.get",
  description: "Resolve the persisted/recomputed monthly projection for an account.",
  requiredScope: "projections:read",
  minRole: "viewer",
  inputSchema: z.object({
    contaId: z.uuid(),
    mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mes must be YYYY-MM"),
  }),
  async handler({ input }) {
    const resultado = await resolveProjecao({
      contaId: input.contaId,
      mes: input.mes,
    });
    const m = await loadMeta(input.contaId);
    return {
      contaId: resultado.contaId,
      mes: resultado.mes,
      status: resultado.status,
      recalculado_em: resultado.recalculadoEm.toISOString(),
      meta_reserva: m ? { porcentagem_reserva: m.porcentagemReserva } : null,
      projecao: resultado.dados.dias,
      resumo: resultado.dados.resumo,
    };
  },
};
