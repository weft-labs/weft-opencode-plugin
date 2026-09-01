# Weft websearch for OpenCode V2

Use Weft as a native OpenCode websearch provider. OpenCode can search through
You.com, Exa, Parallel, or Tavily with one Weft buyer credential. You do not
need a separate key for each search provider.

This plugin removes separate provider-key setup. It does not make search
unlimited. Your Weft balance, wallet policy, per-call ceiling, and provider
capacity still apply.

## Requirements

- OpenCode V2 `0.0.0-next-17444`
- Node.js 24 or later
- A Weft account with a buyer API key and funded balance

## Install

Add the package to the OpenCode project that loads your plugins:

```sh
pnpm add @weft-labs/opencode-websearch
```

Set the Weft buyer key in the environment that starts OpenCode:

```sh
export WEFT_API_KEY="your Weft buyer key"
```

Do not put the key in `opencode.jsonc` or commit it to a file.

Add the plugin and select its provider:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "@weft-labs/opencode-websearch",
      "options": {
        "provider": "auto",
        "maxCostUsd": "0.01"
      }
    }
  ],
  "websearch": {
    "provider": "weft"
  },
  "permissions": [
    {
      "action": "websearch",
      "resource": "*",
      "effect": "allow"
    }
  ]
}
```

Restart OpenCode after you change the environment or plugin configuration.

## Provider modes

`provider` can be one of these values:

| Value | Behavior |
| --- | --- |
| `auto` | Select the lowest indexed price within the configured ceiling. |
| `youcom` | Use only the reviewed You.com search operation. |
| `exa` | Use only the reviewed Exa search operation. |
| `parallel` | Use only the reviewed Parallel search operation. |
| `tavily` | Use only the reviewed Tavily search operation. |

Equal prices use Weft catalog relevance order. Fixed mode does not silently
change provider.

## Configuration

Plugin options take precedence over the equivalent environment variables.

| Plugin option | Environment variable | Default |
| --- | --- | --- |
| `provider` | `WEFT_WEBSEARCH_PROVIDER` | `auto` |
| `maxCostUsd` | `WEFT_WEBSEARCH_MAX_COST_USD` | `0.01` |
| `baseUrl` | `WEFT_BASE_URL` | `https://weft.network` |

`maxCostUsd` is a hard limit for one search. The live provider payment
challenge is authoritative. Weft refuses a request when its price exceeds this
limit or the wallet policy.

## Paid-call safety

For each OpenCode search, the plugin:

1. Reads the current Weft balance and policy.
2. Runs a free Weft catalog search.
3. Selects one reviewed synchronous search operation.
4. Sends one paid Weft fetch with the catalog search, operation, and access
   method attribution.
5. Decodes and converts the provider response to OpenCode results.

The plugin does not retry an uncertain paid request. If cancellation or a
network error races with payment, inspect Weft purchase history before you run
the query again.

## Development

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
```

Tests use local fixtures. They do not make paid calls.

