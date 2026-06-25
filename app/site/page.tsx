import type { Metadata } from "next";
import { listPublicSites } from "@/lib/db";
import PublicGalleryClient from "./gallery-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore worlds — CampaignRepo",
  description: "Browse public RPG campaigns published with CampaignRepo."
};

export default function PublicGalleryPage() {
  return <PublicGalleryClient sites={listPublicSites()} />;
}
