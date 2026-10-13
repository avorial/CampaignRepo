import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import { stripGmBlocks } from "@/lib/markdown";
import type { WikiPage } from "@/lib/types";

const privateLabels = /^(private pressure|true age|actual age|secret agenda|hidden agenda|hidden truth|gm notes|gm ideas|gm only|scene use|campaign use|sourcebook profile)$/i;

export function playerSecretRisks(page: WikiPage): string[] {
  if (page.frontmatter.visibility !== "players") return [];
  const visibleContent = stripGmBlocks(page.content);
  const body = DOMPurify.sanitize(marked.parse(visibleContent, { async: false }) as string, { RETURN_DOM: true }) as HTMLElement;
  const labels = Array.from(body.querySelectorAll("th,h1,h2,h3,h4"))
    .map((node) => (node.textContent || "").trim()).filter((label) => privateLabels.test(label));
  if (/:::gm|:::secret/i.test(page.frontmatter.summary)) labels.push("GM markup in summary");
  return [...new Set(labels)];
}
