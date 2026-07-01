import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchDocs } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const campaignId = url.searchParams.get("campaignId");
  const mode = url.searchParams.get("mode") === "player" ? "player" : "gm";
  return NextResponse.json({ results: searchDocs(user.id, q, campaignId ? Number(campaignId) : undefined, mode) });
}
