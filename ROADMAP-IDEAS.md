# CampaignRepo — Horizon Roadmap

New feature directions that are **not** on the current [ROADMAP.md](ROADMAP.md)
and have not been part of any release wave so far.

**Positioning rule:** most tables run their sessions in **Foundry VTT**.
CampaignRepo should never compete with the VTT on live play — no initiative
trackers, dice rollers, battle maps, or fog of war. CampaignRepo is the **world
layer**: canon, memory, players, prep, and everything between sessions. The
VTT runs the fight; the repo remembers what it meant.

And the standing non-negotiable: every feature stores its state in the
campaign repo — portable Markdown, YAML, JSON, and media.

Effort key: **S** = days, **M** = about a week, **L** = multi-week.

---

## 1. The Foundry Bridge (deepen, don't duplicate)

Backlog item C on the main roadmap covers module push/pull mechanics. These go
further: making CampaignRepo and Foundry feel like one product.

### 1.1 Wiki-in-Foundry Module - L

A Foundry module that surfaces the campaign wiki *inside* the VTT: a sidebar
panel showing player-safe pages, searchable, with GM-only content visible to
the GM. Players click an NPC token and read its public wiki page without
leaving the scene. The single highest-leverage feature for a Foundry-first
table.

### 1.2 Post-Session Harvest - M

After a Foundry session, pull the session's chat log, journal changes, and
combat outcomes into a draft session report: who fought what, what was rolled
on milestones, which handouts were shown. GM trims it into the record. Turns
the VTT's exhaust into campaign memory automatically.

### 1.3 Two-Way Journal Sync - L

Foundry journals ↔ wiki pages with source IDs and hashes (the character
re-import diffing already proves the pattern). Edit lore in either place;
review conflicts in the review queue. Ends the copy-paste tax between prep
tool and table tool.

### 1.4 Scene & Map Handoff - M

Push a CampaignRepo map (image + pins) to Foundry as a scene with notes, and
pull a Foundry scene image back as a wiki map. Pins become scene notes and
vice versa. Prep the world in the repo, play it in the VTT.

---

## 2. Between Sessions (the campaign loop)

The VTT owns the four hours of play; CampaignRepo owns the other six days.

### 2.1 Session Recap Generator & "Previously On..." - S-M

Draft a player-safe recap from the session report (or the 1.2 harvest) and
page changes since last session; GM edits, then it posts to the portal. Read
it aloud at the top of the next Foundry session.

### 2.2 Session Scheduling & Attendance - M

Availability polls, a confirmed next-session banner on the portal and campaign
home page, iCal feeds, and attendance history on the session record. The
most-requested quality-of-life feature of any real table, and entirely outside
the VTT's scope.

### 2.3 Downtime & Between-Session Actions - M

Players submit downtime actions (carousing, crafting, faction work, healing)
from the portal into the review queue; approved actions post to the timeline
and can advance clocks. Play continues between Foundry sessions without the
GM running it all by group chat.

### 2.4 Faction Turns & World Clocks - M

First-class progress clocks and faction agendas (`wiki/factions.yaml`): each
faction gets goals with tick conditions; a "world turn" button advances chosen
clocks and drafts consequence events onto the timeline. The living-world
engine the VTT has no concept of.

### 2.5 Player Journals & Private Notes - S-M

Per-player journal space in the portal (visible to that player + GM), stored
under `wiki/journals/<player>/`. Plus GM "whisper handouts" — reveal a page or
secret block to one named player rather than a group.

---

## 3. World & Canon (the repo's superpowers)

Features only a git-backed platform can do — the moat no VTT can cross.

### 3.1 Alternate Timelines via Branches - L

Surface git branches as "what-if" timelines: branch the campaign at a decision
point, explore an alternate canon, diff the two worlds, merge back what
survived. Time-travel arcs, parallel parties, and planning sandboxes fall out
of git for free; the work is the UX.

### 3.2 Shared-World / Multi-Campaign Canon - L

Multiple campaigns subscribing to one shared setting repo: shared lore appears
read-only in each campaign with a propose-change flow back to the source (the
fork-proposal machinery generalized). West-marches leagues and living settings
become native — even when each table plays in its own Foundry world.

### 3.3 Canon Snapshots & Era Publishing - M

Tag a commit as a named canon snapshot ("End of Book One") and let the public
site serve a chosen snapshot instead of head. Readers see stable canon while
the table plays ahead of it.

### 3.4 In-World Broadsheet / Rumor Mill - S-M

A generated in-world newspaper or rumor digest assembled from recent events
and faction turns, published to the portal each in-game week. A delightful
player-facing artifact that keeps the world alive between Foundry nights.

---

## 4. Capture & Content Pipeline

### 4.1 Quick Capture Inbox - M

A phone-first capture surface (building on the new mobile chrome): jot a note,
snap a photo of a sketch, or record a voice memo mid-session — even while the
main screen is busy running Foundry. Everything lands in an inbox for later
filing; unfiled items nag gently on the campaign home page.

### 4.2 Session Audio Transcription & Entity Extraction - L

Record or upload session audio (most Foundry tables are on Discord voice
anyway), transcribe it, and run entity extraction against the wiki: unknown
proper nouns become draft pages in the review queue, known ones get timeline
mentions. The single largest reducer of GM bookkeeping; gated on a practical
speech-to-text path (local Whisper or a configured API).

### 4.3 Handout & Prop Designer - M

Styled, printable in-world documents from markdown templates: letters, wanted
posters, ship manifests, newspaper clippings — themed by the campaign's genre
theme, exported to PDF or pushed to Foundry as journal handouts via the bridge.

---

## 5. Community & Integrations

### 5.1 Discord Companion - M

Webhook digests (session scheduled, page approved, recap posted) plus a
slash-command bot that answers lore questions from the campaign's search
index. Discord is where Foundry tables already live between sessions; MCP
tools already define the query surface.

### 5.2 Template & Demo-Kit Exchange - M

Share template packs and demo kits as installable git repos: a community
index, one-click install into a campaign, attribution kept. The public gallery
proved the publishing model; this extends it from worlds to tooling.

### 5.3 Campaign Analytics & Spotlight Tracking - S-M

GM-only insights: which pages players actually read, most-linked NPCs,
orphaned plot threads, and per-PC spotlight balance across sessions. Computed
from data already in the repo — no tracking beyond the app's own usage.

### 5.4 Localization - M

Externalize UI strings and ship the first non-English locale. Campaign content
is already language-agnostic markdown; only the chrome needs work.

---

## Explicitly Out of Scope (Foundry's lane)

Recorded so they don't creep back in:

- Initiative / encounter / combat trackers
- Dice rollers and roll logs
- Battle maps, grids, tokens, fog of war
- Live GM screens and in-session automation
- Rollable-table *play* mechanics (authoring tables as content is fine;
  rolling them live is the VTT's job)

If a table doesn't use a VTT, the answer is the theater-of-the-mind features
above (recaps, journals, handouts, clocks) — not a half-VTT inside the wiki.

---

## Suggested Sequencing

1. **The Loop Wave** — recaps (2.1), scheduling (2.2), player journals (2.5),
   broadsheet (3.4). Small pieces, immediate weekly payoff, zero Foundry
   overlap.
2. **The Bridge Wave** — post-session harvest (1.2), scene/map handoff (1.4),
   then two-way journal sync (1.3) and the wiki-in-Foundry module (1.1).
3. **The World Wave** — downtime actions (2.3), faction clocks (2.4), canon
   snapshots (3.3).
4. **The Canon Wave** — alternate timelines (3.1), shared-world canon (3.2).
5. **The Reach Wave** — Discord (5.1), quick capture (4.1), handout designer
   (4.3), exchange (5.2), analytics (5.3), transcription (4.2),
   localization (5.4).
