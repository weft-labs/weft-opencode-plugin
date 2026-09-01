import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("@weft-labs/sdk", () => ({
  WeftClient: class {
    fetch = fetchMock;
  },
}));

import { createSdkGateway } from "../src/sdk.js";

describe("SDK gateway", () => {
  beforeEach(() => {
    vi.stubEnv("WEFT_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  test("preserves safe paid-response status and purchase context", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { "content-type": "application/json" },
      bodyBase64: "e30=",
      paidUsd: "0.007",
      heldUsd: null,
      paymentStatus: "settled",
      txHash: "0x123",
      protocol: "x402",
      artifactId: 393,
      merchant: {},
    });
    const gateway = createSdkGateway({ provider: "exa", maxCostUsd: "0.01" });

    const response = await gateway.fetch(
      {
        url: "https://api.exa.ai/search",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { query: "weft" },
        maxCostUsd: "0.01",
        searchId: "search-1",
        operationId: "exa-search",
        accessMethodId: "exa-access",
      },
      { idempotencyKey: "idempotency-1", signal: new AbortController().signal },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '{"query":"weft"}',
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { idempotencyKey: "idempotency-1" },
    );
    expect(response).toEqual({
      status: 200,
      bodyBase64: "e30=",
      paidUsd: "0.007",
      heldUsd: null,
      paymentStatus: "settled",
      artifactId: 393,
    });
  });
});
