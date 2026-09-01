import { WeftClient } from "@weft-labs/sdk";
import type { FetchAPI } from "@weft-labs/sdk";

import { extractOperations } from "./catalog.js";
import type { RuntimeConfig } from "./config.js";
import { readApiKey } from "./config.js";
import type { CatalogSearchRequest, WeftGateway } from "./runtime.js";
import type { PaidRequest } from "./request.js";

function client(config: RuntimeConfig, signal: AbortSignal): WeftClient {
  const fetchApi: FetchAPI = (input, init) => fetch(input, { ...init, signal });
  return new WeftClient({
    apiKey: readApiKey(),
    fetchApi,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
  });
}

export function createSdkGateway(config: RuntimeConfig): WeftGateway {
  return {
    async balance({ signal }) {
      return client(config, signal).balance();
    },
    async search(request: CatalogSearchRequest, { signal }) {
      const response = await client(config, signal).search(request);
      return { results: extractOperations(response) };
    },
    async fetch(request: PaidRequest, { idempotencyKey, signal }) {
      const response = await client(config, signal).fetch(
        {
          url: request.url,
          method: request.method,
          maxCostUsd: request.maxCostUsd,
          searchId: request.searchId,
          operationId: request.operationId,
          accessMethodId: request.accessMethodId,
          ...(request.headers ? { headers: request.headers } : {}),
          ...(request.body ? { body: request.body } : {}),
        },
        { idempotencyKey },
      );
      return { bodyBase64: response.bodyBase64 };
    },
  };
}
