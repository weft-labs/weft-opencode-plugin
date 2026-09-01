import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import plugin from "../index.js";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const entrypoint = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const pluginSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const biomeConfig = JSON.parse(readFileSync(new URL("../biome.json", import.meta.url), "utf8"));

describe("package installation contract", () => {
  test("ships a source entrypoint for lifecycle-free OpenCode installs", () => {
    expect(plugin.id).toBe("weft.websearch");
    expect(manifest.exports).toBe("./index.ts");
    expect(manifest.files).toContain("index.ts");
    expect(manifest.files).toContain("src");
    expect(manifest.dependencies["@opencode-ai/plugin"]).toBe("0.0.0-beta-18743");
    expect(manifest.devDependencies["@opencode-ai/plugin"]).toBeUndefined();
    expect(manifest.peerDependencies).toBeUndefined();
    expect(entrypoint).toContain('export { default } from "./src/index.js"');
    expect(entrypoint).toContain('export * from "./src/index.js"');
    expect(pluginSource).toContain('import { Plugin } from "@opencode-ai/plugin"');
    expect(pluginSource).toContain("Plugin.define({");
  });

  test("explicitly ignores the optional msgpackr native build", () => {
    expect(workspace).toMatch(/ignoredBuiltDependencies:\s*\n\s*- msgpackr-extract/);
  });

  test("limits the fresh-release exception to the pinned OpenCode beta", () => {
    expect(workspace).toContain('"@opencode-ai/ai@0.0.0-beta-18743"');
    expect(workspace).toContain('"@opencode-ai/client@0.0.0-beta-18743"');
    expect(workspace).toContain('"@opencode-ai/plugin@0.0.0-beta-18743"');
    expect(workspace).toContain('"@opencode-ai/protocol@0.0.0-beta-18743"');
    expect(workspace).toContain('"@opencode-ai/schema@0.0.0-beta-18743"');
  });

  test("keeps the Biome configuration schema aligned with the CLI", () => {
    const version = manifest.devDependencies["@biomejs/biome"];

    expect(biomeConfig.$schema).toBe(`https://biomejs.dev/schemas/${version}/schema.json`);
  });
});
