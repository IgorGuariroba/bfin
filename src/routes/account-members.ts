import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import { addMember } from "../services/account-member-service.js";
import { parseOrThrow, uuidSchema } from "../lib/validation.js";

const contaParamsSchema = z.object({ contaId: uuidSchema });

export async function accountMemberRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/contas/:contaId/usuarios",
    { onRequest: [requireAccountRole({ minRole: "owner" })] },
    async (request, reply) => {
      const { contaId } = parseOrThrow(contaParamsSchema, request.params, "params");
      const body = request.body as { email: string; papel: "owner" | "viewer" };
      const result = await addMember({
        contaId,
        email: body.email,
        papel: body.papel,
      });
      return reply.status(201).send(result);
    }
  );
}
