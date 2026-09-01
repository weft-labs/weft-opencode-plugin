import type { Plugin } from "@opencode-ai/plugin/promise/plugin";

import { readConfig } from "./config.js";
import { createSearchExecutor } from "./runtime.js";
import { createSdkGateway } from "./sdk.js";

const plugin = {
  id: "weft.websearch",
  async setup(context) {
    const config = readConfig(context.options);
    const execute = createSearchExecutor(createSdkGateway(config), config);

    await context.websearch.transform((draft) => {
      draft.add({
        id: "weft",
        name: "Weft",
        execute,
      });
    });
  },
} satisfies Plugin;

export default plugin;
export { extractOperations, selectOperation } from "./catalog.js";
export { readConfig } from "./config.js";
export { normalizeResults } from "./normalize.js";
export { buildFetchRequest } from "./request.js";
export { assertSpendAvailable, createSearchExecutor } from "./runtime.js";
