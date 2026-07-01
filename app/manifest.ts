import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CampaignRepo",
    short_name: "CampaignRepo",
    description: "GitHub-backed RPG campaign wiki & worldbuilding tool",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0e0b07",
    theme_color: "#0e0b07",
    orientation: "any",
    icons: [
      {
        src: "/brand/logo-dice.png",
        sizes: "any",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/brand/logo-dice.png",
        sizes: "any",
        type: "image/png",
        purpose: "any"
      }
    ],
    categories: ["productivity", "entertainment", "utilities"],
    shortcuts: [
      {
        name: "Dashboard",
        url: "/dashboard",
        description: "View all campaigns"
      }
    ]
  };
}
