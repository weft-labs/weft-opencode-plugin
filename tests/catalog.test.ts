import { describe, expect, test } from "vitest";

import { extractOperations, selectOperation } from "../src/catalog.js";
import { operation } from "./fixtures.js";

describe("selectOperation", () => {
  test("selects the cheapest compatible allowed operation in auto mode", () => {
    const selected = selectOperation(
      [operation("parallel", "0.01"), operation("you-com", "0.005"), operation("exa", "0.007")],
      "auto",
      "0.01",
    );

    expect(selected.provider.id).toBe("you-com");
  });

  test("keeps catalog order as the equal-price relevance tie-breaker", () => {
    const selected = selectOperation(
      [operation("tavily", "0.01"), operation("parallel", "0.01")],
      "auto",
      "0.01",
    );

    expect(selected.provider.id).toBe("tavily");
  });

  test("never changes a fixed provider", () => {
    const selected = selectOperation(
      [operation("you-com", "0.005"), operation("tavily", "0.01")],
      "tavily",
      "0.01",
    );

    expect(selected.provider.id).toBe("tavily");
  });

  test("rejects operations above the caller ceiling", () => {
    expect(() => selectOperation([operation("tavily", "0.01")], "auto", "0.005")).toThrow(
      /No compatible websearch operation/,
    );
  });
});

describe("extractOperations", () => {
  test("accepts only the exact complete terminal search operation", () => {
    const results = extractOperations({
      queryTraceId: "trace-1",
      results: [
        {
          provider: { providerId: "you-com", displayName: "You.com" },
          score: 0.9,
          endpoints: [
            {
              url: "https://api.you.com/v1/search",
              call: {
                method: "GET",
                inputSchema: {
                  properties: { query: { type: "string" }, count: { type: "integer" } },
                },
              },
              price: { indexedUsd: "0.005" },
              accessMethods: [
                {
                  accessMethodId: "you-search-x402-base",
                  protocol: "x402",
                  price: { kind: "fixed", indexed_usd: "0.005" },
                  weftFetch: { state: "supported" },
                },
              ],
              operation: { id: "you-search-get", name: "Search the web" },
              execution: { mode: "sync" },
              callability: { state: "complete" },
              compatibility: { weft_fetch: { coverage: "terminal_response" } },
            },
            {
              url: "https://api.you.com/v1/contents",
              call: { method: "POST", inputSchema: { properties: {} } },
              price: { indexedUsd: "0.001" },
              accessMethods: [
                { accessMethodId: "wrong", protocol: "x402", weftFetch: { state: "supported" } },
              ],
              operation: { id: "you-contents", name: "Not search" },
              execution: { mode: "sync" },
              callability: { state: "complete" },
              compatibility: { weft_fetch: { coverage: "terminal_response" } },
            },
          ],
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: { id: "you-com", name: "You.com" },
      operation: { id: "you-search-get" },
      request: { method: "GET", query: { query: "query", count: "count" } },
      attribution: {
        search_id: "trace-1",
        operation_id: "you-search-get",
        access_method_id: "you-search-x402-base",
      },
    });
  });
});
