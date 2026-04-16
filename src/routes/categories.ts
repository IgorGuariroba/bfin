import { FastifyInstance } from "fastify";
import { requireAdmin } from "../plugins/auth-guard.js";
import {
  createCategory,
  findAllCategories,
  findCategoryById,
  updateCategory,
  deleteCategory,
} from "../services/category-service.js";

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/categorias",
    { onRequest: [requireAdmin()] },
    async (request, reply) => {
      const body = request.body as { nome: string; tipo: string };
      const category = await createCategory({
        nome: body.nome,
        tipo: body.tipo,
      });
      return reply.status(201).send(category);
    }
  );

  app.get("/categorias", async (request, reply) => {
    const query = request.query as {
      tipo?: string;
      busca?: string;
      page?: string;
      limit?: string;
    };

    const result = await findAllCategories({
      tipo: query.tipo,
      busca: query.busca,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.status(200).send(result);
  });

  app.put(
    "/categorias/:categoriaId",
    { onRequest: [requireAdmin()] },
    async (request, reply) => {
      const { categoriaId } = request.params as { categoriaId: string };
      const body = request.body as { nome: string; tipo: string };
      const category = await updateCategory(categoriaId, {
        nome: body.nome,
        tipo: body.tipo,
      });
      return reply.status(200).send(category);
    }
  );

  app.delete(
    "/categorias/:categoriaId",
    { onRequest: [requireAdmin()] },
    async (request, reply) => {
      const { categoriaId } = request.params as { categoriaId: string };
      await deleteCategory(categoriaId);
      return reply.status(200).send({ ok: true });
    }
  );
}
