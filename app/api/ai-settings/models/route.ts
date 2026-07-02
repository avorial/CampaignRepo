import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { listAiModels, normalizeAiEndpoint } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  endpoint: z.string().min(1),
  apiKey: z.string().optional()
});

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const input = querySchema.parse({
    endpoint: url.searchParams.get("endpoint") || "",
    apiKey: url.searchParams.get("apiKey") || undefined
  });
  const endpoint = normalizeAiEndpoint(input.endpoint);
  const headers: Record<string, string> = {};
  if (input.apiKey && !input.apiKey.startsWith("••")) headers.Authorization = `Bearer ${input.apiKey}`;
  try {
    const models = await listAiModels(endpoint, headers);
    return NextResponse.json({ endpoint, models });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list AI models.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
