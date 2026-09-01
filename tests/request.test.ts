import { describe, expect, test } from "vitest";

import { buildFetchRequest } from "../src/request.js";
import { operation } from "./fixtures.js";

describe("buildFetchRequest", () => {
  test("maps a query into a GET recipe and keeps exact attribution", () => {
    const selected = operation("you-com", "0.005", {
      request: {
        method: "GET",
        url: "https://api.you.com/v1/search",
        query: { query: "query", count: "count" },
      },
    });

    expect(buildFetchRequest(selected, { query: "agent search", count: 8 }, "0.01")).toEqual({
      url: "https://api.you.com/v1/search?query=agent+search&count=8",
      method: "GET",
      headers: undefined,
      body: undefined,
      maxCostUsd: "0.01",
      searchId: "search-1",
      operationId: "you-search-get",
      accessMethodId: "you-com-access",
    });
  });

  test("maps only present inputs into a JSON body", () => {
    const selected = operation("exa", "0.007", {
      request: {
        method: "POST",
        url: "https://api.exa.ai/search",
        headers: { "Content-Type": "application/json" },
        body: {
          media_type: "application/json",
          fields: { query: "query", numResults: "count", type: "type" },
        },
      },
    });

    expect(buildFetchRequest(selected, { query: "agent search", count: 8 }, "0.01")).toMatchObject({
      body: { query: "agent search", numResults: 8 },
      searchId: "search-1",
      operationId: "exa-search",
      accessMethodId: "exa-access",
    });
  });

  test("refuses provider credential headers from a catalog recipe", () => {
    const selected = operation("exa", "0.007", {
      request: {
        method: "POST",
        url: "https://api.exa.ai/search",
        headers: { Authorization: "provider secret" },
        body: { media_type: "application/json", fields: { query: "query" } },
      },
    });

    expect(() => buildFetchRequest(selected, { query: "agent search" }, "0.01")).toThrow(
      /forbidden header/,
    );
  });
});
