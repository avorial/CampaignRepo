export const SCENE_TYPES = [
  "recap",
  "exposition",
  "investigation",
  "social",
  "decision",
  "preparation",
  "travel",
  "combat",
  "action"
] as const;

export type SceneType = typeof SCENE_TYPES[number];

export const SCENE_TYPE_LABELS: Record<SceneType, string> = {
  recap: "Recap",
  exposition: "Exposition",
  investigation: "Investigation",
  social: "Social",
  decision: "Decision",
  preparation: "Preparation",
  travel: "Travel",
  combat: "Combat",
  action: "Action"
};

export type ReadinessAgendaItem = {
  text: string;
  done?: boolean;
  sceneType?: SceneType;
  duration?: number;
  externalAction?: boolean;
};

export type SessionReadiness = {
  score: number;
  expectedMinutes: number;
  typedScenes: number;
  totalScenes: number;
  activeMinutes: number;
  actionMinutes: number;
  varietyCount: number;
  repeatedSceneTypes: number;
  notes: string[];
};

const DEFAULT_MINUTES: Record<SceneType, number> = {
  recap: 5,
  exposition: 10,
  investigation: 20,
  social: 15,
  decision: 10,
  preparation: 10,
  travel: 15,
  combat: 30,
  action: 20
};

const ACTIVE_TYPES = new Set<SceneType>(["investigation", "combat", "action", "social", "travel"]);

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isSceneType(value: unknown): value is SceneType {
  return typeof value === "string" && SCENE_TYPES.includes(value as SceneType);
}

export function normalizeSceneType(value: unknown): SceneType | undefined {
  return isSceneType(value) ? value : undefined;
}

export function defaultSceneDuration(sceneType: SceneType | undefined): number {
  return sceneType ? DEFAULT_MINUTES[sceneType] : 10;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function analyzeSessionAgenda(agenda: ReadinessAgendaItem[]): SessionReadiness {
  const scenes = agenda.filter((item) => item.text.trim().length > 0);
  const notes: string[] = [];
  if (scenes.length === 0) {
    return {
      score: 0,
      expectedMinutes: 0,
      typedScenes: 0,
      totalScenes: 0,
      activeMinutes: 0,
      actionMinutes: 0,
      varietyCount: 0,
      repeatedSceneTypes: 0,
      notes: ["Add a few planned beats before judging readiness."]
    };
  }

  let expectedMinutes = 0;
  let activeMinutes = 0;
  let actionMinutes = 0;
  let typedScenes = 0;
  let repeatedSceneTypes = 0;
  let previousType: SceneType | undefined;
  const typesUsed = new Set<SceneType>();

  for (const scene of scenes) {
    const sceneType = normalizeSceneType(scene.sceneType);
    const duration = Math.max(0, Math.round(Number(scene.duration) || defaultSceneDuration(sceneType)));
    expectedMinutes += duration;

    if (sceneType) {
      typedScenes += 1;
      typesUsed.add(sceneType);
      if (previousType === sceneType) repeatedSceneTypes += 1;
      previousType = sceneType;
      if (ACTIVE_TYPES.has(sceneType)) activeMinutes += duration;
    }

    if (scene.externalAction || sceneType === "combat" || sceneType === "action") {
      actionMinutes += duration;
    }
  }

  const typedRatio = typedScenes / scenes.length;
  const varietyGoal = Math.min(scenes.length, 4);
  const varietyRatio = Math.min(1, typesUsed.size / Math.max(1, varietyGoal));
  const activeRatio = expectedMinutes ? activeMinutes / expectedMinutes : 0;
  const actionRatio = expectedMinutes ? actionMinutes / expectedMinutes : 0;
  const repetitionPenalty = repeatedSceneTypes * 8;
  const durationPenalty = expectedMinutes < 90 ? 8 : expectedMinutes > 270 ? 12 : 0;
  const activeBalance = 1 - Math.min(1, Math.abs(activeRatio - 0.5) / 0.5);
  const actionBalance = 1 - Math.min(1, Math.abs(actionRatio - 0.35) / 0.65);

  const score = clampScore(
    typedRatio * 30 +
    varietyRatio * 25 +
    activeBalance * 20 +
    actionBalance * 15 +
    10 -
    repetitionPenalty -
    durationPenalty
  );

  if (typedRatio < 0.75) notes.push("Tag most beats with scene types so pacing can be judged.");
  if (typesUsed.size < varietyGoal) notes.push("Add another scene type to create more texture.");
  if (repeatedSceneTypes > 0) notes.push("Several adjacent beats use the same scene type.");
  if (expectedMinutes > 270) notes.push("Expected runtime is long; consider cutting or splitting beats.");
  if (expectedMinutes < 90) notes.push("Expected runtime is short; add optional scenes or deeper prep.");
  if (actionRatio < 0.2) notes.push("Low action pressure; add a beat with external stakes.");
  if (notes.length === 0) notes.push("Pacing looks ready for the table.");

  return {
    score,
    expectedMinutes,
    typedScenes,
    totalScenes: scenes.length,
    activeMinutes,
    actionMinutes,
    varietyCount: typesUsed.size,
    repeatedSceneTypes,
    notes
  };
}
