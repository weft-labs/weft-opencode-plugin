# Weft websearch for OpenCode V2

Use Weft as a native OpenCode websearch provider. OpenCode can search through
You.com, Exa, Parallel, or Tavily with one Weft buyer credential. You do not
need a separate key for each search provider.

This plugin removes separate provider-key setup. It does not make search
unlimited. Your Weft balance, wallet policy, per-call ceiling, and provider
capacity still apply.

## Compatibility

- OpenCode V2 beta `0.0.0-beta-18743`
- Node.js 24 or later
- A Weft account with a buyer API key and funded balance

OpenCode V2 and its plugin API are beta software. This release pins the
OpenCode plugin package to the same beta build as the supported runtime. Test a
new OpenCode beta before you upgrade it.

The OpenCode V2 beta and the current 1.x `dev` plugin contract are different.
This package requires the public `websearch` domain on the plugin context. It
does not support an OpenCode build whose plugin context does not expose that
domain.

## Install

Install the package with OpenCode:

```sh
opencode2 plugin add @weft-labs/opencode-websearch
```

Set the Weft buyer key in the environment that starts OpenCode:

```sh
export WEFT_API_KEY="your Weft buyer key"
```

Do not put the key in `opencode.jsonc` or commit it to a file.

Add the plugin:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "@weft-labs/opencode-websearch",
      "options": {
        "provider": "auto",
        "maxCostUsd": "0.01",
        "default": true
      }
    }
  ],
  "permissions": [
    {
      "action": "websearch",
      "resource": "*",
      "effect": "allow"
    }
  ]
}
```

The plugin registers Weft as an OpenCode integration and declares
`WEFT_API_KEY` as its environment-based connection method. It also registers
Weft as the native websearch provider. With `"default": true`, the plugin
selects Weft as the default provider. Set this option to `false` when you want
to select a different provider in OpenCode.

OpenCode watches its configuration file. Restart the OpenCode service after
you change an environment variable.

See the official OpenCode V2 guides for
[installing plugins](https://opencode.ai/v2/docs/plugins) and
[building plugins](https://opencode.ai/v2/docs/build/plugins).

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
| `default` | None | `true` |

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

A provider HTTP error, invalid response, or response with no usable OpenCode
results is reported as an error. The message includes safe payment state and
artifact context. Inspect Weft purchase history before you retry it.

## Development

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
```

Tests use local fixtures. They do not make paid calls.

Before a release, also install the packed package in the supported OpenCode V2
beta and run one controlled search. The plugin API can change between beta
builds.
