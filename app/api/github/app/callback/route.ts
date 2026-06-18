import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { githubAppConnectionToken, getInstallationRepositories } from "@/lib/github";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "";
  const expectedState = req.cookies.get("github_app_state")?.value || "";
  const installationId = url.searchParams.get("installation_id") || "";

  if (!expectedState || state !== expectedState) {
    return NextResponse.json({ error: "GitHub App connection state did not match. Please try again." }, { status: 400 });
  }

  if (!installationId) {
    return NextResponse.json({ error: "GitHub did not return an installation id." }, { status: 400 });
  }

  const token = githubAppConnectionToken(installationId);
  await getInstallationRepositories(token);
  getDb().prepare("UPDATE users SET githubToken = ? WHERE id = ?").run(token, user.id);

  const response = NextResponse.redirect(new URL("/dashboard?github=app-connected", req.url));
  response.cookies.delete("github_app_state");
  return response;
}
