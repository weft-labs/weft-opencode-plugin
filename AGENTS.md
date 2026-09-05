# weft-opencode-plugin

## Purpose

First-party OpenCode V2 websearch provider for Weft. It discovers a current
websearch operation, buys it through Weft, and returns native OpenCode results.

## Stack

- TypeScript, ESM, Node 24
- pnpm 10
- Vitest, Biome, tsup
- `@weftlabs/sdk` buyer client
- OpenCode V2 promise plugin contract

## Commands

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm test
mise exec -- pnpm typecheck
mise exec -- pnpm lint
mise exec -- pnpm build
mise exec -- pnpm check
```

## Constraints

- Use the public OpenCode plugin interface. Do not patch OpenCode core.
- Never accept or forward provider API keys.
- Every paid fetch has a strict `maxCostUsd` and exact Weft attribution.
- Check balance and policy before paid fetch.
- Never retry an uncertain paid fetch.
- Pass OpenCode cancellation to every Weft network call.
- Accept only the reviewed You.com, Exa, Parallel, and Tavily search operation
  IDs. Do not buy a semantic near-match.
- Keep secrets out of source, tests, fixtures, logs, and plugin options.
- Patrick owns the merge and release gates.
