# CampaignRepo

CampaignRepo is a GitHub-backed RPG campaign wiki. One app manages many campaigns, and each campaign maps to one GitHub repo containing Markdown pages, media, templates, imports, search snapshots, and campaign configuration.

## Current MVP

- Username/password app accounts.
- Seeded `admin` account with forced first-login password change.
- Global admin panel for user review, password resets, account disabling, and global admin assignment.
- Private dashboard for creating or connecting campaign repos.
- GitHub App installation connection for existing repo read/write access.
- Manual GitHub token fallback for local testing and repo creation.
- Game template packs for Sword Chronicle, Dungeons & Dragons, World of Darkness, Traveller, and Custom.
- Wiki categories for Characters, NPCs, Locations, Events, and Games.
- Markdown pages with `[[Page]]` links, `[[Page|Label]]` aliases, key links, backlinks, tags, visibility, and approval status.
- GM-only Markdown blocks with `:::gm`.
- Editor insert controls for wiki links, alias links, media snippets, and GM-only blocks.
- GitHub save conflict detection with a reload-latest path when files changed outside CampaignRepo.
- Dedicated player portal showing only approved, player-visible pages with GM blocks stripped.
- Campaign invite links for players and GMs.
- Foundry Actor JSON and generic JSON character import with optional field mapping.
- Import source JSON diffing for re-import review.
- Media upload, rename, delete, captions, alt text, tags, and repo-persisted `/wiki/media/media.json`.
- SQLite full-text search plus portable repo snapshots at `/wiki/search/index.json`.
- Manual per-campaign search rebuild.
- Safe Markdown rendering (sanitized) with real `[[wiki-links]]` and GM create-page prompts for missing targets.
- Relationship lists plus a visual relationship map.
- Timeline view for Event pages.
- Repo setup instructions plus visible repo validation and repair.
- MCP-style JSON-RPC endpoint at `/api/mcp` for AI search, reads, page creation, unapproved updates, templates, media, graph, review queue, and setup instructions.
- External MCP clients authenticate with a personal access token (`Authorization: Bearer`), minted from the dashboard; the in-app session also works.
- Dashboard review queue aggregating unapproved AI/import changes across every campaign you manage.

## Project Goals

CampaignRepo's goal is to become a practical, RPG-first, GitHub-backed campaign wiki rather than a general-purpose wiki clone. The current MVP is usable for early testing, but these are the remaining product goals in priority order.

### 1. GitHub Connection

- Expand the GitHub App flow with richer installation status and repo picker UX.
- Keep manual token support only as a local/dev fallback and for GitHub repo creation.
- Improve GitHub API error handling for repo access, rate limits, and missing permissions.

### 2. Editing Experience

- Upgrade the Markdown textarea into a true rich Markdown editor while preserving frontmatter, `[[wiki-links]]`, media links, and `:::gm` blocks.
- Add insert controls for templates and frontmatter snippets.
- Improve keyboard shortcuts, split-view ergonomics, and source/preview scrolling.

### 3. Character Import

- Improve Foundry Actor import rendering for stats, items, biography, images, and system-specific fields.
- Extend re-import from source diffing into an update workflow that can refresh Markdown and preserved source JSON safely.

### 4. Player Experience

- Expand the player portal with a richer handout library, player-safe timeline, and session-facing navigation.
- Keep the current rule firm: players only see approved, player-visible content with GM blocks stripped.

### 5. MCP And AI Workflow

- Harden `/api/mcp` into a more complete MCP-compatible surface with stronger tool schemas, better resource reads, and prompt templates.
- Add MCP prompts for NPCs, locations, factions, session summaries, rumors/news, handouts, and Traveller world metadata.
- Keep AI-created or AI-edited content routed through the unapproved review queue.

### 6. Admin And Permissions

- Add owner transfer and safer owner demotion/removal flows.
- Add invite expiration, invite email delivery, and invitation audit history.

### 7. Media Manager

- Add image/PDF/audio previews.
- Include media metadata in SQLite and portable search snapshots.
- Add media metadata editing after upload.

### 8. Search, Graph, And Timeline

- Improve search ranking, highlighting, filters, and reindex controls.
- Add editable relationship labels/types.
- Expand timeline controls beyond event-page sorting.

### 9. Repo Operations

- Add branch/workflow controls for testing, staging, and publishing.
- Add broader conflict workflows, including side-by-side merge for page saves and media metadata.

### 10. Deployment And Operations

- Document production environment variables, HTTPS/session-cookie settings, and backup/restore for SQLite.
- Add deployment examples beyond Docker Compose.
- Add broader integration tests for repo initialization, player secrecy, MCP writes, imports, and review flows.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

The local database seeds a first admin account:

- Username: `admin`
- Password: `admin`

CampaignRepo forces this password to be changed on first login before the dashboard or APIs can be used.

## Docker

Pull the repo and run it in a container (data persists in a named volume):

```bash
docker compose up -d --build
```

Open `http://127.0.0.1:3000`. The SQLite database (accounts, sessions, search
index) is stored in the `campaignrepo-data` volume at `/app/data`.

- Serving behind HTTPS? Set `SECURE_COOKIES=true` (in `docker-compose.yml` or the
  environment) so session cookies get the `Secure` flag.
- Without compose: `docker build -t campaignrepo . && docker run -p 3000:3000 -v campaignrepo-data:/app/data campaignrepo`.

## GitHub App Setup

For normal testing, use a GitHub App instead of storing a personal SSH key.

Create a GitHub App at `https://github.com/settings/apps/new`:

- Homepage URL: your CampaignRepo URL.
- Callback URL: `https://YOUR-CAMPAIGNREPO-HOST/api/github/app/callback`.
- Setup URL: `https://YOUR-CAMPAIGNREPO-HOST/api/github/app/callback`.
- Request repository permissions:
  - Contents: read/write.
  - Metadata: read-only.
- Enable installation on the campaign repos you want CampaignRepo to manage.

Set these environment variables in Docker/Portainer:

```bash
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-github-app-slug
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

After restarting CampaignRepo, open the dashboard and use **Install or update GitHub App access**. GitHub App access can connect and repair existing repos. To create brand-new repos from inside CampaignRepo, connect a manual GitHub token fallback.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## GitHub Repo Structure Created For Campaigns

```text
/wiki
  /pages
  /media
    media.json
  /templates/<game-type>
  /imports/characters
  /search/index.json
  campaign.yaml
README.md
```

Manual edits are allowed if YAML frontmatter and CampaignRepo conventions are preserved.
