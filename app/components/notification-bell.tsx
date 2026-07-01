"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Notification = {
  id: number;
  campaignId: number | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function load() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d: { notifications: Notification[]; unread: number }) => {
        setUnread(d.unread || 0);
        setNotifications(d.notifications || []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAllRead: true }) });
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  }

  async function markRead(n: Notification) {
    if (n.readAt) return;
    await fetch(`/api/notifications/${n.id}`, { method: "POST" });
    setUnread((u) => Math.max(0, u - 1));
    setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item));
  }

  const visible = notifications.slice(0, 15);

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className={`notif-bell-btn${unread > 0 ? " has-unread" : ""}`}
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <span className="notif-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div
          className="notif-dropdown"
          role="dialog"
          aria-label="Notifications"
          aria-modal="true"
        >
          <div className="notif-dropdown-header">
            <strong>Notifications</strong>
            {unread > 0 && <button type="button" className="notif-mark-all" onClick={markAllRead}>Mark all read</button>}
          </div>
          {visible.length === 0 && <div className="notif-empty">No notifications yet.</div>}
          <ul className="notif-list" role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {visible.map((n) => (
              <li key={n.id} className={`notif-item${n.readAt ? " notif-read" : ""}`}>
                <button
                  type="button"
                  className="notif-item-btn"
                  onClick={() => markRead(n)}
                  aria-pressed={Boolean(n.readAt)}
                >
                  <span className="notif-item-title">{n.title}</span>
                  {n.body && <span className="notif-item-body">{n.body}</span>}
                  <span className="notif-item-meta">{new Date(n.createdAt).toLocaleDateString()}</span>
                </button>
                {n.link && (
                  <Link href={n.link} className="notif-item-link" onClick={() => markRead(n)}>
                    View →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
