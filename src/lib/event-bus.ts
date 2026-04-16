import { EventEmitter } from "node:events";

export interface ProjecaoRecalcularPayload {
  contaId: string;
  mesInicial: string;
}

type ProjecaoRecalcularHandler = (
  payload: ProjecaoRecalcularPayload
) => void | Promise<void>;

class TypedEventBus {
  private readonly emitter = new EventEmitter();

  emit(event: "projecao:recalcular", payload: ProjecaoRecalcularPayload): void {
    this.emitter.emit(event, payload);
  }

  on(event: "projecao:recalcular", handler: ProjecaoRecalcularHandler): void {
    this.emitter.on(event, handler);
  }

  off(event: "projecao:recalcular", handler: ProjecaoRecalcularHandler): void {
    this.emitter.off(event, handler);
  }

  removeAllListeners(event?: "projecao:recalcular"): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  listenerCount(event: "projecao:recalcular"): number {
    return this.emitter.listenerCount(event);
  }
}

export const eventBus = new TypedEventBus();
