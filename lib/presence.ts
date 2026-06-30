type EditorEntry = { userId: number; name: string; expiresAt: number };

// key: `${campaignId}:${slug}`
const store = new Map<string, Map<number, EditorEntry>>();

const TTL_MS = 45_000;

function key(campaignId: number, slug: string) {
  return `${campaignId}:${slug}`;
}

function prune(k: string) {
  const editors = store.get(k);
  if (!editors) return;
  const now = Date.now();
  for (const [uid, entry] of editors) {
    if (entry.expiresAt < now) editors.delete(uid);
  }
  if (editors.size === 0) store.delete(k);
}

export function heartbeat(campaignId: number, slug: string, userId: number, name: string) {
  const k = key(campaignId, slug);
  prune(k);
  if (!store.has(k)) store.set(k, new Map());
  store.get(k)!.set(userId, { userId, name, expiresAt: Date.now() + TTL_MS });
}

export function getEditors(campaignId: number, slug: string): { userId: number; name: string }[] {
  const k = key(campaignId, slug);
  prune(k);
  const editors = store.get(k);
  if (!editors) return [];
  return Array.from(editors.values()).map(({ userId, name }) => ({ userId, name }));
}

export function clearEditor(campaignId: number, slug: string, userId: number) {
  const k = key(campaignId, slug);
  store.get(k)?.delete(userId);
  prune(k);
}
