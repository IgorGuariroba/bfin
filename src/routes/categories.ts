import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAdmin } from "../plugins/auth-guard.js";
import {
  createCategory,
  findAllCategories,
  updateCategory,
  deleteCategory,
} from "../services/category-service.js";
import { uuidSchema } from "../lib/validation.js";
import { commonErrors } from "../lib/schemas.js";

const categoriaParamsSchema = z.object({ categoriaId: uuidSchema });

const categoryResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  tipo: z.string(),
  createdAt: z.coerce.date(),
});

const paginatedCategoriesResponseSchema = z.object({
  data: z.array(categoryResponseSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/categorias",
    {
      onRequest: [requireAdmin()],
      schema: {
        body: z.object({
          nome: z.string().min(1),
          tipo: z.string().min(1),
        }),
        response: {
          201: categoryResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const category = await createCategory({
        nome: body.nome,
        tipo: body.tipo,
      });
      return reply.status(201).send(category);
    }
  );

  typedApp.get(
    "/categorias",
    {
      schema: {
        querystring: z.object({
          tipo: z.string().optional(),
          busca: z.string().optional(),
          page: z.coerce.number().optional(),
          limit: z.coerce.number().optional(),
        }),
        response: {
          200: paginatedCategoriesResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = request.query;

      const result = await findAllCategories({
        tipo: query.tipo,
        busca: query.busca,
        page: query.page,
        limit: query.limit,
      });

      return reply.status(200).send(result);
    }
  );

  typedApp.put(
    "/categorias/:categoriaId",
    {
      onRequest: [requireAdmin()],
      schema: {
        params: categoriaParamsSchema,
        body: z.object({
          nome: z.string().min(1),
          tipo: z.string().min(1),
        }),
        response: {
          200: categoryResponseSchema,
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { categoriaId } = request.params;
      const body = request.body;
      const category = await updateCategory(categoriaId, {
        nome: body.nome,
        tipo: body.tipo,
      });
      return reply.status(200).send(category);
    }
  );

  typedApp.delete(
    "/categorias/:categoriaId",
    {
      onRequest: [requireAdmin()],
      schema: {
        params: categoriaParamsSchema,
        response: {
          200: z.object({ ok: z.boolean() }),
          ...commonErrors,
        },
      },
    },
    async (request, reply) => {
      const { categoriaId } = request.params;
      await deleteCategory(categoriaId);
      return reply.status(200).send({ ok: true });
    }
  );
}
