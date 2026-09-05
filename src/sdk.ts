import type { FetchAPI } from "@weftlabs/sdk";
import { WeftClient } from "@weftlabs/sdk";

import { extractOperations } from "./catalog.js";
import type { SearchConfig } from "./config.js";
import { readApiKey } from "./config.js";
import type { PaidRequest } from "./request.js";
import type { CatalogSearchRequest, WeftGateway } from "./runtime.js";

function client(config: SearchConfig, signal: AbortSignal): WeftClient {
  const fetchApi: FetchAPI = (input, init) => fetch(input, { ...init, signal });
  return new WeftClient({
    apiKey: readApiKey(),
    fetchApi,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
  });
}

export function createSdkGateway(config: SearchConfig): WeftGateway {
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
          // SDK 0.23.0's generated FetchRequestBody serializer reduces object
          // values to `{}`. A JSON string is the other supported wire shape,
          // and the Weft API forwards it unchanged to the paid provider.
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        },
        { idempotencyKey },
      );
      return {
        status: response.status,
        bodyBase64: response.bodyBase64,
        paidUsd: response.paidUsd,
        heldUsd: response.heldUsd,
        paymentStatus: response.paymentStatus,
        artifactId: response.artifactId,
      };
    },
  };
}
