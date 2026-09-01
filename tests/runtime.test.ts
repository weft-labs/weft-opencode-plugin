import { describe, expect, test, vi } from "vitest";

import { assertSpendAvailable, createSearchExecutor } from "../src/runtime.js";
import { operation } from "./fixtures.js";

describe("search runtime", () => {
  test("checks balance, preserves attribution, and performs one paid call", async () => {
    const selected = operation("you-com", "0.005", {
      request: { method: "GET", url: "https://api.you.com/v1/search", query: { query: "query" } },
    });
    const balance = vi.fn().mockResolvedValue({ balanceUsd: "1.00" });
    const search = vi.fn().mockResolvedValue({ results: [selected] });
    const fetch = vi.fn().mockResolvedValue({
      bodyBase64: Buffer.from(
        JSON.stringify({ results: { web: [{ url: "https://result.example", title: "Result" }] } }),
      ).toString("base64"),
    });
    const execute = createSearchExecutor(
      { balance, search, fetch },
      { provider: "auto", maxCostUsd: "0.01" },
    );

    const results = await execute({ query: "weft" }, { signal: new AbortController().signal });

    expect(balance).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        maxCostUsd: "0.01",
        searchId: "search-1",
        operationId: "you-search-get",
        accessMethodId: "you-com-access",
      }),
      expect.objectContaining({
        idempotencyKey: expect.any(String),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(results[0]?.url).toBe("https://result.example");
  });

  test("passes one signal through balance, discovery, and fetch", async () => {
    const signal = new AbortController().signal;
    const selected = operation("you-com", "0.005", {
      request: { method: "GET", url: "https://api.you.com/v1/search", query: { query: "query" } },
    });
    const balance = vi.fn().mockResolvedValue({});
    const search = vi.fn().mockResolvedValue({ results: [selected] });
    const fetch = vi
      .fn()
      .mockResolvedValue({ bodyBase64: Buffer.from('{"results":{"web":[]}}').toString("base64") });
    const execute = createSearchExecutor(
      { balance, search, fetch },
      { provider: "auto", maxCostUsd: "0.01" },
    );

    await execute({ query: "weft" }, { signal });

    expect(balance).toHaveBeenCalledWith({ signal });
    expect(search).toHaveBeenCalledWith(expect.any(Object), { signal });
    expect(fetch).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ signal }));
  });

  test("does not retry an ambiguous paid failure", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("request outcome is uncertain"));
    const execute = createSearchExecutor(
      {
        balance: vi.fn().mockResolvedValue({}),
        search: vi.fn().mockResolvedValue({ results: [operation("you-com", "0.005")] }),
        fetch,
      },
      { provider: "auto", maxCostUsd: "0.01" },
    );

    await expect(
      execute({ query: "weft" }, { signal: new AbortController().signal }),
    ).rejects.toThrow(/uncertain/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("stops before discovery when wallet or policy headroom is too low", async () => {
    expect(() =>
      assertSpendAvailable(
        {
          wallet: { totalUsd: "0.004" },
          promo: { balanceUsd: "0.00" },
          policy: { maxTxUsd: "1.00", dailyLimitUsd: "5.00", weeklyLimitUsd: "10.00" },
          spentTodayUsd: "0.00",
          spentWeekUsd: "0.00",
        },
        "0.005",
      ),
    ).toThrow(/balance is below/);
  });
});
