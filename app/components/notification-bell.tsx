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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button type="button" className={`notif-bell-btn${unread > 0 ? " has-unread" : ""}`} onClick={toggle} aria-label="Notifications">
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <strong>Notifications</strong>
            {unread > 0 && <button type="button" className="notif-mark-all" onClick={markAllRead}>Mark all read</button>}
          </div>
          {notifications.length === 0 && <div className="notif-empty">No notifications yet.</div>}
          {notifications.slice(0, 15).map((n) => (
            <div
              key={n.id}
              className={`notif-item${n.readAt ? " notif-read" : ""}`}
              onClick={() => markRead(n)}
            >
              <div className="notif-item-title">{n.title}</div>
              {n.body && <div className="notif-item-body">{n.body}</div>}
              <div className="notif-item-meta">{new Date(n.createdAt).toLocaleDateString()}</div>
              {n.link && (
                <Link href={n.link} className="notif-item-link" onClick={() => markRead(n)}>
                  View →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
