import DOMPurify from "isomorphic-dompurify";
import { mediaSrc, renderMarkdown, stripGmBlocks, type IncludeResolver, type MediaPathResolver, type RenderMode, type WikiLinkResolver } from "@/lib/markdown";
import type { WikiPageFrontmatter } from "@/lib/types";

type ArticleMetadata = Pick<WikiPageFrontmatter, "name" | "summary" | "category" | "cover" | "coverDisplay">;
const attributes = ["data-label", "data-missing", "data-target", "data-roll", "data-mod", "style", "target"];

export function prepareArticleHtml(html: string, metadata: ArticleMetadata, resolveMedia?: MediaPathResolver) {
  const body = DOMPurify.sanitize(html, { RETURN_DOM: true, ADD_ATTR: attributes }) as HTMLElement;
  const document = body.ownerDocument;
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  for (const heading of Array.from(body.querySelectorAll("h1"))) {
    if (heading.closest('[class*="sheet"]')) continue;
    if (normalize(heading.textContent || "") === normalize(metadata.name || "")) heading.remove();
    else {
      const sectionHeading = document.createElement("h2");
      for (const attribute of Array.from(heading.attributes)) sectionHeading.setAttribute(attribute.name, attribute.value);
      sectionHeading.innerHTML = heading.innerHTML;
      heading.replaceWith(sectionHeading);
    }
  }

  const source = metadata.cover && !/\bREPLACE\.[a-z]+$/i.test(metadata.cover)
    ? mediaSrc(metadata.cover, resolveMedia) : "";
  const matchingImages = source
    ? Array.from(body.querySelectorAll("img")).filter((image) => image.getAttribute("src") === source)
    : [];
  const sidebarImage = matchingImages.find((image) => image.closest(".wiki-infobox"));
  if (sidebarImage) {
    for (const image of matchingImages) {
      if (image === sidebarImage || image.closest(".gallery")) continue;
      const wrapper = image.closest("p, figure");
      if (wrapper && wrapper.querySelectorAll("img").length === 1 &&
        (!wrapper.textContent?.trim() || normalize(wrapper.textContent || "") === normalize(metadata.name || ""))) wrapper.remove();
    }
  }

  for (const image of Array.from(body.querySelectorAll("img"))) {
    if (!image.closest("a")) {
      image.setAttribute("tabindex", "0");
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Enlarge ${image.getAttribute("alt") || "image"}`);
    }
  }

  if (source && !matchingImages.length && metadata.coverDisplay !== "none") {
    const figure = document.createElement("figure");
    figure.className = metadata.coverDisplay === "banner" ? "article-banner" : "article-portrait";
    const link = document.createElement("a");
    link.className = "image-fullsize-link";
    link.setAttribute("href", source);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noreferrer");
    const image = document.createElement("img");
    image.setAttribute("src", source);
    image.setAttribute("alt", metadata.name);
    link.append(image);
    figure.append(link);
    if (metadata.coverDisplay === "banner") body.prepend(figure);
    else {
      let sidebar = body.querySelector(".wiki-infobox");
      if (sidebar) sidebar.prepend(figure);
      else {
        let layout = body.querySelector(".wiki-layout");
        if (!layout) {
          layout = document.createElement("div");
          layout.className = "wiki-layout";
          const main = document.createElement("div");
          main.className = "wiki-main";
          while (body.firstChild) main.append(body.firstChild);
          layout.append(main);
          body.append(layout);
        }
        sidebar = document.createElement("aside");
        sidebar.className = "wiki-infobox";
        sidebar.append(figure);
        layout.append(sidebar);
      }
    }
  }

  const header = document.createElement("header");
  header.className = "article-header";
  const category = document.createElement("p");
  category.className = "article-category";
  category.textContent = metadata.category;
  const title = document.createElement("h1");
  title.textContent = metadata.name;
  header.append(category, title);
  if (metadata.summary) {
    const summary = document.createElement("p");
    summary.className = "article-summary";
    summary.textContent = metadata.summary;
    header.append(summary);
  }
  body.prepend(header);
  const article = document.createElement("div");
  article.className = "article-content";
  while (body.firstChild) article.append(body.firstChild);
  return DOMPurify.sanitize(article.outerHTML, { ADD_ATTR: attributes });
}

export function renderArticle(
  content: string,
  metadata: ArticleMetadata,
  mode: RenderMode,
  resolve?: WikiLinkResolver,
  resolveMedia?: MediaPathResolver,
  resolveInclude?: IncludeResolver,
  visibleGroups?: Set<string>
) {
  const safeMetadata = mode === "gm" ? metadata : { ...metadata, summary: stripGmBlocks(metadata.summary || "", visibleGroups) };
  return prepareArticleHtml(renderMarkdown(content, mode, resolve, resolveMedia, resolveInclude, visibleGroups), safeMetadata, resolveMedia);
}
