import { FastifyInstance } from "fastify";
import { requireAccountRole } from "../plugins/account-authorization.js";
import { addMember } from "../services/account-member-service.js";

export async function accountMemberRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/contas/:contaId/usuarios",
    { onRequest: [requireAccountRole({ minRole: "owner" })] },
    async (request, reply) => {
      const { contaId } = request.params as { contaId: string };
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
