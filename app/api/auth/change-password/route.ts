import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

export async function POST(req: Request) {
  const user = await requireUser({ allowPasswordChange: true });
  const input = schema.parse(await req.json());
  if (input.newPassword === "admin") {
    return NextResponse.json({ error: "Choose a password other than the default admin password." }, { status: 400 });
  }
  const row = getDb().prepare("SELECT passwordHash FROM users WHERE id = ?").get(user.id) as { passwordHash: string } | undefined;
  if (!row || !(await verifyPassword(input.currentPassword, row.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }
  getDb()
    .prepare("UPDATE users SET passwordHash = ?, mustChangePassword = 0 WHERE id = ?")
    .run(await hashPassword(input.newPassword), user.id);
  return NextResponse.json({ ok: true });
}
