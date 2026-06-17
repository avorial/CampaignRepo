"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Campaign, CampaignMembership } from "@/lib/types";

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
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const [membersRes, reviewsRes] = await Promise.all([
      fetch(`/api/campaigns/${campaign.id}/admin/members`),
      fetch(`/api/campaigns/${campaign.id}/admin/reviews`)
    ]);
    const membersData = await membersRes.json();
    const reviewsData = await reviewsRes.json();
    setMembers(membersData.members || []);
    setReviews(reviewsData.reviews || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
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
      setMessage(data.error || "Could not add member.");
    }
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
        <h2>Add user</h2>
        <p className="muted">Users need to create a CampaignRepo account first. Add them by account email, then choose whether they are a GM or player.</p>
        <form onSubmit={addMember} className="stack">
          <label>Email<input name="email" type="email" required placeholder="player@example.com" /></label>
          <label>Role<select name="role"><option value="player">Player</option><option value="gm">GM</option></select></label>
          <button>Add to campaign</button>
        </form>
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
