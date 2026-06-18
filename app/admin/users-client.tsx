"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/types";

type AdminUser = User & {
  campaignCount: number;
};

export default function AdminUsersClient({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [identityDraft, setIdentityDraft] = useState({ name: "", email: "" });

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users || []);
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

  async function copyTemporaryPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setMessage("Temporary password copied.");
  }

  return (
    <section className="panel admin-wide">
      <div className="section-heading">
        <div>
          <h2>User accounts</h2>
          <p className="muted">Edit login emails, reset passwords, disable accounts, and assign global admin access.</p>
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
              ) : (
                <>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <small>{user.campaignCount} campaign{user.campaignCount === 1 ? "" : "s"} - joined {user.createdAt}</small>
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
    </section>
  );
}
