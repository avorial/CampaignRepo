import { getTextFile, listDirectory } from "@/lib/github";
import { parsePage, stripGmBlocks } from "@/lib/markdown";
import type { ApprovalStatus, Campaign, Category, Visibility } from "@/lib/types";

export interface ReviewItem {
  slug: string;
  sha?: string;
  name: string;
  category: Category;
  visibility: Visibility;
  approvalStatus: ApprovalStatus;
  summary: string;
  lastEditedBy?: string;
  sourceImport?: string;
  excerpt: string;
}

/** List the unapproved/rejected pages in a campaign repo for GM review. */
export async function listReviewPages(token: string, campaign: Campaign): Promise<ReviewItem[]> {
  const entries = await listDirectory(token, campaign, "wiki/pages");
  const pages = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const file = await getTextFile(token, campaign, entry.path);
        return parsePage(slug, file.text, file.sha);
      })
  );

  return pages
    .filter((page) => page.frontmatter.approvalStatus !== "approved")
    .map((page) => ({
      slug: page.slug,
      sha: page.sha,
      name: page.frontmatter.name,
      category: page.frontmatter.category,
      visibility: page.frontmatter.visibility,
      approvalStatus: page.frontmatter.approvalStatus,
      summary: page.frontmatter.summary,
      lastEditedBy: page.frontmatter.lastEditedBy,
      sourceImport: page.frontmatter.sourceImport,
      excerpt: stripGmBlocks(page.content).replace(/\s+/g, " ").trim().slice(0, 260)
    }));
}
