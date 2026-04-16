import { roundCentsHalfEven } from "../../lib/money.js";
import type { IndicadorReserva } from "./types.js";

export function calcularReservaIdealCentavos(
  receitasBrutasCentavos: bigint,
  porcentagem: string
): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(porcentagem.trim());
  if (!match) {
    throw new Error(`Invalid porcentagem: ${porcentagem}`);
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const integer = BigInt(match[2]);
  const fractionRaw = match[3] ?? "";
  const fraction = (fractionRaw + "0000").slice(0, 4);
  const numerator = sign * (integer * 10000n + BigInt(fraction));
  return roundCentsHalfEven(receitasBrutasCentavos * numerator, 1000000n);
}

export function classificarIndicador(
  sobraRealCentavos: bigint,
  reservaIdealCentavos: bigint
): IndicadorReserva {
  if (sobraRealCentavos <= 0n) return "vermelho";
  if (sobraRealCentavos >= reservaIdealCentavos) return "verde";
  return "amarelo";
}
