import type { CuratedOperation } from "./catalog.js";

type InputValue = string | number | boolean | readonly string[] | Record<string, unknown>;
export type OperationInputs = Readonly<Record<string, InputValue | undefined>>;

export interface PaidRequest {
  readonly url: string;
  readonly method: CuratedOperation["request"]["method"];
  readonly headers: Record<string, string> | undefined;
  readonly body: Record<string, unknown> | undefined;
  readonly maxCostUsd: string;
  readonly searchId: string;
  readonly operationId: string;
  readonly accessMethodId: string;
}

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "proxy-authorization", "x-payment"]);

function appendQuery(url: URL, wireName: string, value: InputValue): void {
  if (Array.isArray(value)) {
    for (const item of value) url.searchParams.append(wireName, item);
    return;
  }
  if (typeof value === "object") {
    url.searchParams.append(wireName, JSON.stringify(value));
    return;
  }
  url.searchParams.append(wireName, String(value));
}

function safeHeaders(
  headers: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  for (const name of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.has(name.toLowerCase())) {
      throw new Error(`Catalog recipe contains a forbidden header: ${name}`);
    }
  }
  return { ...headers };
}

export function buildFetchRequest(
  operation: CuratedOperation,
  inputs: OperationInputs,
  maxCostUsd: string,
): PaidRequest {
  let urlText = operation.request.url;
  for (const [wireName, inputName] of Object.entries(operation.request.path ?? {})) {
    const value = inputs[inputName];
    if (value === undefined) continue;
    if (typeof value === "object") {
      throw new Error(`Path input ${inputName} must be a scalar`);
    }
    urlText = urlText.replace(`{${wireName}}`, encodeURIComponent(String(value)));
  }

  const url = new URL(urlText);
  if (url.protocol !== "https:") {
    throw new Error("Provider request URL must use HTTPS");
  }
  for (const [wireName, inputName] of Object.entries(operation.request.query ?? {})) {
    const value = inputs[inputName];
    if (value !== undefined) appendQuery(url, wireName, value);
  }

  const body: Record<string, unknown> = {};
  for (const [wireName, inputName] of Object.entries(operation.request.body?.fields ?? {})) {
    const value = inputs[inputName];
    if (value !== undefined) body[wireName] = value;
  }

  return {
    url: url.toString(),
    method: operation.request.method,
    headers: safeHeaders(operation.request.headers),
    body: Object.keys(body).length > 0 ? body : undefined,
    maxCostUsd,
    searchId: operation.attribution.search_id,
    operationId: operation.attribution.operation_id,
    accessMethodId: operation.attribution.access_method_id,
  };
}
