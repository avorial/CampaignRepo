# Getting started with CampaignRepo

From zero to a living, GitHub-backed campaign wiki in eight steps. The same
guide is available in the app at `/getting-started`.

## 1. Sign in
Run the app and open it. A first-run admin account is seeded as `admin` / `admin`
and you'll be prompted to set a real password. Or create your own account at `/register`.

## 2. Connect GitHub
Each campaign is a GitHub repo, so CampaignRepo needs a token. On the dashboard,
paste a personal access token under **GitHub connection**. Create one at
<https://github.com/settings/tokens> with **read & write access to repository
contents** (a fine-grained token scoped to your campaign repos is ideal).

## 3. Build or connect a campaign repo
Under **Build Campaign Repo**:
- **Create repo** — CampaignRepo creates a new GitHub repo and scaffolds it.
- **Connect repo** — point at an existing repo; missing folders are repaired.

Choose your **game system** (Sword Chronicle, Dungeons & Dragons, World of
Darkness, Traveller, Custom) — its template pack is seeded into the repo.

## 4. Know the repo layout
- `/wiki/pages` — one Markdown file per page
- `/wiki/media` — images, maps, PDFs, audio
- `/wiki/templates/<system>` — your template pack
- `/wiki/search/index.json` — portable search snapshot
- `/wiki/campaign.yaml` — campaign settings

Manual edits on GitHub are fine — keep the frontmatter intact.

## 5. Write pages, link them, hide secrets
- Link pages with `[[Page Name]]` or `[[Page Name|label]]`. Missing links offer a one-click create.
- Wrap GM-only text in a `:::gm` … `:::` block — players never see it.
- Set **visibility** (GM / Players) and **tags** in the sidebar; toggle GM / Player / Handout preview.

## 6. Control what players see
Players only see pages marked **Players** and **Approved**, with `:::gm` content
stripped. AI- and import-created pages land as **unapproved** and wait in the GM
review queue (campaign admin page and the dashboard's cross-repo review).

## 7. Add media, imports, and explore
Upload images and handouts, import characters from Foundry / generic JSON, and
browse the auto-built **Timeline** and **Relationship** graph. Search runs per
repo or across every repo you can access.

## 8. Connect AI over MCP (optional)
Mint an **MCP access token** on the dashboard, then point an external client
(e.g. Claude Desktop) at `/api/mcp` with an `Authorization: Bearer` header. The
AI can search, read, create pages, and propose updates — all landing as
unapproved for your review.
