import type { ProviderId } from "./catalog.js";

export interface WebSearchResult {
  readonly url: string;
  readonly title?: string;
  readonly content?: string;
  readonly time: { readonly published?: number };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter((item): item is string => Boolean(item))
    : [];
}

function published(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const date = text(value);
  if (!date) return undefined;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function validUrl(value: unknown): string | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function content(...parts: Array<string | undefined>): string | undefined {
  const values = parts.filter((part): part is string => Boolean(part));
  return values.length > 0 ? [...new Set(values)].join("\n") : undefined;
}

function result(
  value: unknown,
  contentValue: string | undefined,
  publishedValue: unknown,
): WebSearchResult | undefined {
  const item = record(value);
  const url = validUrl(item?.url);
  if (!item || !url) return undefined;

  const title = text(item.title);
  const publishedAt = published(publishedValue);
  return {
    url,
    ...(title ? { title } : {}),
    ...(contentValue ? { content: contentValue } : {}),
    time: publishedAt === undefined ? {} : { published: publishedAt },
  };
}

function normalizeYou(payload: Record<string, unknown>): WebSearchResult[] {
  const groups = record(payload.results);
  const web = Array.isArray(groups?.web) ? groups.web : [];
  const news = Array.isArray(groups?.news) ? groups.news : [];
  return [...web, ...news]
    .map((value) => {
      const item = record(value);
      return result(
        value,
        content(text(item?.description), content(...texts(item?.snippets))),
        item?.published_at ?? item?.publishedAt ?? item?.age,
      );
    })
    .filter((item): item is WebSearchResult => Boolean(item));
}

function normalizeExa(payload: Record<string, unknown>): WebSearchResult[] {
  const values = Array.isArray(payload.results) ? payload.results : [];
  return values
    .map((value) => {
      const item = record(value);
      return result(
        value,
        content(text(item?.text), text(item?.summary), content(...texts(item?.highlights))),
        item?.publishedDate ?? item?.published_date,
      );
    })
    .filter((item): item is WebSearchResult => Boolean(item));
}

function normalizeParallel(payload: Record<string, unknown>): WebSearchResult[] {
  const values = Array.isArray(payload.results) ? payload.results : [];
  return values
    .map((value) => {
      const item = record(value);
      return result(
        value,
        content(text(item?.content), text(item?.description), content(...texts(item?.excerpts))),
        item?.publish_date ?? item?.published_date ?? item?.publishedAt,
      );
    })
    .filter((item): item is WebSearchResult => Boolean(item));
}

function normalizeTavily(payload: Record<string, unknown>): WebSearchResult[] {
  const values = Array.isArray(payload.results) ? payload.results : [];
  return values
    .map((value) => {
      const item = record(value);
      return result(
        value,
        content(text(item?.content), text(item?.raw_content)),
        item?.published_date ?? item?.publishedAt,
      );
    })
    .filter((item): item is WebSearchResult => Boolean(item));
}

export function normalizeResults(
  provider: ProviderId | string,
  payloadValue: unknown,
): WebSearchResult[] {
  const payload = record(payloadValue);
  if (!payload) throw new Error("Websearch provider returned a non-object JSON response");

  const normalizers: Partial<
    Record<ProviderId, (value: Record<string, unknown>) => WebSearchResult[]>
  > = {
    "you-com": normalizeYou,
    exa: normalizeExa,
    parallel: normalizeParallel,
    tavily: normalizeTavily,
  };
  const normalizer = normalizers[provider as ProviderId];
  if (!normalizer) throw new Error(`Unsupported provider response: ${provider}`);
  return normalizer(payload);
}
