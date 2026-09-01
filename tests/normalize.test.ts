import { describe, expect, test } from "vitest";

import { normalizeResults } from "../src/normalize.js";

describe("normalizeResults", () => {
  test("normalizes You.com web and news results", () => {
    const result = normalizeResults("you-com", {
      results: {
        web: [{ url: "https://a.example", title: "A", description: "Alpha", snippets: ["One"] }],
        news: [{ url: "https://b.example", title: "B", description: "Beta", age: "2026-08-31" }],
      },
    });

    expect(result).toEqual([
      { url: "https://a.example", title: "A", content: "Alpha\nOne", time: {} },
      {
        url: "https://b.example",
        title: "B",
        content: "Beta",
        time: { published: Date.parse("2026-08-31") },
      },
    ]);
  });

  test("normalizes Exa results", () => {
    const result = normalizeResults("exa", {
      results: [
        {
          url: "https://exa.example",
          title: "Exa",
          text: "Full text",
          publishedDate: "2026-08-30T10:00:00Z",
        },
      ],
    });

    expect(result[0]).toMatchObject({
      url: "https://exa.example",
      title: "Exa",
      content: "Full text",
      time: { published: Date.parse("2026-08-30T10:00:00Z") },
    });
  });

  test("normalizes Parallel results", () => {
    const result = normalizeResults("parallel", {
      results: [
        {
          url: "https://parallel.example",
          title: "Parallel",
          excerpts: ["First", "Second"],
          publish_date: "2026-08-29",
        },
      ],
    });

    expect(result[0]).toEqual({
      url: "https://parallel.example",
      title: "Parallel",
      content: "First\nSecond",
      time: { published: Date.parse("2026-08-29") },
    });
  });

  test("normalizes Tavily results", () => {
    const result = normalizeResults("tavily", {
      results: [
        {
          url: "https://tavily.example",
          title: "Tavily",
          content: "Summary",
          published_date: "2026-08-28",
        },
      ],
    });

    expect(result[0]).toEqual({
      url: "https://tavily.example",
      title: "Tavily",
      content: "Summary",
      time: { published: Date.parse("2026-08-28") },
    });
  });

  test("drops malformed entries and refuses an unknown provider", () => {
    expect(normalizeResults("exa", { results: [{ title: "missing URL" }] })).toEqual([]);
    expect(() => normalizeResults("unknown", {})).toThrow(/Unsupported provider/);
  });
});
