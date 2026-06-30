import YAML from "yaml";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import type { Campaign } from "@/lib/types";

const LEXICON_PATH = "wiki/lexicon.yaml";

export type LexiconEntry = {
  id: string;
  term: string;
  translation?: string;
  pronunciation?: string;
  wordClass?: string;
  etymology?: string;
  notes?: string;
};

export type LexiconPhonemes = {
  vowels?: string[];
  consonants?: string[];
};

export type LexiconData = {
  terms: LexiconEntry[];
  phonemes?: LexiconPhonemes;
  patterns?: string[];
};

function parse(text: string): LexiconData {
  let raw: Record<string, unknown> = {};
  try { raw = (YAML.parse(text) as Record<string, unknown>) || {}; } catch { /* ignore */ }
  const rawTerms = Array.isArray(raw.terms) ? raw.terms : [];
  const terms = (rawTerms as unknown[]).map((t) => {
    const entry = t as Record<string, unknown>;
    return {
      id: String(entry.id || slugify(String(entry.term || "")) || Math.random().toString(36).slice(2)),
      term: String(entry.term || ""),
      translation: entry.translation ? String(entry.translation) : undefined,
      pronunciation: entry.pronunciation ? String(entry.pronunciation) : undefined,
      wordClass: entry.wordClass ? String(entry.wordClass) : undefined,
      etymology: entry.etymology ? String(entry.etymology) : undefined,
      notes: entry.notes ? String(entry.notes) : undefined
    };
  }).filter((e) => e.term);
  const ph = raw.phonemes && typeof raw.phonemes === "object" && !Array.isArray(raw.phonemes) ? raw.phonemes as Record<string, unknown> : {};
  return {
    terms,
    phonemes: {
      vowels: Array.isArray(ph.vowels) ? (ph.vowels as unknown[]).map(String) : undefined,
      consonants: Array.isArray(ph.consonants) ? (ph.consonants as unknown[]).map(String) : undefined
    },
    patterns: Array.isArray(raw.patterns) ? (raw.patterns as unknown[]).map(String) : undefined
  };
}

function serialize(data: LexiconData): string {
  const obj: Record<string, unknown> = { terms: data.terms };
  if (data.phonemes?.vowels?.length || data.phonemes?.consonants?.length) obj.phonemes = data.phonemes;
  if (data.patterns?.length) obj.patterns = data.patterns;
  return YAML.stringify(obj);
}

function adapterFor(campaign: Campaign, userToken?: string | null) {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) throw new Error("No storage configured.");
  return storage;
}

export async function getLexicon(campaign: Campaign, userToken?: string | null): Promise<{ data: LexiconData; sha?: string }> {
  const storage = adapterFor(campaign, userToken);
  try {
    const file = await storage.getTextFile(LEXICON_PATH);
    return { data: parse(file.text), sha: file.sha };
  } catch (e) {
    if (isNotFoundError(e)) return { data: { terms: [] } };
    throw e;
  }
}

export async function saveLexicon(campaign: Campaign, data: LexiconData, sha: string | undefined, userToken?: string | null): Promise<string> {
  const storage = adapterFor(campaign, userToken);
  const result = await storage.putFile(LEXICON_PATH, serialize(data), "CampaignRepo: update lexicon", sha);
  return result.sha || "";
}

// ── Name generator ────────────────────────────────────────────────────────────

const DEFAULT_VOWELS = ["a", "e", "i", "o", "u", "ae", "ai", "ei", "ou"];
const DEFAULT_CONSONANTS = ["b", "d", "f", "g", "k", "l", "m", "n", "r", "s", "t", "v"];
const DEFAULT_PATTERNS = ["CVC", "CVCV", "CVCC", "CCVC", "CV"];

export function generateName(phonemes?: LexiconPhonemes, patterns?: string[], rng: () => number = Math.random): string {
  const vowels = phonemes?.vowels?.length ? phonemes.vowels : DEFAULT_VOWELS;
  const consonants = phonemes?.consonants?.length ? phonemes.consonants : DEFAULT_CONSONANTS;
  const pats = patterns?.length ? patterns : DEFAULT_PATTERNS;
  const pattern = pats[Math.floor(rng() * pats.length)];
  const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  let result = "";
  for (const ch of pattern) {
    if (ch === "V") result += pick(vowels);
    else if (ch === "C") result += pick(consonants);
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}
