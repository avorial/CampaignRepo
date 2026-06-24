import { listDirectoryTextFiles } from "@/lib/github";
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
  // One GraphQL tree read instead of one REST request per page.
  const files = await listDirectoryTextFiles(token, campaign, "wiki/pages");
  const pages = files.map((file) => parsePage(file.name.replace(/\.md$/, ""), file.text ?? "", file.sha));

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
