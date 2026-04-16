import type { FastifyBaseLogger } from "fastify";
import { eventBus, type ProjecaoRecalcularPayload } from "../../lib/event-bus.js";
import { resolveProjecao } from "./cascade.js";

export {
  resolveProjecao,
  CASCADE_MAX_DEPTH,
  CascadeDepthExceededError,
} from "./cascade.js";
export { calcularMes } from "./calculator.js";
export { loadMeta } from "./loaders.js";
export { readProjecao } from "./persistence.js";

export interface RegisterProjectionListenerOptions {
  logger: FastifyBaseLogger;
}

export function registerProjectionListener(
  options: RegisterProjectionListenerOptions
): void {
  const { logger } = options;
  eventBus.removeAllListeners("projecao:recalcular");
  eventBus.on("projecao:recalcular", (payload: ProjecaoRecalcularPayload) => {
    setImmediate(() => {
      Promise.resolve()
        .then(() =>
          resolveProjecao({ contaId: payload.contaId, mes: payload.mesInicial })
        )
        .then(() => {
          logger.debug(
            { contaId: payload.contaId, mes: payload.mesInicial },
            "projection recalculated"
          );
        })
        .catch((err) => {
          logger.error(
            {
              err,
              contaId: payload.contaId,
              mes: payload.mesInicial,
            },
            "projection recalculation failed"
          );
        });
    });
  });
}
