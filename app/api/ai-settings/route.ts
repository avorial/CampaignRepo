import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getUserAiSettings, setUserAiSettings } from "@/lib/db";
import { maskAiConfig } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url().or(z.literal("")).optional(),
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
  const config = setUserAiSettings(user.id, input);
  return NextResponse.json({ config: maskAiConfig(config) });
}
