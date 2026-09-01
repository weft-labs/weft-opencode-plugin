const USD_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d{1,6}))?$/;

export function usdToMicros(value: string): bigint {
  const match = USD_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid USD amount: ${value}`);
  }

  const [whole = "0", fraction = ""] = value.trim().split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}
