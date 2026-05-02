import { z } from "zod";

/**
 * Schema reutilizável para respostas de erro da API.
 * Alinhado com a estrutura definida no error-handler.ts.
 */
export const ApiErrorSchema = z.object({
  code: z.string().describe("Código de erro legível por máquina"),
  message: z.string().describe("Descrição do erro"),
  timestamp: z.string().datetime().describe("Timestamp ISO do erro"),
  requestId: z.string().describe("ID único da requisição para rastreabilidade"),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const commonErrors = {
  401: ApiErrorSchema,
  403: ApiErrorSchema,
  404: ApiErrorSchema,
  409: ApiErrorSchema,
  422: ApiErrorSchema,
  500: ApiErrorSchema,
};

/**
 * Schema único de paginação. Todas listagens paginadas devem usar este schema
 * sob a chave `pagination` (camelCase) — nunca `meta` nem snake_case.
 */
export const paginationSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    pagination: paginationSchema,
  });
}
