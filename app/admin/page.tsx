import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AdminUsersClient from "./users-client";

export default async function GlobalAdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (!user.isAdmin) redirect("/dashboard");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <Link href="/dashboard" className="quiet-link">Dashboard</Link>
          <h1>Global Admin</h1>
          <p className="muted">Manage CampaignRepo accounts before campaign testing.</p>
        </div>
      </header>
      <AdminUsersClient currentUserId={user.id} />
    </main>
  );
}
