import type { AiConfig } from "@/lib/types";
import { getUserAiSettings } from "@/lib/db";
import { isNotFoundError, type StorageAdapter } from "@/lib/storage";

export const CAMPAIGN_AI_CONFIG_PATH = "wiki/.ai-config.json";

export function maskAiConfig(config: AiConfig): AiConfig {
  return {
    endpoint: config.endpoint || "",
    model: config.model || "",
    apiKey: config.apiKey ? "••••••••" : ""
  };
}

export async function readCampaignAiConfig(storage: StorageAdapter): Promise<AiConfig> {
  try {
    const file = await storage.getTextFile(CAMPAIGN_AI_CONFIG_PATH);
    return JSON.parse(file.text) as AiConfig;
  } catch (error) {
    if (isNotFoundError(error)) return {};
    throw error;
  }
}

export async function getEffectiveAiConfig(userId: number, storage: StorageAdapter): Promise<AiConfig> {
  const campaignConfig = await readCampaignAiConfig(storage);
  if (campaignConfig.endpoint) return campaignConfig;
  return getUserAiSettings(userId);
}

export function chatCompletionsUrl(endpoint: string): string {
  const clean = endpoint.replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}
