import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { commonErrors } from "../lib/schemas.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/me",
    {
      schema: {
        response: {
          200: z.object({
            id: z.string().uuid(),
            nome: z.string(),
            email: z.string().email(),
            isAdmin: z.boolean(),
          }),
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      return reply.status(200).send({
        id: user.id,
        nome: user.nome,
        email: user.email,
        isAdmin: user.isAdmin,
      });
    }
  );
}
