import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";
import { readPageCache } from "@/lib/page-cache";
import {
  generateNPC, generateSettlement, generateFaction, generateRumor, generateEncounter,
  npcToMarkdown, settlementToMarkdown, factionToMarkdown, rumorToMarkdown, encounterToMarkdown
} from "@/lib/generators";

const CONFIG_PATH = "wiki/.ai-config.json";

const schema = z.object({
  type: z.enum(["npc", "settlement", "faction", "rumor", "encounter"]),
  mode: z.enum(["random", "ai"]).default("random"),
  contextSlugs: z.array(z.string()).default([]),
  seed: z.number().int().optional()
});

async function readAIConfig(storage: NonNullable<ReturnType<typeof getStorageAdapter>>) {
  try {
    const file = await storage.getTextFile(CONFIG_PATH);
    return JSON.parse(file.text) as { endpoint?: string; model?: string; apiKey?: string };
  } catch (e) {
    if (isNotFoundError(e)) return {};
    throw e;
  }
}

async function callAI(config: { endpoint?: string; model?: string; apiKey?: string }, prompt: string, systemPrompt: string): Promise<string> {
  const endpoint = (config.endpoint || "").replace(/\/$/, "");
  if (!endpoint) throw new Error("No AI endpoint configured.");
  const model = config.model || "llama3.2";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.85,
      max_tokens: 800
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI endpoint error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage configured" }, { status: 400 });

  const input = schema.parse(await req.json());
  const seed = input.seed ?? Date.now();

  // Random table fallback
  function randomResult() {
    switch (input.type) {
      case "npc": return npcToMarkdown(generateNPC(seed));
      case "settlement": return settlementToMarkdown(generateSettlement(seed));
      case "faction": return factionToMarkdown(generateFaction(seed));
      case "rumor": return rumorToMarkdown(generateRumor(seed));
      case "encounter": return encounterToMarkdown(generateEncounter(seed));
    }
  }

  if (input.mode === "random") {
    return NextResponse.json({ result: randomResult(), mode: "random" });
  }

  // AI mode
  const aiConfig = await readAIConfig(storage);
  if (!aiConfig.endpoint) {
    return NextResponse.json({ result: randomResult(), mode: "random", warning: "AI endpoint not configured — falling back to random tables." });
  }

  // Build context from selected pages
  let contextText = "";
  if (input.contextSlugs.length > 0) {
    try {
      const cached = readPageCache(campaign.id);
      const allPages = cached?.pages || [];
      const contextPages = allPages.filter((p) => input.contextSlugs.includes(p.slug)).slice(0, 8);
      if (contextPages.length > 0) {
        contextText = "\n\nCampaign context:\n" + contextPages.map((p) =>
          `### ${p.frontmatter.name} (${p.frontmatter.category})\n${p.frontmatter.summary || ""}\n${(p.content || "").slice(0, 600)}`
        ).join("\n\n");
      }
    } catch { /* best effort */ }
  }

  const TYPE_LABELS: Record<string, string> = {
    npc: "an NPC", settlement: "a settlement", faction: "a faction", rumor: "a rumor", encounter: "an encounter"
  };
  const systemPrompt = `You are a tabletop RPG game master assistant helping create campaign content for a ${campaign.gameType} campaign called "${campaign.name}". Generate evocative, specific, and usable content. Respond with plain prose — no preamble, no explanation, just the generated content.`;
  const randomBase = randomResult();
  const prompt = `Generate ${TYPE_LABELS[input.type]} for my campaign. Use this as a starting point, but make it your own:\n\n${randomBase.content}${contextText}\n\nWrite a short but specific description (3-5 sentences) that could be dropped directly into a campaign wiki. Give the ${input.type} a name if it needs one. Be concrete and evocative.`;

  try {
    const aiContent = await callAI(aiConfig, prompt, systemPrompt);
    const nameMatch = aiContent.match(/^##?\s+([^\n]+)/);
    const name = nameMatch?.[1]?.trim() || randomBase.name;
    const content = aiContent.trim();
    return NextResponse.json({ result: { name, category: randomBase.category, content }, mode: "ai" });
  } catch (e) {
    const warning = e instanceof Error ? e.message : "AI generation failed.";
    return NextResponse.json({ result: randomResult(), mode: "random", warning: `${warning} — falling back to random tables.` });
  }
}
