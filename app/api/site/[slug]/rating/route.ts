import { NextResponse } from "next/server";
import { z } from "zod";
import { ratePublicSite } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  rating: z.number().min(1).max(5)
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const input = bodySchema.parse(await req.json());
  const site = ratePublicSite(slug, input.rating);
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ratingAverage: site.ratingAverage,
    ratingCount: site.ratingCount
  });
}
