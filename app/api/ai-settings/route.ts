import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getUserAiSettings, setUserAiSettings } from "@/lib/db";
import { maskAiConfig, normalizeAiEndpoint, testAiConnection } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.preprocess((value) => normalizeAiEndpoint(String(value || "")), z.string().url().or(z.literal(""))).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional()
});

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ config: maskAiConfig(getUserAiSettings(user.id)) });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  const input = schema.parse(await req.json());
  let testedConfig = input;
  try {
    testedConfig = await testAiConnection(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI endpoint test failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const config = setUserAiSettings(user.id, testedConfig);
  return NextResponse.json({ config: maskAiConfig(config) });
}
