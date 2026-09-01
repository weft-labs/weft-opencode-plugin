import { describe, expect, test } from "vitest";

import { readApiKey, readConfig } from "../src/config.js";

describe("configuration", () => {
  test("uses safe defaults and accepts fixed provider options", () => {
    expect(readConfig({}, {})).toEqual({ provider: "auto", maxCostUsd: "0.01" });
    expect(readConfig({ provider: "tavily", maxCostUsd: "0.005" }, {})).toEqual({
      provider: "tavily",
      maxCostUsd: "0.005",
    });
  });

  test("rejects invalid provider, money, and remote HTTP configuration", () => {
    expect(() => readConfig({ provider: "random" }, {})).toThrow(/Invalid Weft websearch provider/);
    expect(() => readConfig({ maxCostUsd: "1.2345678" }, {})).toThrow(/Invalid USD amount/);
    expect(() => readConfig({ baseUrl: "http://weft.example" }, {})).toThrow(/must use HTTPS/);
  });

  test("requires one Weft buyer key before a gateway can start network work", () => {
    expect(() => readApiKey({})).toThrow(/WEFT_API_KEY is required/);
    expect(readApiKey({ WEFT_API_KEY: " wk_example " })).toBe("wk_example");
  });
});
