import { describe, expect, test, vi } from "vitest";

import plugin from "../src/index.js";

describe("OpenCode plugin", () => {
  test("registers one native Weft websearch provider", async () => {
    const add = vi.fn();
    const transform = vi.fn(async (callback: (draft: { add: typeof add }) => void) => {
      callback({ add });
    });

    await plugin.setup({ options: {}, websearch: { transform } } as never);

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith({
      id: "weft",
      name: "Weft",
      execute: expect.any(Function),
    });
  });
});
