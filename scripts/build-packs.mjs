#!/usr/bin/env node
// Source of truth for built-in template packs, keyed by game SYSTEM.
// Run `node scripts/build-packs.mjs` to (re)generate lib/template-packs.json,
// which is imported by the app (seeded on repo init) and by scripts/seed-templates.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, "..", "lib", "template-packs.json");

// t(slug, name, category, tags, body, extra?) -> { slug, frontmatter, body }
function t(slug, name, category, tags, body, extra = {}) {
  return {
    slug,
    frontmatter: {
      category,
      type: category,
      name,
      summary: extra.summary || "",
      tags,
      visibility: "gm",
      approvalStatus: "approved",
      knownToPlayers: false,
      keyLinks: [],
      aliases: [],
      lastEditedBy: "CampaignRepo",
      ...stripSummary(extra)
    },
    body: body.trim() + "\n"
  };
}
function stripSummary({ summary, ...rest }) {
  return rest;
}

function genericCharacterSheet(systemName, focus = "Player") {
  return t("character-sheet", "Character Sheet", "character", ["pc", "character", "sheet"], `
# Character Sheet

![portrait](/wiki/media/REPLACE.jpg)
*${systemName} ${focus} Character*

**Player:**
**Pronouns:**
**Concept:**
**Status:** active

## Identity

- **Ancestry / Species:**
- **Culture / Home:**
- **Calling / Career:**
- **Affiliation:** [[Faction]]

## Core Stats

| Trait | Value | Notes |
| --- | --- | --- |
| Primary attribute |  |  |
| Secondary attribute |  |  |
| Defense / Save |  |  |
| Health / Harm |  |  |
| Resource |  |  |

## Skills & Edges

- Skill / edge - rating - note

## Gear

- Item - note

## Bonds

- [[NPC]] - relationship
- [[Location]] - tie

## Goals

- Short-term:
- Long-term:

:::gm
## GM Notes

Secrets, flags, hooks, and pressure points.
:::
`, { summary: `${systemName} character sheet template.` });
}

function travellerCharacterSheet() {
  return t("character-sheet", "Character Sheet", "character", ["pc", "character", "sheet", "traveller"], `
# Character Sheet

![portrait](/wiki/media/REPLACE.jpg)
*Career - Rank - Homeworld*

\`\`\`traveller-sheet
name: Unnamed Traveller
species: Racial Solomani
age: 34
homeworld:
career:
rank: F
dossier: Travel
status: Unwounded
speciesTraits:
  - Racial Solomani
  - Party Patronage
  - Solomani Heritage
  - Solomani Cause
characteristics:
  STR: 12
  DEX: 9
  END: 10
  INT: 11
  EDU: 10
  SOC: 12
skills:
  - name: Admin
    level: 1
  - name: Diplomat
    level: 2
  - name: Science
    speciality: History
    level: 1
  - name: Science
    speciality: Robotics
    level: 1
  - name: Streetwise
    level: 2
weapons: []
armour: []
equipment: []
notes: Chargen complete - Mongoose Traveller 2.0 layout
\`\`\`

## Career & Terms

| Term | Career | Rank | Events / Benefits |
| --- | --- | --- | --- |
| 1 |  |  |  |
| 2 |  |  |  |

## Connections

- [[NPC]] - ally / rival / contact
- [[Faction]] - patron / employer / enemy

## Equipment & Assets

- Item - notes

## Notes

Personality, ambitions, debts, and trouble following this traveller.

:::gm
## GM Notes

Rivals, secrets, obligations, and hooks.
:::
`, {
    summary: "Traveller character sheet block rendered from editable markdown."
  });
}

const packs = {
  "Sword Chronicle": [
    genericCharacterSheet("Sword Chronicle", "House"),
    t("house", "House", "npc", ["faction", "house"], `
# House

![arms](/wiki/media/REPLACE.png)
*Words • Seat • Liege*

**Coat of Arms:**
**Seat:** [[Holding]]
**Liege:** [[House]]
**Founded:**

## House Fortunes

| Defense | Influence | Lands | Law | Population | Power | Wealth |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## History

How the house rose, and where it stands in the realm now.

## Members

- [[Player Character]] — head of house
- [[NPC]] — heir / steward

## Banner Houses

- [[House]]

:::gm
## GM Truth

Secret debts, hidden bastards, and the lever that could topple them.
:::`),
    t("character", "Character", "character", ["pc", "character"], `
# Character

![portrait](/wiki/media/REPLACE.jpg)
*House • Age • Role*

**House:** [[House]]
**Age:**
**Status:** alive

## Abilities & Specialties

- Notable abilities and the specialties that set them apart.

## Benefits & Drawbacks

- **Benefit:**
- **Drawback:**

## Destiny & Glory

- **Destiny Points:**
- **Glory:**

## Goals

- Short-term:
- Long-term:

:::gm
## GM Notes

Bonds to exploit and secrets the character may not yet know.
:::`),
    t("npc", "NPC", "npc", ["npc"], `
# NPC

![portrait](/wiki/media/REPLACE.jpg)
*Role • Allegiance*

**House / Affiliation:** [[House]]
**Status:** alive

## Public Face

How the world sees them and what the party can learn by asking around.

## Relationships

- [[Someone]] — ally / rival

:::gm
## GM Truth

What they want, hide, and know.
:::`),
    t("holding", "Holding", "location", ["location", "holding"], `
# Holding

![view](/wiki/media/REPLACE.png)
*Type • Held by*

**Type:** castle / town / keep
**Held by:** [[House]]
**Region:** [[Place]]

## Overview

What the holding controls and is known for.

## Notable Sites

- A landmark, with a hook.

:::gm
## GM Truth

Hidden defenses, caches, and dangers.
:::`),
    t("warfare-unit", "Warfare Unit", "game", ["warfare", "unit"], `
# Warfare Unit

*Type • Allegiance*

**Type:** infantry / cavalry / archers / scouts
**Allegiance:** [[House]]

## Attributes

- **Discipline:**
- **Training:**
- **Experience:**

## Facing & Orders

- Strengths, weaknesses, and standing orders.

:::gm
## GM Notes

Morale breakpoints and hidden capabilities.
:::`),
    t("session", "Session", "event", ["session"], `
# Session

**Chapter:**
**In-world date:**
**Present:** [[Character]], [[Character]]

## Recap

Where we left off and the hook into this session.

## Scenes

1. **Scene** — what happened.

## Glory & Rewards

- Glory gained and by whom.

## Open Threads

- Hooks carried forward.

:::gm
## GM Notes

Setups, consequences now in motion.
:::`, { summary: "Recap layout for a play session; fill in eventDate for the timeline.", eventDate: "" }),
    t("rumor", "Rumor", "event", ["rumor"], `
# Rumor

**Heard in:** [[Holding]]
**Subject:** [[House]]
**Reliability:** common talk / single source / firsthand

## The Word

What people are saying, in their words.

## Where It Leads

- A place or person to chase for more.

:::gm
## The Truth

How much is real, who started it, and why.
:::`, { eventDate: "" })
  ],

  "Dungeons & Dragons": [
    genericCharacterSheet("Dungeons & Dragons"),
    t("npc", "NPC", "npc", ["npc", "statblock"], `
# NPC

![portrait](/wiki/media/REPLACE.jpg)
*Race • Role • Alignment*

**AC:**  **HP:**  **Speed:**
**CR:**

## Stat Block

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

**Actions:**

## Roleplay

Voice, mannerism, ideal/bond/flaw, and what they want.

:::gm
## GM Truth

Hidden motives, tactics, and treasure.
:::`),
    t("player-character", "Player Character", "character", ["pc", "character"], `
# Player Character

![portrait](/wiki/media/REPLACE.jpg)
*Player • Pronouns • Concept*

**Class & Level:**
**Race:**  **Background:**
**Alignment:**

## Backstory

A few lines on where they come from.

## Ties

- [[NPC]] — relationship
- [[Faction]] — allegiance

## Goals

- Short-term / long-term.

:::gm
## GM Notes

Backstory hooks to pay off.
:::`),
    t("location", "Location", "location", ["location"], `
# Location

![map](/wiki/media/REPLACE.png)
*Type • Ruler*

**Type:** city / dungeon / wilds
**Ruler / Power:** [[Faction]]

## Overview

What it looks like and is known for.

## Points of Interest

- A site, with a hook.

## Encounters

- What the party may run into.

:::gm
## GM Truth

Secrets, traps, and treasure here.
:::`),
    t("faction", "Faction", "npc", ["faction"], `
# Faction

![symbol](/wiki/media/REPLACE.png)
*Type • Seat*

**Type:** guild / cult / order / crown
**Headquarters:** [[Location]]
**Leader:** [[NPC]]

## Goals & Methods

What they want and how they pursue it.

## Allies & Enemies

- Allies / enemies.

:::gm
## GM Truth

Hidden agenda and assets.
:::`),
    t("magic-item", "Magic Item", "game", ["item", "magic-item"], `
# Magic Item

![item](/wiki/media/REPLACE.png)
*Type • Rarity*

**Type:** weapon / wondrous item / potion
**Rarity:** common / uncommon / rare / very rare / legendary
**Attunement:** yes / no

## Description

What it looks like and does.

## Properties

- Mechanical effects.

:::gm
## GM Truth

Curses, charges, and its true history.
:::`),
    t("session", "Session", "event", ["session"], `
# Session

**Present:** [[Player Character]], [[Player Character]]

## Recap

Where we left off and tonight's hook.

## Scenes

1. **Scene** — what happened.

## Loot & XP

- Rewards gained.

## Open Threads

- Hooks carried forward.

:::gm
## GM Notes

Setups and consequences.
:::`, { summary: "Recap layout for a play session; fill in eventDate for the timeline.", eventDate: "" })
  ],

  "World of Darkness": [
    genericCharacterSheet("World of Darkness"),
    t("vampire", "Vampire", "character", ["pc", "vampire"], `
# Vampire

![portrait](/wiki/media/REPLACE.jpg)
*Clan • Generation • Sire*

**Clan:**
**Generation:**
**Sire:** [[NPC]]
**Predator Type:**
**Humanity:**

## Disciplines

- Discipline • dots

## Mask & Mien

How they pass among mortals, and what they truly are.

## Touchstones & Convictions

- A touchstone and the conviction it anchors.

:::gm
## GM Notes

The Beast's triggers and looming hooks.
:::`),
    t("mortal", "Mortal NPC", "npc", ["npc", "mortal"], `
# Mortal NPC

![portrait](/wiki/media/REPLACE.jpg)
*Role • Connection*

**Occupation:**
**Connection:** [[Vampire]] / [[Coterie]]

## Public Face

How they present and what they offer.

:::gm
## GM Truth

What they know, suspect, or are being used for.
:::`),
    t("domain", "Domain", "location", ["location", "domain"], `
# Domain

![view](/wiki/media/REPLACE.png)
*Regent • Status*

**Regent / Prince:** [[Vampire]]
**Territory:**

## Overview

The feeding grounds, hot spots, and rules of the night here.

## Hot Spots

- A location, with a hook.

:::gm
## GM Truth

Hidden hazards and contested ground.
:::`),
    t("coterie", "Coterie", "npc", ["faction", "coterie"], `
# Coterie

![symbol](/wiki/media/REPLACE.png)
*Type • Domain*

**Type:** pack / cabal / faction
**Domain:** [[Domain]]
**Members:** [[Vampire]]

## Purpose

What binds them and what they pursue.

## Standing

- Allies and rivals among the Kindred.

:::gm
## GM Truth

Fractures, betrayals, and secret deals.
:::`),
    t("story", "Story / Session", "event", ["session", "story"], `
# Story / Session

**Chronicle:**
**Present:** [[Vampire]], [[Vampire]]

## Recap

Where we left off and tonight's hook.

## Scenes

1. **Scene** — what happened.

## Consequences

- Humanity tests, boons owed, Masquerade risks.

:::gm
## GM Notes

Threads tightening behind the scenes.
:::`, { summary: "Recap layout for a chronicle session; fill in eventDate for the timeline.", eventDate: "" }),
    t("rumor", "Rumor", "event", ["rumor"], `
# Rumor

**Heard in:** [[Domain]]
**Subject:** [[Vampire]] / [[Coterie]]
**Reliability:** Elysium gossip / single source / firsthand

## The Word

What the Kindred are whispering.

## Where It Leads

- A contact or place to press for more.

:::gm
## The Truth

Who planted it and what it conceals.
:::`, { eventDate: "" })
  ],

  Traveller: [
    travellerCharacterSheet(),
    t("npc", "NPC", "npc", ["npc"], `
# NPC

![portrait](/wiki/media/REPLACE.jpg)
*Career • Allegiance*

**UPP:**
**Career / Rank:**
**Affiliation:** [[Faction]]

## Profile

Background, manner, and what they want.

## Connections

- [[NPC]] — relationship.

:::gm
## GM Truth

Hidden loyalties and leverage.
:::`, { allegiance: "" }),
    t("world", "World", "location", ["location", "world"], `
# World

![map](/wiki/media/REPLACE.png)
*UWP • Subsector*

**UWP:**
**Allegiance:**
**Trade Codes:**
**Subsector:**
**Tech Level:**

## Overview

Starport, government, and what travellers find here.

## Points of Interest

- A site, with a hook.

:::gm
## GM Truth

What the survey missed.
:::`, { uwp: "", allegiance: "", tradeCodes: [], subsector: "", techLevel: "" }),
    t("patron", "Patron", "npc", ["npc", "patron"], `
# Patron

![portrait](/wiki/media/REPLACE.jpg)
*Role • Reach*

**Affiliation:** [[Faction]]
**Offers:** the job, the pay, the risk.

## The Offer

What the patron wants done, and the stated terms.

## Complications

- What they aren't telling the crew.

:::gm
## GM Truth

The real goal, the double-cross, and the true payoff.
:::`, { patron: "" }),
    t("faction", "Faction", "npc", ["faction"], `
# Faction

![symbol](/wiki/media/REPLACE.png)
*Type • Reach*

**Type:** corporation / noble line / government / criminal
**Headquarters:** [[World]]
**Leader:** [[NPC]]

## Goals & Methods

What they want and how far their reach extends.

:::gm
## GM Truth

Hidden assets and agenda.
:::`),
    t("ship", "Ship", "game", ["ship"], `
# Ship

![ship](/wiki/media/REPLACE.png)
*Class • Tonnage*

**Tonnage:**
**Jump:**  **Maneuver:**
**Owner / Crew:** [[NPC]]

## Specifications

Armament, cargo, staterooms, and quirks.

:::gm
## GM Notes

Liens, hidden compartments, and history.
:::`),
    t("session", "Session", "event", ["session"], `
# Session

**Present:** [[NPC]], [[NPC]]

## Recap

Where the crew left off and the current job.

## Scenes

1. **Scene** — what happened.

## Payout

- Credits, salvage, reputation.

## Open Threads

- Hooks carried forward.

:::gm
## GM Notes

Setups and consequences.
:::`, { summary: "Recap layout for a play session; fill in eventDate for the timeline.", eventDate: "" })
  ],

  Custom: [
    genericCharacterSheet("Custom"),
    t("character", "Character", "character", ["character"], `
# Character

## Overview

## Ties

- [[Someone]]

:::gm
GM-only truth.
:::`),
    t("npc", "NPC", "npc", ["npc"], `
# NPC

## Public Face

## Relationships

- [[Someone]]

:::gm
What they want, hide, and know.
:::`),
    t("location", "Location", "location", ["location"], `
# Location

## Overview

## Notable Sites

:::gm
Hidden truths here.
:::`),
    t("event", "Event", "event", ["event"], `
# Event

## Summary

## Aftermath

:::gm
What really happened.
:::`, { eventDate: "" }),
    t("game", "Game Note", "game", ["game"], `
# Game Note

## Overview

:::gm
GM-only rules notes.
:::`)
  ]
};

fs.writeFileSync(outFile, JSON.stringify(packs, null, 2) + "\n");
const counts = Object.fromEntries(Object.entries(packs).map(([k, v]) => [k, v.length]));
console.log("Wrote", outFile);
console.log(JSON.stringify(counts, null, 2));
