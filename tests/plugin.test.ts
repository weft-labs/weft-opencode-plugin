import { describe, expect, test, vi } from "vitest";

import plugin from "../src/index.js";

function pluginContext(options: Record<string, unknown> = {}) {
  const add = vi.fn();
  const setDefault = vi.fn();
  const websearchTransform = vi.fn(
    async (callback: (draft: { add: typeof add; default: { set: typeof setDefault } }) => void) => {
      callback({ add, default: { set: setDefault } });
    },
  );
  const integrationUpdate = vi.fn(
    (id: string, callback: (integration: { id: string; name: string }) => void) => {
      const integration = { id, name: id };
      callback(integration);
      return integration;
    },
  );
  const methodUpdate = vi.fn();
  const integrationTransform = vi.fn(
    async (
      callback: (draft: {
        update: typeof integrationUpdate;
        method: { update: typeof methodUpdate };
      }) => void,
    ) => {
      callback({ update: integrationUpdate, method: { update: methodUpdate } });
    },
  );

  return {
    add,
    integrationTransform,
    integrationUpdate,
    methodUpdate,
    setDefault,
    value: {
      options,
      integration: { transform: integrationTransform },
      websearch: { transform: websearchTransform },
    },
  };
}

describe("OpenCode plugin", () => {
  test("registers the Weft integration and native websearch provider", async () => {
    const context = pluginContext();

    await plugin.setup(context.value as never);

    expect(context.integrationTransform).toHaveBeenCalledOnce();
    expect(context.integrationUpdate).toHaveBeenCalledWith("weft", expect.any(Function));
    expect(context.methodUpdate).toHaveBeenCalledWith({
      integrationID: "weft",
      method: { type: "env", names: ["WEFT_API_KEY"] },
    });
    expect(context.add).toHaveBeenCalledTimes(1);
    expect(context.add).toHaveBeenCalledWith({
      id: "weft",
      name: "Weft",
      execute: expect.any(Function),
    });
    expect(context.setDefault).toHaveBeenCalledOnce();
    expect(context.setDefault).toHaveBeenCalledWith("weft");
  });

  test("can register without replacing the selected websearch provider", async () => {
    const context = pluginContext({ default: false });

    await plugin.setup(context.value as never);

    expect(context.add).toHaveBeenCalledOnce();
    expect(context.setDefault).not.toHaveBeenCalled();
  });
});
