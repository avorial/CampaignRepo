import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampaignRepo",
  description: "GitHub-backed RPG campaign wiki"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
