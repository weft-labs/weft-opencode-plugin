import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import plugin from "../index.js";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const entrypoint = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

describe("package installation contract", () => {
  test("ships a source entrypoint for lifecycle-free OpenCode installs", () => {
    expect(plugin.id).toBe("weft.websearch");
    expect(manifest.exports).toBe("./index.ts");
    expect(manifest.files).toContain("index.ts");
    expect(manifest.files).toContain("src");
    expect(manifest.dependencies["@opencode-ai/plugin"]).toBeUndefined();
    expect(manifest.devDependencies["@opencode-ai/plugin"]).toBe("0.0.0-next-17444");
    expect(manifest.peerDependencies).toBeUndefined();
    expect(entrypoint).toContain('export { default } from "./src/index.js"');
    expect(entrypoint).toContain('export * from "./src/index.js"');
  });

  test("explicitly ignores the optional msgpackr native build", () => {
    expect(workspace).toMatch(/ignoredBuiltDependencies:\s*\n\s*- msgpackr-extract/);
  });
});
