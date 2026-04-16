export function toCents(value: number | string): bigint {
  const str = typeof value === "number" ? value.toFixed(2) : String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match) {
    throw new Error(`Invalid decimal value: ${value}`);
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const integer = BigInt(match[2]);
  const fractionRaw = match[3] ?? "";
  const fraction = (fractionRaw + "00").slice(0, 2);
  return sign * (integer * 100n + BigInt(fraction));
}

export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const integer = abs / 100n;
  const remainder = abs % 100n;
  const fraction = remainder.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${integer.toString()}.${fraction}`;
}

export function roundHalfEven(value: number, scale = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** scale;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let rounded: number;
  if (diff < 0.5) {
    rounded = floor;
  } else if (diff > 0.5) {
    rounded = floor + 1;
  } else {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  }
  return rounded / factor;
}

export function roundCentsHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("Division by zero");
  }
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;
  const quotient = absNum / absDen;
  const remainderTwice = (absNum % absDen) * 2n;
  let result: bigint;
  if (remainderTwice < absDen) {
    result = quotient;
  } else if (remainderTwice > absDen) {
    result = quotient + 1n;
  } else {
    result = quotient % 2n === 0n ? quotient : quotient + 1n;
  }
  return negative ? -result : result;
}
