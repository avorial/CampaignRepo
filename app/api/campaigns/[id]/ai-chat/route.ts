import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";
import { readPageCache } from "@/lib/page-cache";

export const dynamic = "force-dynamic";

const CONFIG_PATH = "wiki/.ai-config.json";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string()
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
  contextSlugs: z.array(z.string()).default([])
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage configured" }, { status: 400 });

  const input = bodySchema.parse(await req.json());

  const aiConfig = await readAIConfig(storage);
  if (!aiConfig.endpoint) {
    return NextResponse.json({ error: "AI endpoint not configured. Set it up in Campaign Settings → AI." }, { status: 400 });
  }

  // Build context from page cache
  let contextText = "";
  try {
    const cached = readPageCache(campaign.id);
    const allPages = cached.pages;
    const contextPages = input.contextSlugs.length > 0
      ? allPages.filter((p) => input.contextSlugs.includes(p.slug)).slice(0, 12)
      : allPages.slice(0, 30);

    if (contextPages.length > 0) {
      contextText = "\n\n---\nCAMPAIGN WIKI (for reference):\n\n" +
        contextPages.map((p) => {
          const name = p.frontmatter.name || p.slug;
          const cat = p.frontmatter.category || "";
          const summary = p.frontmatter.summary || "";
          const body = (p.content || "").slice(0, input.contextSlugs.length > 0 ? 1200 : 400);
          return `**${name}** (${cat})${summary ? ` — ${summary}` : ""}\n${body}`;
        }).join("\n\n");
    }
  } catch { /* page cache unavailable — proceed without context */ }

  const systemPrompt =
    `You are a knowledgeable assistant for the tabletop RPG campaign "${campaign.name}" (${campaign.gameType || "generic system"}). ` +
    `You have access to the campaign wiki and help the GM with questions, analysis, and content creation. ` +
    `Answer questions concisely and accurately based on the campaign material provided. ` +
    `If you don't know something, say so rather than inventing facts.` +
    contextText;

  const endpoint = (aiConfig.endpoint || "").replace(/\/$/, "");
  const model = aiConfig.model || "llama3.2";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (aiConfig.apiKey) headers["Authorization"] = `Bearer ${aiConfig.apiKey}`;

  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...input.messages
      ],
      temperature: 0.7,
      max_tokens: 1200
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `AI error ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
  }

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const reply = data.choices?.[0]?.message?.content?.trim() || "";
  return NextResponse.json({ reply });
}
