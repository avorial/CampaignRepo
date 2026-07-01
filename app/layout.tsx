import type { Metadata } from "next";
import "./globals.css";
import "./theme-presets.css";
import CommandPalette from "./components/command-palette";

export const metadata: Metadata = {
  title: "CampaignRepo",
  description: "Git-backed RPG campaign platform for Game Masters",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "CampaignRepo", statusBarStyle: "black-translucent" },
  other: { "mobile-web-app-capable": "yes" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0d0d0f" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400..700&family=Cormorant+Garamond:wght@400;500;600;700&family=EB+Garamond:wght@400;500;600;700&family=Exo+2:wght@300;400;500;600&family=Fraunces:opsz,wght@9..144,300..700&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IM+Fell+English&family=JetBrains+Mono:wght@400;500;600&family=Lora:wght@400;500;600&family=Orbitron:wght@400;500;600;700&family=Oswald:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&family=Uncial+Antiqua&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <CommandPalette />
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(()=>{})}` }} />
      </body>
    </html>
  );
}
