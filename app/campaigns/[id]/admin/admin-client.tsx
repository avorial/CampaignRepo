"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Campaign, CampaignInvite, CampaignMembership } from "@/lib/types";
import type { ForkProposal } from "@/lib/db";

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

type MemberWithGroups = CampaignMembership & { groups?: string[] };

export default function AdminClient({ campaign, isGlobalAdmin = false, publicSlug, incomingProposals: initialProposals }: { campaign: Campaign; isGlobalAdmin?: boolean; publicSlug?: string | null; incomingProposals?: ForkProposal[] }) {
  const canTransferOwnership = campaign.role === "owner" || isGlobalAdmin;
  const [members, setMembers] = useState<MemberWithGroups[]>([]);
  const [invites, setInvites] = useState<CampaignInvite[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [proposals, setProposals] = useState<ForkProposal[]>(initialProposals || []);
  const [proposalMsg, setProposalMsg] = useState("");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [campaignGroups, setCampaignGroups] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  type PropDef = { name: string; type: string; options?: string[]; placeholder?: string };
  const [categoryProperties, setCategoryProperties] = useState<Record<string, PropDef[]>>({});
  const [editingCatProps, setEditingCatProps] = useState<string>("character");
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState("text");
  const [catPropsSaved, setCatPropsSaved] = useState(false);

  async function load() {
    const [membersRes, invitesRes, reviewsRes, groupsRes, catPropsRes] = await Promise.all([
      fetch(`/api/campaigns/${campaign.id}/admin/members`),
      fetch(`/api/campaigns/${campaign.id}/admin/invites`),
      fetch(`/api/campaigns/${campaign.id}/admin/reviews`),
      fetch(`/api/campaigns/${campaign.id}/groups`),
      fetch(`/api/campaigns/${campaign.id}/category-properties`)
    ]);
    const membersData = await membersRes.json();
    const invitesData = await invitesRes.json();
    const reviewsData = await reviewsRes.json();
    const groupsData = groupsRes.ok ? await groupsRes.json() : {};
    const catPropsData = catPropsRes.ok ? await catPropsRes.json() : {};
    setMembers(membersData.members || []);
    setInvites(invitesData.invites || []);
    setReviews(reviewsData.reviews || []);
    setCampaignGroups(groupsData.groups || []);
    setCategoryProperties(catPropsData.categoryProperties || {});
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

  async function makeOwner(userId: number, name: string) {
    if (!window.confirm(`Make ${name} the owner of this campaign? The current owner becomes a GM, and only ${name} will be able to remove the campaign.`)) return;
    setMessage("");
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/members`, {
      method: "PATCH",
      body: JSON.stringify({ userId, role: "owner" })
    });
    const data = await res.json();
    if (res.ok) {
      setMembers(data.members);
      setMessage(`${name} is now the owner. Reload to refresh your own access.`);
    } else {
      setMessage(data.error || "Could not transfer ownership.");
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

  async function saveCategoryProperties(updated: Record<string, PropDef[]>) {
    await fetch(`/api/campaigns/${campaign.id}/category-properties`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryProperties: updated })
    });
    setCatPropsSaved(true);
    setTimeout(() => setCatPropsSaved(false), 2000);
  }

  function addCatProp() {
    const name = newPropName.trim();
    if (!name) return;
    const current = categoryProperties[editingCatProps] || [];
    if (current.some((p) => p.name === name)) return;
    const updated = { ...categoryProperties, [editingCatProps]: [...current, { name, type: newPropType }] };
    setCategoryProperties(updated);
    saveCategoryProperties(updated);
    setNewPropName("");
  }

  function removeCatProp(cat: string, propName: string) {
    const current = (categoryProperties[cat] || []).filter((p) => p.name !== propName);
    const updated = { ...categoryProperties, [cat]: current };
    setCategoryProperties(updated);
    saveCategoryProperties(updated);
  }

  async function addGroup() {
    const name = newGroupName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    if (!name || campaignGroups.includes(name)) return;
    const updated = [...campaignGroups, name];
    await fetch(`/api/campaigns/${campaign.id}/groups`, { method: "PUT", body: JSON.stringify({ groups: updated }) });
    setCampaignGroups(updated);
    setNewGroupName("");
  }

  async function removeGroup(name: string) {
    const updated = campaignGroups.filter((g) => g !== name);
    await fetch(`/api/campaigns/${campaign.id}/groups`, { method: "PUT", body: JSON.stringify({ groups: updated }) });
    setCampaignGroups(updated);
  }

  async function toggleMemberGroup(userId: number, group: string, currentGroups: string[]) {
    const next = currentGroups.includes(group)
      ? currentGroups.filter((g) => g !== group)
      : [...currentGroups, group];
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/members`, {
      method: "PATCH",
      body: JSON.stringify({ userId, groups: next })
    });
    const data = await res.json();
    if (res.ok) setMembers(data.members || []);
  }

  async function decideAll(decision: "approved" | "rejected") {
    if (!reviews.length || bulkBusy) return;
    const verb = decision === "approved" ? "Approve" : "Reject";
    if (!window.confirm(`${verb} all ${reviews.length} pending page(s)? This cannot be undone in bulk.`)) return;
    setBulkBusy(true);
    setMessage(`${verb}ing all ${reviews.length} page(s)…`);
    const res = await fetch(`/api/campaigns/${campaign.id}/admin/reviews`, {
      method: "PATCH",
      body: JSON.stringify({ all: true, decision })
    });
    const data = await res.json();
    setBulkBusy(false);
    if (res.ok) {
      setReviews(data.reviews);
      setMessage(`${data.updated} page(s) ${decision}.`);
    } else {
      setMessage(data.error || "Could not update reviews.");
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
                    {canTransferOwnership && (
                      <button type="button" className="secondary" onClick={() => makeOwner(member.userId, member.name)}>
                        Make Owner
                      </button>
                    )}
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
        <h2>Secret groups</h2>
        <p className="muted" style={{ fontSize: "13px" }}>
          Define named groups (e.g. <code>cultists</code>, <code>rangers</code>) and assign players to them.
          Use <code>:::secret group="cultists"</code> in page content to reveal blocks only to members of that group (GMs always see everything).
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {campaignGroups.map((g) => (
            <span key={g} className="tag-chip" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {g}
              <button type="button" className="linklike" style={{ fontSize: "10px" }} onClick={() => removeGroup(g)}>✕</button>
            </span>
          ))}
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="new-group"
            onKeyDown={(e) => e.key === "Enter" && addGroup()}
            style={{ width: 120 }}
          />
          <button type="button" onClick={addGroup} disabled={!newGroupName.trim()}>Add group</button>
        </div>

        {campaignGroups.length > 0 && (
          <table className="organize-table" style={{ marginTop: 8 }}>
            <thead><tr><th>Member</th><th>Role</th>{campaignGroups.map((g) => <th key={g}>{g}</th>)}</tr></thead>
            <tbody>
              {members.filter((m) => m.role === "player").map((m) => {
                const mGroups: string[] = m.groups ? (typeof m.groups === "string" ? JSON.parse(m.groups) : m.groups) : [];
                return (
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong><br /><small className="muted">{m.email}</small></td>
                    <td><span className="role-badge">{m.role}</span></td>
                    {campaignGroups.map((g) => (
                      <td key={g} style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={mGroups.includes(g)}
                          onChange={() => toggleMemberGroup(m.userId, g, mGroups)}
                          style={{ width: "auto" }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {campaignGroups.length === 0 && <p className="muted" style={{ fontSize: "13px" }}>No groups defined yet.</p>}
      </div>

      <div className="panel admin-wide">
        <h2>Category properties</h2>
        <p className="muted" style={{ fontSize: "13px" }}>
          Define custom fields for each page category. They appear as form inputs in the page editor and are stored in each page&apos;s frontmatter under <code>customProps</code>.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Category:</label>
          <select value={editingCatProps} onChange={(e) => setEditingCatProps(e.target.value)} style={{ width: "auto" }}>
            {["character", "npc", "location", "faction", "item", "lore", "event", "session", "quest", "creature"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {(categoryProperties[editingCatProps] || []).length > 0 && (
          <table className="organize-table" style={{ marginBottom: 12 }}>
            <thead><tr><th>Field name</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {(categoryProperties[editingCatProps] || []).map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td><span className="tag-chip">{p.type}</span></td>
                  <td><button type="button" className="linklike danger" onClick={() => removeCatProp(editingCatProps, p.name)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!(categoryProperties[editingCatProps] || []).length && (
          <p className="muted" style={{ fontSize: "13px", marginBottom: 12 }}>No custom properties defined for <code>{editingCatProps}</code> yet.</p>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="search-input"
            style={{ width: 200 }}
            placeholder="Field name (e.g. Motivation)"
            value={newPropName}
            onChange={(e) => setNewPropName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCatProp(); } }}
          />
          <select value={newPropType} onChange={(e) => setNewPropType(e.target.value)} style={{ width: "auto" }}>
            <option value="text">Short text</option>
            <option value="textarea">Long text</option>
            <option value="number">Number</option>
            <option value="checkbox">Checkbox</option>
          </select>
          <button type="button" onClick={addCatProp} disabled={!newPropName.trim()}>Add field</button>
          {catPropsSaved && <span style={{ color: "var(--gold)", fontSize: 13 }}>Saved ✓</span>}
        </div>
      </div>

      <div className="panel admin-wide">
        <div className="section-heading">
          <div>
            <h2>Review queue</h2>
            <p className="muted">AI edits and imported material marked unapproved stay visible to GMs here, but remain hidden from players until approved.</p>
          </div>
          {reviews.length > 0 && (
            <div className="member-actions">
              <button type="button" onClick={() => decideAll("approved")} disabled={bulkBusy}>Approve all ({reviews.length})</button>
              <button type="button" className="secondary danger" onClick={() => decideAll("rejected")} disabled={bulkBusy}>Reject all</button>
            </div>
          )}
        </div>
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

      {publicSlug && (
        <div className="panel admin-wide">
          <div className="section-heading">
            <div>
              <h2>Fork proposals</h2>
              <p className="muted">Changes submitted by people who cloned your public world at <code>/site/{publicSlug}</code>.</p>
            </div>
          </div>
          <div className="review-list">
            {proposals.map((p) => (
              <article key={p.id} className="review-row">
                <div>
                  <strong>{p.title}</strong>
                  <span className="tag-chip" style={{ marginLeft: 6 }}>{p.status}</span>
                  <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{p.description}</p>
                  <p style={{ fontSize: 12 }}>
                    From <strong>{p.fromCampaignName || `Campaign #${p.fromCampaignId}`}</strong> by {p.createdByName} · {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                  {p.pages.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.pages.map((slug) => (
                        <a key={slug} href={`/campaigns/${campaign.id}/pages/${slug}`} className="tag-chip" style={{ fontSize: 11 }}>
                          {slug}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {p.status === "pending" && (
                  <div className="member-actions">
                    <button type="button" onClick={async () => {
                      await fetch(`/api/campaigns/${campaign.id}/fork-proposals`, { method: "PATCH", body: JSON.stringify({ proposalId: p.id, status: "accepted" }) });
                      setProposals((ps) => ps.map((x) => x.id === p.id ? { ...x, status: "accepted" } : x));
                      setProposalMsg("Proposal accepted.");
                    }}>Accept</button>
                    <button type="button" className="secondary danger" onClick={async () => {
                      await fetch(`/api/campaigns/${campaign.id}/fork-proposals`, { method: "PATCH", body: JSON.stringify({ proposalId: p.id, status: "rejected" }) });
                      setProposals((ps) => ps.map((x) => x.id === p.id ? { ...x, status: "rejected" } : x));
                      setProposalMsg("Proposal rejected.");
                    }}>Reject</button>
                  </div>
                )}
              </article>
            ))}
            {!proposals.length && <p className="muted">No fork proposals yet.</p>}
            {proposalMsg && <p style={{ color: "var(--gold)", fontSize: 13 }}>{proposalMsg}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
