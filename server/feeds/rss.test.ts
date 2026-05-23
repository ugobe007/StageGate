import { describe, it, expect } from "vitest";
import { parseRssXml } from "./rssParser";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Acme Robotics at CES 2027</title>
      <link>https://example.com/acme-ces</link>
      <description>Acme unveils humanoid booth demo</description>
    </item>
    <item>
      <title>Freeman expands AV for trade shows</title>
      <link>https://example.com/freeman</link>
      <description>Exhibit house news</description>
    </item>
  </channel>
</rss>`;

describe("rssParser", () => {
  it("parses RSS item blocks", () => {
    const articles = parseRssXml(SAMPLE_RSS, "https://example.com/feed");
    expect(articles).toHaveLength(2);
    expect(articles[0]?.title).toBe("Acme Robotics at CES 2027");
    expect(articles[0]?.link).toBe("https://example.com/acme-ces");
    expect(articles[0]?.text).toContain("humanoid");
  });
});

describe("rssFeedTargets", () => {
  it("has expanded feed list with stats", async () => {
    const { RSS_FEED_TARGETS, rssFeedStats } = await import("./rssFeedTargets");
    const stats = rssFeedStats();
    expect(RSS_FEED_TARGETS.length).toBeGreaterThanOrEqual(40);
    expect(stats.sharedWithRfr).toBeGreaterThan(20);
    expect(stats.byCategory.show_ecosystem).toBeGreaterThanOrEqual(8);
  });

  it("dedupes URLs", async () => {
    const { RSS_FEED_TARGETS } = await import("./rssFeedTargets");
    const urls = RSS_FEED_TARGETS.map((f) => f.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
