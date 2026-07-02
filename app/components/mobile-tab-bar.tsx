"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BookOpen, Inbox, Users } from "lucide-react";

/**
 * Thumb-reachable bottom tab bar — phones only (CSS-gated via `.mtabs`).
 * Renders globally from the root layout and derives its state from the URL, so
 * the campaign tabs (Wiki / Review / Portal) stay in context while "Repos"
 * jumps back to the dashboard. Hidden on every non-campaign route.
 */
export default function MobileTabBar() {
  const pathname = usePathname() || "";
  const match = pathname.match(/^\/campaigns\/(\d+)/);
  if (!match) return null;

  const id = match[1];
  const sub = pathname.slice(match[0].length);
  const onPortal = sub.startsWith("/player");
  const onReview = sub.startsWith("/admin");
  const onWiki = !onPortal && !onReview;

  const tabs = [
    { key: "repos", label: "Repos", href: "/dashboard", Icon: LayoutGrid, active: false },
    { key: "wiki", label: "Wiki", href: `/campaigns/${id}`, Icon: BookOpen, active: onWiki },
    { key: "review", label: "Review", href: `/campaigns/${id}/admin`, Icon: Inbox, active: onReview },
    { key: "portal", label: "Portal", href: `/campaigns/${id}/player`, Icon: Users, active: onPortal },
  ];

  return (
    <nav className="mtabs" aria-label="Primary navigation">
      {tabs.map(({ key, label, href, Icon, active }) => (
        <Link
          key={key}
          href={href}
          className={active ? "mtab is-active" : "mtab"}
          aria-current={active ? "page" : undefined}
        >
          <Icon size={21} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
