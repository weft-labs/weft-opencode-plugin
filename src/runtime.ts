import type { ProviderId } from "./catalog.js";
import { selectOperation } from "./catalog.js";
import type { SearchConfig } from "./config.js";
import { usdToMicros } from "./money.js";
import type { WebSearchResult } from "./normalize.js";
import { normalizeResults } from "./normalize.js";
import type { PaidRequest } from "./request.js";
import { buildFetchRequest } from "./request.js";

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

export interface PaidFetchResponse {
  readonly status: number;
  readonly bodyBase64: string;
  readonly paidUsd: string;
  readonly heldUsd: string | null;
  readonly paymentStatus: string;
  readonly artifactId: number | null;
}

export interface WeftGateway {
  balance(options: CallOptions): Promise<unknown>;
  search(
    request: CatalogSearchRequest,
    options: CallOptions,
  ): Promise<{ readonly results: readonly import("./catalog.js").CuratedOperation[] }>;
  fetch(request: PaidRequest, options: FetchCallOptions): Promise<PaidFetchResponse>;
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

function catalogQuery(provider: SearchConfig["provider"]): string {
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

function providerName(provider: ProviderId): string {
  return provider === "you-com" ? "You.com" : provider.charAt(0).toUpperCase() + provider.slice(1);
}

function paidFetchError(
  provider: ProviderId,
  response: PaidFetchResponse,
  reason: string,
  cause?: unknown,
): Error {
  const held = response.heldUsd === null ? "" : `, held: $${response.heldUsd}`;
  const artifact = response.artifactId === null ? "none" : String(response.artifactId);
  const message = `${providerName(provider)} ${reason} after a Weft paid fetch (payment: ${response.paymentStatus}, paid: $${response.paidUsd}${held}, artifact: ${artifact}). Check Weft purchase history before retrying.`;
  return cause === undefined ? new Error(message) : new Error(message, { cause });
}

export function createSearchExecutor(gateway: WeftGateway, config: SearchConfig) {
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
    if (response.status < 200 || response.status >= 300) {
      throw paidFetchError(operation.provider.id, response, `returned HTTP ${response.status}`);
    }

    let results: readonly WebSearchResult[];
    try {
      results = normalizeResults(operation.provider.id, decodeJson(response.bodyBase64));
    } catch (error) {
      throw paidFetchError(
        operation.provider.id,
        response,
        "returned invalid provider data",
        error,
      );
    }
    if (results.length === 0) {
      throw paidFetchError(operation.provider.id, response, "returned no usable OpenCode results");
    }
    return results;
  };
}
