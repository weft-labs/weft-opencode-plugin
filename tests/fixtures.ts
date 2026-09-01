import type { CuratedOperation } from "../src/catalog.js";

export function operation(
  provider: CuratedOperation["provider"]["id"],
  price: string,
  overrides: Partial<CuratedOperation> = {},
): CuratedOperation {
  const operationIds = {
    "you-com": "you-search-get",
    exa: "exa-search",
    parallel: "parallel-search",
    tavily: "tavily-search-x402",
  } as const;
  const operationId = operationIds[provider];
  return {
    provider: { id: provider, name: provider },
    operation: { id: operationId, name: "Search the web" },
    request: {
      method: "POST",
      url: `https://${provider}.example/search`,
      headers: { "Content-Type": "application/json" },
      body: { media_type: "application/json", fields: { query: "query" } },
    },
    access: {
      id: `${provider}-access`,
      protocol: "x402",
      weft_fetch: { state: "supported", coverage: "terminal_response" },
      price: { kind: "fixed", indexed_usd: price, unit: "request" },
    },
    attribution: {
      search_id: "search-1",
      operation_id: operationId,
      access_method_id: `${provider}-access`,
    },
    output: { execution_mode: "sync" },
    ...overrides,
  };
}
