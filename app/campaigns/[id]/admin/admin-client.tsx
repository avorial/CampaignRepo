"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Campaign, CampaignInvite, CampaignMembership } from "@/lib/types";

type ReviewItem = {
  slug: string;
  name: string;
  category: string;
  visibility: string;
  approvalStatus: string;
  summary: string;
  lastEditedBy?: string;
  sourceImport?: string;
  excerpt: string;
};

export default function AdminClient({ campaign }: { campaign: Campaign }) {
  const [members, setMembers] = useState<CampaignMembership[]>([]);
  const [invites, setInvites] = useState<CampaignInvite[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");

  async function load() {
    const [membersRes, invitesRes, reviewsRes] = await Promise.all([
      fetch(`/api/campaigns/${campaign.id}/admin/members`),
      fetch(`/api/campaigns/${campaign.id}/admin/invites`),
      fetch(`/api/campaigns/${campaign.id}/admin/reviews`)
    ]);
    const membersData = await membersRes.json();
    const invitesData = await invitesRes.json();
    const reviewsData = await reviewsRes.json();
    setMembers(membersData.members || []);
    setInvites(invitesData.invites || []);
    setReviews(reviewsData.reviews || []);
  }

  useEffect(() => {
    load();
    setOrigin(window.location.origin);
  }, []);

  function inviteUrl(token: string) {
    return `${origin || ""}/invite/${token}`;
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setTemporaryPassword("");
    const form = new FormData(event.currentTarget);
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/members`, {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), role: form.get("role") })
    });
    const data = await res.json();
    if (res.ok) {
      setMembers(data.members);
      event.currentTarget.reset();
      setMessage("Member added.");
    } else {
      setMessage(data.error === "No CampaignRepo account exists for that email."
        ? "That email has not registered yet. Create an invite link and send it to them instead."
        : data.error || "Could not add member.");
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setTemporaryPassword("");
    const form = new FormData(event.currentTarget);
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/members`, {
      method: "POST",
      body: JSON.stringify({
        createAccount: true,
        name: form.get("name"),
        email: form.get("email"),
        role: form.get("role")
      })
    });
    const data = await res.json();
    if (res.ok) {
      setMembers(data.members);
      setTemporaryPassword(data.temporaryPassword || "");
      event.currentTarget.reset();
      setMessage("Account created and added to campaign. Copy the temporary password now.");
    } else {
      setMessage(data.error || "Could not create account.");
    }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/invites`, {
      method: "POST",
      body: JSON.stringify({ role: form.get("role") })
    });
    const data = await res.json();
    if (res.ok) {
      setInvites(data.invites || []);
      setMessage("Invite link created.");
    } else {
      setMessage(data.error || "Could not create invite.");
    }
  }

  async function revokeInvite(inviteId: number) {
    setMessage("");
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/invites`, {
      method: "DELETE",
      body: JSON.stringify({ inviteId })
    });
    const data = await res.json();
    if (res.ok) {
      setInvites(data.invites || []);
      setMessage("Invite revoked.");
    } else {
      setMessage(data.error || "Could not revoke invite.");
    }
  }

  async function copyInvite(token: string) {
    await navigator.clipboard.writeText(inviteUrl(token));
    setMessage("Invite link copied.");
  }

  async function copyTemporaryPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setMessage("Temporary password copied.");
  }

  async function setRole(userId: number, role: "gm" | "player") {
    setMessage("");
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/members`, {
      method: "PATCH",
      body: JSON.stringify({ userId, role })
    });
    const data = await res.json();
    if (res.ok) {
      setMembers(data.members);
      setMessage("Role updated.");
    } else {
      setMessage(data.error || "Could not update role.");
    }
  }

  async function removeMember(userId: number) {
    setMessage("");
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/members`, {
      method: "DELETE",
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (res.ok) {
      setMembers(data.members);
      setMessage("Member removed.");
    } else {
      setMessage(data.error || "Could not remove member.");
    }
  }

  async function decideReview(slug: string, decision: "approved" | "rejected") {
    setMessage("");
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/reviews`, {
      method: "PATCH",
      body: JSON.stringify({ slug, decision })
    });
    const data = await res.json();
    if (res.ok) {
      setReviews(data.reviews);
      setMessage(decision === "approved" ? "Page approved." : "Page rejected.");
    } else {
      setMessage(data.error || "Could not update review.");
    }
  }

  return (
    <section className="admin-grid">
      <div className="panel">
        <h2>Create account</h2>
        <p className="muted">Create a CampaignRepo login, add it to this campaign, and choose GM or player access.</p>
        <form onSubmit={createAccount} className="stack">
          <label>Name<input name="name" required placeholder="Player name" /></label>
          <label>Email<input name="email" type="email" required placeholder="player@example.com" /></label>
          <label>Rights<select name="role"><option value="player">Player</option><option value="gm">GM</option></select></label>
          <button>Create and add</button>
        </form>
        {temporaryPassword && (
          <div className="admin-secret compact-secret">
            <span>Temporary password</span>
            <code>{temporaryPassword}</code>
            <button type="button" className="secondary" onClick={copyTemporaryPassword}>Copy</button>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Add existing account</h2>
        <p className="muted">Use this only after the person already has a CampaignRepo login. For a new test account, create an invite link instead.</p>
        <form onSubmit={addMember} className="stack">
          <label>Email<input name="email" type="email" required placeholder="player@example.com" /></label>
          <label>Role<select name="role"><option value="player">Player</option><option value="gm">GM</option></select></label>
          <button>Add existing account</button>
        </form>
      </div>

      <div className="panel">
        <h2>Invite links</h2>
        <p className="muted">Create a link for a GM or player. New users can register from the link; existing users can sign in and accept it.</p>
        <form onSubmit={createInvite} className="inline-form">
          <select name="role"><option value="player">Player</option><option value="gm">GM</option></select>
          <button>Create invite</button>
        </form>
        <div className="member-list invite-list">
          {invites.map((invite) => (
            <article key={invite.id} className="member-row">
              <div>
                <strong>{invite.role}</strong>
                {!invite.acceptedAt && !invite.revokedAt && origin && (
                  <code className="invite-url">{inviteUrl(invite.token)}</code>
                )}
                <span>{invite.acceptedAt ? "accepted" : invite.revokedAt ? "revoked" : "active"} · {invite.createdAt}</span>
              </div>
              <div className="member-actions">
                {!invite.acceptedAt && !invite.revokedAt && (
                  <>
                    <button type="button" className="secondary" onClick={() => copyInvite(invite.token)}>Copy</button>
                    <button type="button" className="secondary danger" onClick={() => revokeInvite(invite.id)}>Revoke</button>
                  </>
                )}
              </div>
            </article>
          ))}
          {!invites.length && <p className="muted">No invites yet.</p>}
        </div>
      </div>

      <div className="panel">
        <h2>Members</h2>
        <div className="member-list">
          {members.map((member) => (
            <article key={member.id} className="member-row">
              <div>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
              </div>
              <div className="member-actions">
                <span className="role-badge">{member.role}</span>
                {member.role !== "owner" && (
                  <>
                    <button type="button" className="secondary" onClick={() => setRole(member.userId, member.role === "gm" ? "player" : "gm")}>
                      Make {member.role === "gm" ? "Player" : "GM"}
                    </button>
                    <button type="button" className="secondary danger" onClick={() => removeMember(member.userId)}>
                      Remove
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        {message && <p className="toast">{message}</p>}
      </div>

      <div className="panel admin-wide">
        <h2>Review queue</h2>
        <p className="muted">AI edits and imported material marked unapproved stay visible to GMs here, but remain hidden from players until approved.</p>
        <div className="review-list">
          {reviews.map((review) => (
            <article key={review.slug} className="review-row">
              <div>
                <a href={`/campaigns/${campaign.id}/pages/${review.slug}`}><strong>{review.name}</strong></a>
                <p>{review.excerpt || review.summary || "No preview text yet."}</p>
                <span>
                  {review.category} · {review.visibility} · {review.approvalStatus}
                  {review.lastEditedBy ? ` · ${review.lastEditedBy}` : ""}
                  {review.sourceImport ? ` · ${review.sourceImport}` : ""}
                </span>
              </div>
              <div className="member-actions">
                <button type="button" onClick={() => decideReview(review.slug, "approved")}>Approve</button>
                <button type="button" className="secondary danger" onClick={() => decideReview(review.slug, "rejected")}>Reject</button>
              </div>
            </article>
          ))}
          {!reviews.length && <p className="muted">No unapproved pages are waiting for review.</p>}
        </div>
      </div>
    </section>
  );
}
