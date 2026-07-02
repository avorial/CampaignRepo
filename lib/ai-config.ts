import type { AiConfig } from "@/lib/types";
import { getUserAiSettings } from "@/lib/db";
import { isNotFoundError, type StorageAdapter } from "@/lib/storage";

export const CAMPAIGN_AI_CONFIG_PATH = "wiki/.ai-config.json";

export function normalizeAiEndpoint(value?: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.port && /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) url.port = "11434";
    if (url.pathname === "/" || !url.pathname) url.pathname = "/v1";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

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

function modelsUrl(endpoint: string): string {
  const clean = endpoint.replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/models` : `${clean}/v1/models`;
}

function normalizeModelName(value: string): string {
  return value
    .toLowerCase()
    .replace(/([-_:]?local|[-_:]?latest)$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

async function resolveModelAlias(endpoint: string, requestedModel: string, headers: Record<string, string>) {
  if (!requestedModel) return "";
  try {
    const models = await listAiModels(endpoint, headers);
    if (models.includes(requestedModel)) return requestedModel;
    const normalized = normalizeModelName(requestedModel);
    return models.find((model) => normalizeModelName(model) === normalized) || requestedModel;
  } catch {
    return requestedModel;
  }
}

export async function listAiModels(endpoint: string, headers: Record<string, string> = {}): Promise<string[]> {
  const cleanEndpoint = normalizeAiEndpoint(endpoint);
  const res = await fetch(modelsUrl(cleanEndpoint), { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not list AI models (${res.status}): ${text.slice(0, 180)}`);
  }
  const data = await res.json() as { data?: Array<{ id?: string }> };
  return (data.data || []).map((item) => item.id || "").filter(Boolean);
}

export async function testAiConnection(config: AiConfig): Promise<AiConfig> {
  const endpoint = normalizeAiEndpoint(config.endpoint);
  if (!endpoint) return config;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const model = await resolveModelAlias(endpoint, config.model || "llama3.2", headers);

  const res = await fetch(chatCompletionsUrl(endpoint), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Reply with ok." },
        { role: "user", content: "Connection test." }
      ],
      temperature: 0,
      max_tokens: 8
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI endpoint test failed (${res.status}): ${text.slice(0, 180)}`);
  }

  return { ...config, endpoint, model };
}
