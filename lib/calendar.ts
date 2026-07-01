import YAML from "yaml";
import { getStorageAdapter } from "@/lib/storage";
import type { Campaign } from "@/lib/types";

import type { WorldDate } from "@/lib/types";
export type { WorldDate };
export type CalendarMonth = { name: string; days: number };
export type Holiday = { name: string; month: number; day: number };
export type CalendarConfig = {
  months: CalendarMonth[];
  weekdays: string[];
  eraName?: string;
  currentDate: WorldDate;
  holidays?: Holiday[];
};

const campaignConfigPath = "wiki/campaign.yaml";

export function defaultCalendar(): CalendarConfig {
  return {
    months: Array.from({ length: 12 }, (_, i) => ({ name: `Month ${i + 1}`, days: 30 })),
    weekdays: ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"],
    eraName: "",
    currentDate: { year: 1, month: 1, day: 1 }
  };
}

export function daysInYear(cal: CalendarConfig): number {
  return cal.months.reduce((sum, m) => sum + Math.max(1, m.days), 0);
}

export function sanitizeCalendar(raw: unknown): CalendarConfig {
  if (!raw || typeof raw !== "object") return defaultCalendar();
  const r = raw as Partial<CalendarConfig>;
  const months = Array.isArray(r.months) && r.months.length
    ? r.months.map((m, i) => ({ name: String((m as CalendarMonth)?.name || `Month ${i + 1}`), days: Math.max(1, Math.floor(Number((m as CalendarMonth)?.days) || 30)) }))
    : defaultCalendar().months;
  const weekdays = Array.isArray(r.weekdays) && r.weekdays.length ? r.weekdays.map((w) => String(w)).filter(Boolean) : defaultCalendar().weekdays;
  const cd = (r.currentDate || {}) as Partial<WorldDate>;
  const holidays: Holiday[] | undefined = Array.isArray(r.holidays)
    ? (r.holidays as unknown[])
        .filter((h) => h && typeof h === "object")
        .map((h) => {
          const ho = h as Partial<Holiday>;
          const month = Math.max(1, Math.min(months.length, Math.floor(Number(ho.month) || 1)));
          return { name: String(ho.name || ""), month, day: Math.max(1, Math.min(months[month - 1]?.days || 30, Math.floor(Number(ho.day) || 1))) };
        })
        .filter((h) => h.name)
    : undefined;
  const cal: CalendarConfig = {
    months,
    weekdays: weekdays.length ? weekdays : defaultCalendar().weekdays,
    eraName: r.eraName ? String(r.eraName) : "",
    currentDate: {
      year: Math.max(1, Math.floor(Number(cd.year) || 1)),
      month: Math.min(months.length, Math.max(1, Math.floor(Number(cd.month) || 1))),
      day: 1
    },
    ...(holidays?.length ? { holidays } : {})
  };
  cal.currentDate.day = Math.min(months[cal.currentDate.month - 1].days, Math.max(1, Math.floor(Number(cd.day) || 1)));
  return cal;
}

/** Absolute day index from {year:1, month:1, day:1} (=0). No leap rules. */
export function toAbsoluteDay(cal: CalendarConfig, date: WorldDate): number {
  const yearDays = daysInYear(cal);
  let days = (date.year - 1) * yearDays;
  for (let i = 0; i < date.month - 1 && i < cal.months.length; i++) days += cal.months[i].days;
  return days + (date.day - 1);
}

export function fromAbsoluteDay(cal: CalendarConfig, absolute: number): WorldDate {
  const yearDays = daysInYear(cal);
  const abs = Math.max(0, absolute);
  let year = Math.floor(abs / yearDays) + 1;
  let rem = abs % yearDays;
  let month = 1;
  for (const m of cal.months) {
    if (rem < m.days) break;
    rem -= m.days;
    month++;
  }
  if (month > cal.months.length) month = cal.months.length;
  return { year, month, day: rem + 1 };
}

export function addDays(cal: CalendarConfig, date: WorldDate, delta: number): WorldDate {
  return fromAbsoluteDay(cal, toAbsoluteDay(cal, date) + delta);
}

export function weekdayName(cal: CalendarConfig, date: WorldDate): string {
  const idx = ((toAbsoluteDay(cal, date) % cal.weekdays.length) + cal.weekdays.length) % cal.weekdays.length;
  return cal.weekdays[idx];
}

export function formatDate(cal: CalendarConfig, date: WorldDate): string {
  const month = cal.months[Math.min(cal.months.length, Math.max(1, date.month)) - 1];
  const era = cal.eraName ? ` ${cal.eraName}` : "";
  return `${weekdayName(cal, date)}, ${date.day} ${month?.name || ""}, ${date.year}${era}`;
}

export async function loadCampaignCalendar(campaign: Campaign, userToken?: string | null): Promise<CalendarConfig> {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) return defaultCalendar();
  try {
    const file = await storage.getTextFile(campaignConfigPath);
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    return sanitizeCalendar(parsed?.calendar);
  } catch {
    return defaultCalendar();
  }
}

export async function saveCampaignCalendar(campaign: Campaign, config: CalendarConfig, userToken?: string | null): Promise<CalendarConfig> {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) throw new Error("No storage configured for this campaign.");
  let yaml: Record<string, unknown> = {};
  let sha: string | undefined;
  try {
    const file = await storage.getTextFile(campaignConfigPath);
    sha = file.sha;
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object") yaml = parsed;
  } catch { /* file not found yet */ }
  const clean = sanitizeCalendar(config);
  yaml.calendar = clean;
  await storage.putFile(campaignConfigPath, YAML.stringify(yaml), "CampaignRepo: update calendar", sha);
  return clean;
}
