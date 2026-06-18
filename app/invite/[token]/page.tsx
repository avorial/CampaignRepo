import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getCampaignInvite } from "@/lib/db";
import InviteAcceptClient from "./invite-accept-client";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  const invite = getCampaignInvite(token);
  const active = Boolean(invite && !invite.revokedAt && !invite.acceptedAt);

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">CampaignRepo Invite</p>
          <h1>{active ? invite!.campaignName : "Invite unavailable"}</h1>
          <p className="muted">
            {active
              ? `Join as ${invite!.role} for ${invite!.owner}/${invite!.repo}.`
              : "This invite has already been used, revoked, or does not exist."}
          </p>
        </div>

        {active && user && <InviteAcceptClient token={token} />}
        {active && !user && (
          <div className="stack">
            <Link className="button" href={`/register?invite=${encodeURIComponent(token)}`}>Create account and join</Link>
            <Link className="button secondary" href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to accept</Link>
          </div>
        )}
      </section>
    </main>
  );
}
