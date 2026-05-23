/** Lightweight RSS/Atom parser — no external XML dependency */

export type RssArticle = {
  title: string;
  description: string;
  link: string;
  text: string;
  source: string;
};

function stripTags(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[1] ?? "");
  }
  return blocks;
}

function field(block: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = block.match(re);
  if (m?.[1]) return stripTags(m[1]);
  const atomLink = block.match(new RegExp(`<link[^>]*href=["']([^"']+)["']`, "i"));
  if (name === "link" && atomLink?.[1]) return atomLink[1];
  return "";
}

export function parseRssXml(xml: string, sourceUrl: string): RssArticle[] {
  const articles: RssArticle[] = [];
  const blocks = extractBlocks(xml, "item").length > 0
    ? extractBlocks(xml, "item")
    : extractBlocks(xml, "entry");

  for (const block of blocks) {
    const title = field(block, "title");
    const description =
      field(block, "description") ||
      field(block, "summary") ||
      field(block, "content");
    const link = field(block, "link") || sourceUrl;
    if (!title) continue;
    articles.push({
      title,
      description,
      link,
      text: `${title}. ${description}`.slice(0, 2000),
      source: sourceUrl,
    });
  }
  return articles;
}

export async function fetchRssFeed(feedUrl: string, timeoutMs = 20_000): Promise<RssArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "StageGate-Intel/1.0 (+https://onstage.bot)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, feedUrl);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
