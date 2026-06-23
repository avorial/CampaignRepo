# CampaignRepo Roadmap — toward LegendKeeper & World Anvil

Goal: grow CampaignRepo from "GitHub-backed RPG wiki" into a worldbuilding tool
that feels like **LegendKeeper** (sleek, map-first, fast) and **World Anvil**
(deep, structured, presentation-rich) — while keeping the core promise: *the
campaign repo of Markdown + media stays the source of truth.*

Everything below is designed to live in the repo as files: pages in
`/wiki/pages`, media in `/wiki/media`, and structured data as JSON/YAML sidecars
(e.g. `/wiki/maps/*.json`, `/wiki/timelines/*.yaml`). No per-page database.

Effort key: **S** = days · **M** = ~1 week · **L** = multi-week.

---

## Where we are (shipped)
Pages + frontmatter · `[[wiki-links]]` + backlinks · `:::gm` secrets + GM/player
visibility + approval queue · per-system template packs · media manager (renders
in pages) · timeline (event dates) · relationship graph · FTS search · player
portal · invites/admin · MCP/AI upload.

---

## Tier 1 — Signature features  ✅ ALL SHIPPED
*(Interactive maps, nested hierarchy, expanded types, transclusion, galleries/covers — all live on `main`.)*

### 1. Interactive maps with pins  ·  L  ·  *LegendKeeper's killer feature*
Upload a map image to `/wiki/media`; drop **pins** that link to pages; click a
pin to open the article. Store pins as `/wiki/maps/<slug>.json`
(`{ image, pins: [{x, y, pageSlug, label, icon }] }`). Later: nested maps
(a pin opens another map), layers, and a "Maps" category in the sidebar.
*This is the single biggest differentiator to chase first.*

### 2. Nested hierarchy / folders + breadcrumbs  ·  M
Today pages are flat under 5 categories. Add a `parent` frontmatter field (or
folder paths) to build a **tree** in the sidebar with collapse + breadcrumbs.
Gives World Anvil's category nesting and LK's folder feel without leaving files.

### 3. Expanded article types & template library  ·  M  ·  *World Anvil's breadth*
Go beyond character/npc/location/event/game. Add types: **organization/faction,
species/ancestry, item, spell/ability, religion, language, settlement, vehicle/
ship, condition/lore**. Each is a category + a rich template with the right
frontmatter fields and section scaffold. Mostly data — extends the pack system.

### 4. Transclusion / embeds  ·  S–M
`[[Page#Section]]` to link to a heading, and an include directive
(`![[Page]]` or `:::include Page:::`) to embed one page's content/section inside
another. Huge for reusable lore (a faction blurb shown on many pages).

### 5. Image galleries & cover images  ·  S
A `cover` frontmatter image rendered as an article banner, and a `:::gallery`
block for image grids with lightbox. Makes pages feel like WA/LK articles.

---

## Tier 2 — Depth & presentation

### 6. Timeline 2.0  ·  M  ·  ✅ SHIPPED
Upgrade the current date-sorted list into **eras/ages**, multiple parallel
tracks (political / personal / cosmic), and a visual horizontal timeline.
Driven by `/wiki/timelines/*.yaml` + event frontmatter.

### 7. Family trees / genealogy  ·  M
A relationship type for parent/child/spouse, rendered as a tree (SVG). Reuses
the graph engine but with genealogy layout. World Anvil + LK both have this.

### 8. Published public site / shareable links  ·  M
A read-only public presentation of player-visible, approved pages (per campaign)
at a shareable URL — like World Anvil's public worlds. Builds on the player
portal; add opt-in `public: true` and a clean reader theme.

### 9. Per-campaign theming  ·  S
Let a campaign set accent colors / banner / font via `campaign.yaml`, applied
as CSS variables. World Anvil's custom CSS, but safe and simple.

### 10. Editor upgrades (toward block editing)  ·  M–L
Slash-command menu, drag-to-reorder, table support, inline image paste-upload,
and a cleaner WYSIWYG-ish surface over Markdown. Closes the gap with LK's
block editor without abandoning Markdown-on-disk.

---

## Tier 3 — Ambitious / architectural

### 11. Real-time collaboration  ·  L  ·  *tension with the Git model*
LK is real-time; we're commit-based. Options: presence + soft-locking (show who's
editing, warn on conflict — we already detect SHA conflicts), or a CRDT live
layer that periodically commits. Start with presence/locking (S–M) before true
real-time (L).

### 12. Visibility tiers / subscriber groups  ·  M
Beyond GM vs player: named groups (e.g. "the players who know about the cult")
with per-block reveals. Generalizes `:::gm` into `:::secret group="..."`.

### 13. Manuscripts / notebooks / long-form  ·  M
GM-only notebooks and a "manuscript" mode that stitches pages into chapters for
session prep or fiction — World Anvil's manuscripts.

### 14. Generators via MCP/AI  ·  S–M
Name/NPC/settlement/rumor generators surfaced in-app, powered by the existing
MCP tools (the AI can already create pages). Add quick "Generate NPC" buttons
that call the model and drop an unapproved page.

### 15. Character sheets / statblocks per system  ·  M
System-aware structured sheets (Traveller UPP/UWP already partly there; D&D
statblocks; WoD sheets) rendered from frontmatter, plus Foundry sync hooks.

---

## Suggested order
1. **Interactive maps** (1) — the headline feature.
2. **Nested hierarchy** (2) + **expanded types** (3) — organization that scales.
3. **Transclusion** (4) + **galleries/covers** (5) — article richness.
4. Then Tier 2 presentation (public site, theming, timeline 2.0).
5. Tier 3 as appetite allows.

> Pick any item and I'll turn it into a concrete implementation plan (data shape,
> files, routes, UI) and build it.
