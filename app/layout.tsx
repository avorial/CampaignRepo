import type { Metadata } from "next";
import "./globals.css";
import CommandPalette from "./components/command-palette";

export const metadata: Metadata = {
  title: "CampaignRepo",
  description: "GitHub-backed RPG campaign wiki"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&family=Cinzel:wght@400..700&family=Cormorant+Garamond:wght@400;500;600;700&family=Uncial+Antiqua&family=IM+Fell+English&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <CommandPalette />
      </body>
    </html>
  );
}
