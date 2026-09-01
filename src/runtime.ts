import type { ProviderId } from "./catalog.js";
import { selectOperation } from "./catalog.js";
import type { RuntimeConfig } from "./config.js";
import { usdToMicros } from "./money.js";
import { normalizeResults } from "./normalize.js";
import type { WebSearchResult } from "./normalize.js";
import { buildFetchRequest } from "./request.js";
import type { PaidRequest } from "./request.js";

export interface CatalogSearchRequest {
  readonly query: string;
  readonly maxResults: number;
  readonly filters: {
    readonly type: { readonly eq: "api" };
    readonly executionMode: { readonly eq: "sync" };
    readonly weftFetchCompatible: true;
    readonly price: { readonly lte: string };
    readonly includeUnknownPrices: true;
  };
}

interface CallOptions {
  readonly signal: AbortSignal;
}

interface FetchCallOptions extends CallOptions {
  readonly idempotencyKey: string;
}

export interface WeftGateway {
  balance(options: CallOptions): Promise<unknown>;
  search(
    request: CatalogSearchRequest,
    options: CallOptions,
  ): Promise<{ readonly results: readonly import("./catalog.js").CuratedOperation[] }>;
  fetch(request: PaidRequest, options: FetchCallOptions): Promise<{ readonly bodyBase64: string }>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function money(value: unknown): bigint | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return usdToMicros(value);
  } catch {
    return undefined;
  }
}

export function assertSpendAvailable(balanceValue: unknown, maxCostUsd: string): void {
  const balance = record(balanceValue);
  const wallet = record(balance?.wallet);
  const promo = record(balance?.promo);
  const policy = record(balance?.policy);
  const cost = usdToMicros(maxCostUsd);

  const walletAmount = money(wallet?.totalUsd);
  const promoAmount = money(promo?.balanceUsd) ?? 0n;
  if (walletAmount !== undefined && walletAmount + promoAmount < cost) {
    throw new Error(`Weft balance is below the $${maxCostUsd} websearch ceiling`);
  }

  const maxTransaction = money(policy?.maxTxUsd);
  if (maxTransaction !== undefined && maxTransaction < cost) {
    throw new Error(`Weft transaction policy is below the $${maxCostUsd} websearch ceiling`);
  }

  const spentToday = money(balance?.spentTodayUsd);
  const dailyLimit = money(policy?.dailyLimitUsd);
  if (spentToday !== undefined && dailyLimit !== undefined && spentToday + cost > dailyLimit) {
    throw new Error("Weft daily spending policy has insufficient headroom for websearch");
  }

  const spentWeek = money(balance?.spentWeekUsd);
  const weeklyLimit = money(policy?.weeklyLimitUsd);
  if (spentWeek !== undefined && weeklyLimit !== undefined && spentWeek + cost > weeklyLimit) {
    throw new Error("Weft weekly spending policy has insufficient headroom for websearch");
  }
}

function catalogQuery(provider: RuntimeConfig["provider"]): string {
  return provider === "auto"
    ? "You.com Exa Parallel Tavily synchronous web search API"
    : `${provider} provider synchronous web search API`;
}

function providerInputs(provider: ProviderId, query: string): Record<string, string | number> {
  switch (provider) {
    case "you-com":
      return { query, count: 10 };
    case "exa":
      return { query, numResults: 10 };
    case "parallel":
      return { query, mode: "fast" };
    case "tavily":
      return { query, max_results: 10 };
  }
}

function decodeJson(bodyBase64: string): unknown {
  try {
    return JSON.parse(Buffer.from(bodyBase64, "base64").toString("utf8"));
  } catch (error) {
    throw new Error("Websearch provider returned invalid JSON", { cause: error });
  }
}

export function createSearchExecutor(gateway: WeftGateway, config: RuntimeConfig) {
  return async (
    input: { readonly query: string },
    context: { readonly signal: AbortSignal },
  ): Promise<readonly WebSearchResult[]> => {
    const query = input.query.trim();
    if (!query) throw new Error("Websearch query must not be empty");
    context.signal.throwIfAborted();

    const balance = await gateway.balance({ signal: context.signal });
    assertSpendAvailable(balance, config.maxCostUsd);

    const search = await gateway.search(
      {
        query: catalogQuery(config.provider),
        maxResults: 20,
        filters: {
          type: { eq: "api" },
          executionMode: { eq: "sync" },
          weftFetchCompatible: true,
          price: { lte: config.maxCostUsd },
          includeUnknownPrices: true,
        },
      },
      { signal: context.signal },
    );
    const operation = selectOperation(search.results, config.provider, config.maxCostUsd);
    const request = buildFetchRequest(
      operation,
      providerInputs(operation.provider.id, query),
      config.maxCostUsd,
    );

    const response = await gateway.fetch(request, {
      idempotencyKey: crypto.randomUUID(),
      signal: context.signal,
    });
    return normalizeResults(operation.provider.id, decodeJson(response.bodyBase64));
  };
}
