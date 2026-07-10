import type { StorageAdapter } from "@/lib/storage";
import { parsePage, stripGmBlocks } from "@/lib/markdown";
import type { ApprovalStatus, Campaign, Category, SearchDocument, Visibility } from "@/lib/types";

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
export async function listReviewPages(storage: StorageAdapter, _campaign: Campaign): Promise<ReviewItem[]> {
  try {
    const index = await storage.getTextFile("wiki/search/index.json");
    const docs = JSON.parse(index.text) as SearchDocument[];
    const reviews = docs
      .filter((doc) => doc.slug && doc.category !== "media" && !doc.slug.startsWith("media/"))
      .filter((doc) => doc.approvalStatus !== "approved")
      .map((doc) => ({
        slug: doc.slug,
        name: doc.title,
        category: doc.category as Category,
        visibility: doc.visibility,
        approvalStatus: doc.approvalStatus,
        summary: doc.summary,
        excerpt: (doc.playerText || doc.text || "").replace(/\s+/g, " ").trim().slice(0, 260)
      }));
    if (reviews.length || docs.length) return reviews;
  } catch {
    // Fall back to the full page scan when the portable search snapshot is missing or invalid.
  }

  const files = await storage.listDirectoryTextFiles("wiki/pages");
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
