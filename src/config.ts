import { usdToMicros } from "./money.js";

export type ProviderMode = "auto" | "youcom" | "exa" | "parallel" | "tavily";

export interface RuntimeConfig {
  readonly provider: ProviderMode;
  readonly maxCostUsd: string;
  readonly baseUrl?: string;
}

type Environment = Readonly<Record<string, string | undefined>>;

function stringOption(options: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function providerMode(value: string | undefined): ProviderMode {
  const mode = value ?? "auto";
  if (["auto", "youcom", "exa", "parallel", "tavily"].includes(mode)) {
    return mode as ProviderMode;
  }
  throw new Error(`Invalid Weft websearch provider: ${mode}`);
}

function baseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const parsed = new URL(value);
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("WEFT_BASE_URL must use HTTPS, except for localhost development");
  }
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}

export function readConfig(
  options: Readonly<Record<string, unknown>>,
  environment: Environment = process.env,
): RuntimeConfig {
  const maxCostUsd =
    stringOption(options, "maxCostUsd") ?? environment.WEFT_WEBSEARCH_MAX_COST_USD ?? "0.01";
  if (usdToMicros(maxCostUsd) <= 0n) {
    throw new Error("WEFT_WEBSEARCH_MAX_COST_USD must be greater than zero");
  }

  const provider = providerMode(
    stringOption(options, "provider") ?? environment.WEFT_WEBSEARCH_PROVIDER,
  );
  const configuredBaseUrl = baseUrl(stringOption(options, "baseUrl") ?? environment.WEFT_BASE_URL);

  return configuredBaseUrl
    ? { provider, maxCostUsd, baseUrl: configuredBaseUrl }
    : { provider, maxCostUsd };
}

export function readApiKey(environment: Environment = process.env): string {
  const key = environment.WEFT_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "WEFT_API_KEY is required for Weft websearch. Create a buyer key in Weft, then restart OpenCode.",
    );
  }
  return key;
}
