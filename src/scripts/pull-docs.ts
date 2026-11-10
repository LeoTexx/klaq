/**
 * pull-docs.ts
 *
 * Fetches every documentation page from https://www.remotion.dev/docs
 * by reading the sitemap.xml, then saves each page's main content as
 * a Markdown file under docs/remotion/.
 *
 * Usage: pnpm pull-docs
 */

import { load, type CheerioAPI } from "cheerio";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { fileURLToPath } from "url";

const __dirname = typeof import.meta.dirname === "string"
  ? import.meta.dirname
  : resolve(fileURLToPath(import.meta.url), "..");

const SITEMAP_URL = "https://www.remotion.dev/sitemap.xml";
// DOCS_OUT lets docs-update.ts pull into a fresh folder and diff it against the current docs.
const OUTPUT_DIR = process.env.DOCS_OUT
  ? resolve(process.env.DOCS_OUT)
  : resolve(__dirname, "../../docs/remotion");
const CONCURRENCY = 5;
const RETRY_LIMIT = 2;
const DELAY_MS = 200; // polite delay between batches

// ── Sitemap parsing ──────────────────────────────────────────────

async function fetchSitemapUrls(): Promise<string[]> {
  console.log("Fetching sitemap…");
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();

  const urls: string[] = [];
  const locRegex = /<loc>(https:\/\/www\.remotion\.dev\/docs\/[^<]*)<\/loc>/g;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

// ── HTML → Markdown conversion ───────────────────────────────────

function htmlToMarkdown($: CheerioAPI, el: ReturnType<CheerioAPI>): string {
  const lines: string[] = [];

  el.contents().each((_, node) => {
    if (node.type === "text") {
      const text = (node as any).data ?? "";
      lines.push(text);
      return;
    }

    if (node.type !== "tag") return;
    const tagEl = $(node);
    const tag = ((node as any).tagName ?? "")?.toLowerCase();

    // Skip nav, footer, edit-this-page links, table-of-contents sidebar
    if (
      tagEl.hasClass("theme-doc-toc-desktop") ||
      tagEl.hasClass("theme-doc-toc-mobile") ||
      tagEl.hasClass("theme-edit-this-page") ||
      tagEl.hasClass("pagination-nav") ||
      tag === "nav" ||
      tag === "footer"
    ) {
      return;
    }

    switch (tag) {
      case "h1":
        lines.push(`\n# ${tagEl.text().trim()}\n`);
        break;
      case "h2":
        lines.push(`\n## ${tagEl.text().trim()}\n`);
        break;
      case "h3":
        lines.push(`\n### ${tagEl.text().trim()}\n`);
        break;
      case "h4":
        lines.push(`\n#### ${tagEl.text().trim()}\n`);
        break;
      case "h5":
        lines.push(`\n##### ${tagEl.text().trim()}\n`);
        break;
      case "h6":
        lines.push(`\n###### ${tagEl.text().trim()}\n`);
        break;
      case "p":
        lines.push(`\n${htmlToMarkdown($, tagEl).trim()}\n`);
        break;
      case "a": {
        const href = tagEl.attr("href") ?? "";
        const text = tagEl.text().trim();
        lines.push(`[${text}](${href})`);
        break;
      }
      case "code": {
        const parent = tagEl.parent();
        if (parent && (parent as any).prop?.("tagName")?.toLowerCase() === "pre") {
          // Code block handled by <pre>
          lines.push(tagEl.text());
        } else {
          lines.push(`\`${tagEl.text()}\``);
        }
        break;
      }
      case "pre": {
        const codeEl = tagEl.find("code");
        const lang = (codeEl.attr("class") ?? "").replace(/.*language-(\S+).*/, "$1") || "";
        const code = codeEl.length ? codeEl.text() : tagEl.text();
        lines.push(`\n\`\`\`${lang}\n${code.trimEnd()}\n\`\`\`\n`);
        break;
      }
      case "ul":
      case "ol": {
        tagEl.children("li").each((i, li) => {
          const bullet = tag === "ol" ? `${i + 1}.` : "-";
          lines.push(`${bullet} ${htmlToMarkdown($, $(li)).trim()}`);
        });
        lines.push("");
        break;
      }
      case "table": {
        const rows: string[][] = [];
        tagEl.find("tr").each((_, tr) => {
          const cells: string[] = [];
          $(tr)
            .find("th, td")
            .each((__, cell) => {
              cells.push($(cell).text().trim());
            });
          rows.push(cells);
        });
        if (rows.length > 0) {
          const header = rows[0];
          lines.push(`\n| ${header.join(" | ")} |`);
          lines.push(`| ${header.map(() => "---").join(" | ")} |`);
          for (const row of rows.slice(1)) {
            lines.push(`| ${row.join(" | ")} |`);
          }
          lines.push("");
        }
        break;
      }
      case "blockquote":
        lines.push(
          `\n> ${htmlToMarkdown($, tagEl).trim().replace(/\n/g, "\n> ")}\n`
        );
        break;
      case "strong":
      case "b":
        lines.push(`**${tagEl.text().trim()}**`);
        break;
      case "em":
      case "i":
        lines.push(`*${tagEl.text().trim()}*`);
        break;
      case "br":
        lines.push("\n");
        break;
      case "img": {
        const alt = tagEl.attr("alt") ?? "";
        const src = tagEl.attr("src") ?? "";
        lines.push(`![${alt}](${src})`);
        break;
      }
      case "hr":
        lines.push("\n---\n");
        break;
      case "details": {
        const summary = tagEl.find("summary").first().text().trim();
        lines.push(`\n<details>\n<summary>${summary}</summary>\n`);
        lines.push(htmlToMarkdown($, tagEl.children().not("summary")).trim());
        lines.push(`\n</details>\n`);
        break;
      }
      default:
        // Recurse into divs, spans, sections, etc.
        lines.push(htmlToMarkdown($, tagEl));
        break;
    }
  });

  return lines.join("");
}

function extractContent(html: string, url: string): { title: string; markdown: string } {
  const $ = load(html);

  // Docusaurus puts main content in <article> or <main>
  let article = $("article").first();
  if (!article.length) article = $("main").first();
  if (!article.length) article = $(".markdown").first();
  if (!article.length) article = $("body");

  const title =
    $("h1").first().text().trim() ||
    $("title").text().trim().replace(/ \|.*$/, "") ||
    url;

  const markdown = htmlToMarkdown($, article);

  // Clean up excessive blank lines
  const cleaned = markdown
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, markdown: `# ${title}\n\n${cleaned}` };
}

// ── URL → file path ──────────────────────────────────────────────

function urlToFilePath(url: string): string {
  let path = url
    .replace("https://www.remotion.dev/docs/", "")
    .replace(/\/$/, "");

  if (!path) path = "index";

  // Replace slashes with directory separators
  return resolve(OUTPUT_DIR, `${path}.md`);
}

// ── Fetch with retry ─────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = RETRY_LIMIT): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries) throw err;
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Batch processing ─────────────────────────────────────────────

const failedUrls: string[] = [];

async function processBatch(urls: string[]): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const html = await fetchWithRetry(url);
      const { markdown } = extractContent(html, url);
      const filePath = urlToFilePath(url);

      // Ensure parent directory exists
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      writeFileSync(filePath, markdown, "utf-8");
      return url;
    })
  );

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok++;
    } else {
      fail++;
      failedUrls.push(urls[i]);
      console.error(`  ✗ ${urls[i]}: ${r.reason}`);
    }
  });

  return { ok, fail };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const urls = await fetchSitemapUrls();
  console.log(`Found ${urls.length} documentation pages.\n`);

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalOk = 0;
  let totalFail = 0;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(urls.length / CONCURRENCY);

    process.stdout.write(
      `\rBatch ${batchNum}/${totalBatches} — ${totalOk} done, ${totalFail} failed`
    );

    const { ok, fail } = await processBatch(batch);
    totalOk += ok;
    totalFail += fail;

    if (i + CONCURRENCY < urls.length) await sleep(DELAY_MS);
  }

  console.log(
    `\n\nDone! ${totalOk} pages saved to ${OUTPUT_DIR}, ${totalFail} failed.`
  );
  // Read by docs-update.ts to decide whether the pull is complete enough to replace the current docs.
  writeFileSync(
    resolve(OUTPUT_DIR, ".pull.json"),
    JSON.stringify({ pulledAt: new Date().toISOString(), ok: totalOk, fail: totalFail, failedUrls }, null, 2)
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
