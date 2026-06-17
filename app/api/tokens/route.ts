import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/db";

const createSchema = z.object({ name: z.string().max(80).optional() });
const deleteSchema = z.object({ id: z.number().int().positive() });

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ tokens: listApiTokens(user.id) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const { name } = createSchema.parse(await req.json());
  const created = createApiToken(user.id, name || "MCP token");
  return NextResponse.json({ token: created, tokens: listApiTokens(user.id) });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  const { id } = deleteSchema.parse(await req.json());
  revokeApiToken(user.id, id);
  return NextResponse.json({ tokens: listApiTokens(user.id) });
}
