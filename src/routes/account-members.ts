import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAccountRole } from "../plugins/account-authorization.js";
import { addMember } from "../services/account-member-service.js";
import { uuidSchema } from "../lib/validation.js";
import { commonErrors } from "../lib/schemas.js";

const contaParamsSchema = z.object({ contaId: uuidSchema });

const addMemberResponseSchema = z.object({
  usuarioId: z.string().uuid(),
  email: z.string().email(),
  papel: z.enum(["owner", "viewer"]),
});

export async function accountMemberRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/contas/:contaId/usuarios",
    {
      onRequest: [requireAccountRole({ minRole: "owner" })],
      schema: {
        params: contaParamsSchema,
        body: z.object({
          email: z.string().email(),
          papel: z.enum(["owner", "viewer"]),
        }),
        response: {
          201: addMemberResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { contaId } = request.params;
      const body = request.body;
      const result = await addMember({
        contaId,
        email: body.email,
        papel: body.papel,
      });
      return reply.status(201).send(result);
    }
  );
}
