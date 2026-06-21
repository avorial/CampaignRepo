"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@/lib/types";

type AdminUser = User & {
  campaignCount: number;
  campaigns: Array<{ id: number; name: string; owner: string; repo: string; role: string }>;
};

type AdminCampaign = {
  id: number;
  name: string;
  owner: string;
  repo: string;
};

export default function AdminUsersClient({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [identityDraft, setIdentityDraft] = useState({ name: "", email: "" });
  const [createDraft, setCreateDraft] = useState({ name: "", email: "", isAdmin: false });

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users || []);
      setCampaigns(data.campaigns || []);
    }
    else setMessage(data.error || "Could not load users.");
  }

  useEffect(() => {
    load();
  }, []);

  async function updateUser(body: Record<string, unknown>) {
    setTemporaryPassword("");
    const res = await fetch("/api/admin/users", { method: "PATCH", body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users || []);
      setCampaigns(data.campaigns || []);
      if (data.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword);
        setMessage("Temporary password created. Copy it now.");
      } else {
        setMessage("User updated.");
      }
      return true;
    }

    setMessage(data.error || "User update failed.");
    return false;
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTemporaryPassword("");
    setMessage("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(createDraft)
    });
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users || []);
      setCampaigns(data.campaigns || []);
      setTemporaryPassword(data.temporaryPassword || "");
      setCreateDraft({ name: "", email: "", isAdmin: false });
      setMessage("Account created. Copy the temporary password now.");
      return;
    }
    setMessage(data.error || "User creation failed.");
  }

  function startIdentityEdit(user: AdminUser) {
    setEditingUserId(user.id);
    setIdentityDraft({ name: user.name, email: user.email });
    setMessage("");
    setTemporaryPassword("");
  }

  async function saveIdentity(userId: number) {
    const saved = await updateUser({
      action: "update-identity",
      userId,
      name: identityDraft.name,
      email: identityDraft.email
    });
    if (saved) setEditingUserId(null);
  }

  function userCampaignRole(user: AdminUser, campaignId: number) {
    return user.campaigns.find((campaign) => campaign.id === campaignId)?.role || "";
  }

  async function setCampaignMembership(userId: number, campaignId: number, role: "gm" | "player" | null) {
    await updateUser({
      action: "set-campaign-membership",
      userId,
      campaignId,
      role
    });
  }

  async function copyTemporaryPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setMessage("Temporary password copied.");
  }

  return (
    <section className="admin-stack">
      <div className="panel admin-wide">
        <div className="section-heading">
          <div>
            <h2>Create account</h2>
            <p className="muted">Manually create a CampaignRepo login. The user receives a temporary password and must change it on first sign-in.</p>
          </div>
        </div>
        <form className="identity-editor" onSubmit={createUser}>
          <label>
            <span>Name</span>
            <input
              value={createDraft.name}
              onChange={(event) => setCreateDraft((draft) => ({ ...draft, name: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Email login</span>
            <input
              type="email"
              value={createDraft.email}
              onChange={(event) => setCreateDraft((draft) => ({ ...draft, email: event.target.value }))}
              required
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={createDraft.isAdmin}
              onChange={(event) => setCreateDraft((draft) => ({ ...draft, isAdmin: event.target.checked }))}
            />
            <span>Global admin</span>
          </label>
          <button type="submit">Create account</button>
        </form>
      </div>

      <div className="panel admin-wide">
        <div className="section-heading">
          <div>
            <h2>User accounts</h2>
            <p className="muted">Edit login emails, reset passwords, disable accounts, assign global admin access, and see campaign memberships.</p>
          </div>
        </div>

        {temporaryPassword && (
          <div className="admin-secret">
            <span>Temporary password</span>
            <code>{temporaryPassword}</code>
            <button type="button" className="secondary" onClick={copyTemporaryPassword}>
              Copy
            </button>
          </div>
        )}

        <div className="user-admin-list">
          {users.map((user) => (
            <article key={user.id} className="user-admin-row">
              <div className="user-identity">
                {editingUserId === user.id ? (
                  <div className="user-edit-panel">
                    <div className="identity-editor">
                      <label>
                        <span>Name</span>
                        <input
                          value={identityDraft.name}
                          onChange={(event) => setIdentityDraft((draft) => ({ ...draft, name: event.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Email login</span>
                        <input
                          type="email"
                          value={identityDraft.email}
                          onChange={(event) => setIdentityDraft((draft) => ({ ...draft, email: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="campaign-editor">
                      <span>Campaign access</span>
                      {campaigns.map((campaign) => {
                        const role = userCampaignRole(user, campaign.id);
                        const isOwner = role === "owner";
                        return (
                          <div key={campaign.id} className="campaign-editor-row">
                            <label className="checkbox-row">
                              <input
                                type="checkbox"
                                checked={Boolean(role)}
                                disabled={isOwner}
                                onChange={(event) => setCampaignMembership(user.id, campaign.id, event.target.checked ? "player" : null)}
                              />
                              <span>{campaign.name}</span>
                            </label>
                            <select
                              value={role === "gm" ? "gm" : "player"}
                              disabled={!role || isOwner}
                              onChange={(event) => setCampaignMembership(user.id, campaign.id, event.target.value as "gm" | "player")}
                            >
                              <option value="player">Player</option>
                              <option value="gm">GM</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <small>{user.campaignCount} campaign{user.campaignCount === 1 ? "" : "s"} - joined {user.createdAt}</small>
                    <div className="campaign-memberships">
                      {user.campaigns.length ? user.campaigns.map((campaign) => (
                        <a key={campaign.id} href={`/campaigns/${campaign.id}/admin`}>
                          {campaign.name} <span>{campaign.role}</span>
                        </a>
                      )) : <span>No campaigns yet</span>}
                    </div>
                  </>
                )}
              </div>
              <div className="badges">
                {user.isAdmin && <span>admin</span>}
                {user.mustChangePassword && <span>must change password</span>}
                {user.disabled && <span>disabled</span>}
              </div>
              <div className="member-actions">
                <button type="button" className="secondary" onClick={() => updateUser({ action: "reset-password", userId: user.id })}>
                  Reset Password
                </button>
                {editingUserId === user.id ? (
                  <>
                    <button type="button" onClick={() => saveIdentity(user.id)}>
                      Save User
                    </button>
                    <button type="button" className="secondary" onClick={() => setEditingUserId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="secondary" onClick={() => startIdentityEdit(user)}>
                    Edit User
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  disabled={user.id === currentUserId && user.isAdmin}
                  onClick={() => updateUser({ action: "set-admin", userId: user.id, isAdmin: !user.isAdmin })}
                >
                  {user.isAdmin ? "Remove Admin" : "Make Admin"}
                </button>
                <button
                  type="button"
                  className={user.disabled ? "secondary" : "danger"}
                  disabled={user.id === currentUserId}
                  onClick={() => updateUser({ action: "set-disabled", userId: user.id, disabled: !user.disabled })}
                >
                  {user.disabled ? "Enable" : "Disable"}
                </button>
              </div>
            </article>
          ))}
        </div>
        {message && <p className="toast">{message}</p>}
      </div>
    </section>
  );
}
