import { FastifyInstance } from "fastify";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me", async (request, reply) => {
    const user = request.user!;
    return reply.status(200).send({
      id: user.id,
      nome: user.nome,
      email: user.email,
      isAdmin: user.isAdmin,
    });
  });
}
