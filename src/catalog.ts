import type { ProviderMode } from "./config.js";
import { usdToMicros } from "./money.js";

export const PROVIDER_IDS = ["you-com", "exa", "parallel", "tavily"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

interface RequestBodyRecipe {
  readonly media_type: string;
  readonly fields: Readonly<Record<string, string>>;
}

export interface CuratedOperation {
  readonly provider: { readonly id: ProviderId; readonly name: string };
  readonly operation: { readonly id: string; readonly name: string };
  readonly request: {
    readonly method: HttpMethod;
    readonly url: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly path?: Readonly<Record<string, string>>;
    readonly query?: Readonly<Record<string, string>>;
    readonly body?: RequestBodyRecipe;
  };
  readonly access: {
    readonly id: string;
    readonly protocol: string;
    readonly weft_fetch: { readonly state: string; readonly coverage?: string };
    readonly price: {
      readonly kind?: string;
      readonly indexed_usd: string;
      readonly unit?: string;
    };
  };
  readonly attribution: {
    readonly search_id: string;
    readonly operation_id: string;
    readonly access_method_id: string;
  };
  readonly output: { readonly execution_mode: string };
  readonly score?: number;
}

const EXPECTED_OPERATION: Readonly<Record<ProviderId, string>> = {
  "you-com": "you-search-get",
  exa: "exa-search",
  parallel: "parallel-search",
  tavily: "tavily-search-x402",
};

const MODE_PROVIDER: Readonly<Record<Exclude<ProviderMode, "auto">, ProviderId>> = {
  youcom: "you-com",
  exa: "exa",
  parallel: "parallel",
  tavily: "tavily",
};

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function providerId(value: unknown): ProviderId | undefined {
  const id = text(value);
  return PROVIDER_IDS.find((candidate) => candidate === id);
}

function httpMethod(value: unknown): HttpMethod | undefined {
  const method = text(value)?.toUpperCase();
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method ?? "")
    ? (method as HttpMethod)
    : undefined;
}

function inputNames(schemaValue: unknown): string[] {
  const schema = record(schemaValue);
  const properties = record(schema?.properties);
  return properties ? Object.keys(properties) : [];
}

function firstSupportedAccess(
  endpoint: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const methods = Array.isArray(endpoint.accessMethods) ? endpoint.accessMethods : [];
  return methods.map(record).find((method) => record(method?.weftFetch)?.state === "supported");
}

function indexedPrice(
  endpoint: Record<string, unknown>,
  access: Record<string, unknown>,
): string | undefined {
  const endpointPrice = text(record(endpoint.price)?.indexedUsd);
  const accessPrice = record(access.price);
  return endpointPrice ?? text(accessPrice?.indexed_usd) ?? text(accessPrice?.indexedUsd);
}

function requestRecipe(
  provider: ProviderId,
  endpoint: Record<string, unknown>,
): CuratedOperation["request"] | undefined {
  const url = text(endpoint.url);
  const call = record(endpoint.call);
  const method = httpMethod(call?.method);
  if (!url || !method) return undefined;

  const names = inputNames(call?.inputSchema);
  const fields = Object.fromEntries(names.map((name) => [name, name]));
  if (method === "GET") {
    return { method, url, query: fields };
  }

  if (["exa", "parallel", "tavily"].includes(provider)) {
    return {
      method,
      url,
      headers: { "Content-Type": "application/json" },
      body: { media_type: "application/json", fields },
    };
  }

  return { method, url };
}

export function extractOperations(responseValue: unknown): CuratedOperation[] {
  const response = record(responseValue);
  const searchId = text(response?.queryTraceId);
  const results = Array.isArray(response?.results) ? response.results : [];
  if (!searchId) return [];

  const operations: CuratedOperation[] = [];
  for (const resultValue of results) {
    const result = record(resultValue);
    const provider = record(result?.provider);
    const id = providerId(provider?.providerId);
    if (!result || !id) continue;

    const endpoints = Array.isArray(result.endpoints) ? result.endpoints : [];
    for (const endpointValue of endpoints) {
      const endpoint = record(endpointValue);
      const operation = record(endpoint?.operation);
      const operationId = text(operation?.id);
      const access = endpoint ? firstSupportedAccess(endpoint) : undefined;
      const accessId = text(access?.accessMethodId);
      const price = endpoint && access ? indexedPrice(endpoint, access) : undefined;
      const request = endpoint ? requestRecipe(id, endpoint) : undefined;
      const execution = record(endpoint?.execution);
      const compatibility = record(record(endpoint?.compatibility)?.weft_fetch);
      const coverage = text(compatibility?.coverage);
      const callability = record(endpoint?.callability);

      if (
        operationId !== EXPECTED_OPERATION[id] ||
        !accessId ||
        !price ||
        !request ||
        execution?.mode !== "sync" ||
        coverage !== "terminal_response" ||
        callability?.state !== "complete"
      ) {
        continue;
      }

      const score = typeof result.score === "number" ? result.score : undefined;
      const priceKind = text(record(access?.price)?.kind);
      operations.push({
        provider: { id, name: text(provider?.displayName) ?? id },
        operation: { id: operationId, name: text(operation?.name) ?? "Search the web" },
        request,
        access: {
          id: accessId,
          protocol: text(access?.protocol) ?? "x402",
          weft_fetch: { state: "supported", coverage },
          price: {
            indexed_usd: price,
            ...(priceKind ? { kind: priceKind } : {}),
          },
        },
        attribution: {
          search_id: searchId,
          operation_id: operationId,
          access_method_id: accessId,
        },
        output: { execution_mode: "sync" },
        ...(score === undefined ? {} : { score }),
      });
    }
  }
  return operations;
}

export function selectOperation(
  operations: readonly CuratedOperation[],
  mode: ProviderMode,
  maxCostUsd: string,
): CuratedOperation {
  const ceiling = usdToMicros(maxCostUsd);
  const fixedProvider = mode === "auto" ? undefined : MODE_PROVIDER[mode];
  let selected: CuratedOperation | undefined;
  let selectedPrice: bigint | undefined;

  for (const operation of operations) {
    if (fixedProvider && operation.provider.id !== fixedProvider) continue;
    if (operation.operation.id !== EXPECTED_OPERATION[operation.provider.id]) continue;
    if (operation.access.weft_fetch.state !== "supported") continue;
    if (operation.access.weft_fetch.coverage !== "terminal_response") continue;
    if (operation.output.execution_mode !== "sync") continue;

    let price: bigint;
    try {
      price = usdToMicros(operation.access.price.indexed_usd);
    } catch {
      continue;
    }
    if (price > ceiling) continue;

    const higherScore =
      price === selectedPrice &&
      (operation.score ?? Number.NEGATIVE_INFINITY) > (selected?.score ?? Number.NEGATIVE_INFINITY);
    if (!selected || selectedPrice === undefined || price < selectedPrice || higherScore) {
      selected = operation;
      selectedPrice = price;
    }
  }

  if (!selected) {
    throw new Error(`No compatible websearch operation is available within $${maxCostUsd}`);
  }
  return selected;
}
