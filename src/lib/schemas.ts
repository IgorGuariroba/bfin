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
