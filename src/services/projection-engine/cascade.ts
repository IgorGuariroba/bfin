import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { toCents } from "../../lib/money.js";
import { monthKey, previousMonth } from "../../lib/month.js";
import { calcularMes } from "./calculator.js";
import {
  loadConta,
  loadMeta,
  loadMovimentacoesDoMes,
  loadParcelasDoMes,
} from "./loaders.js";
import { readProjecao, upsertProjecao } from "./persistence.js";
import type { ReadProjecaoResult } from "./persistence.js";

export const CASCADE_MAX_DEPTH = 12;

export class CascadeDepthExceededError extends AppError {
  constructor(contaId: string, mes: string) {
    super(
      `Cascata de recálculo excedeu o limite de ${CASCADE_MAX_DEPTH} meses (conta ${contaId}, mes ${mes}). Atualize saldo_inicial da conta.`,
      422,
      "CASCADE_DEPTH_EXCEEDED"
    );
  }
}

export interface ResolveProjecaoOptions {
  contaId: string;
  mes: string;
  depth?: number;
}

export async function resolveProjecao(
  options: ResolveProjecaoOptions
): Promise<ReadProjecaoResult> {
  const { contaId, mes, depth = 0 } = options;

  if (depth > CASCADE_MAX_DEPTH) {
    throw new CascadeDepthExceededError(contaId, mes);
  }

  const existing = await readProjecao(contaId, mes);
  if (existing && existing.status === "atualizada") {
    return existing;
  }

  logger.debug({ contaId, mes, depth }, "projection recompute start");

  const conta = await loadConta(contaId);
  if (!conta) {
    throw new AppError(`Conta ${contaId} não encontrada`, 404, "RESOURCE_NOT_FOUND");
  }

  const creationMonth = monthKey(conta.createdAt);

  let saldoBaseCentavos: bigint;
  if (mes <= creationMonth) {
    saldoBaseCentavos = toCents(conta.saldoInicial);
  } else {
    const prev = previousMonth(mes);
    const prevResult = await resolveProjecao({
      contaId,
      mes: prev,
      depth: depth + 1,
    });
    saldoBaseCentavos = toCents(prevResult.dados.resumo.saldo_final_projetado);
  }

  const [mov, parcelas, meta] = await Promise.all([
    loadMovimentacoesDoMes(contaId, mes),
    loadParcelasDoMes(contaId, mes),
    loadMeta(contaId),
  ]);

  const mensal = calcularMes({
    saldoInicialCentavos: saldoBaseCentavos,
    mes,
    receitas: mov.receitas,
    despesas: mov.despesas,
    parcelas,
    meta,
  });

  const result = await upsertProjecao(contaId, mes, mensal);
  logger.debug(
    { contaId, mes, depth, saldo_final: mensal.resumo.saldo_final_projetado },
    "projection upserted"
  );
  return result;
}
