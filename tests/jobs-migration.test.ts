import { expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

it("upgrades existing queued jobs without losing their due time", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "campaignrepo-job-migration-"));
  const filename = path.join(directory, "legacy.sqlite");
  const legacy = new Database(filename);
  legacy.exec("CREATE TABLE pending_jobs (campaignId INTEGER NOT NULL, kind TEXT NOT NULL, dueAt INTEGER NOT NULL, PRIMARY KEY (campaignId, kind))");
  legacy.prepare("INSERT INTO pending_jobs VALUES (777, 'sync', 12345)").run();
  legacy.close();
  const original = process.env.CAMPAIGNREPO_DB;
  process.env.CAMPAIGNREPO_DB = filename;
  let db: Database.Database | undefined;
  try {
    const { getDb } = await import("@/lib/db");
    db = getDb();
    expect(db.prepare("SELECT * FROM pending_jobs WHERE campaignId = 777").get()).toEqual({ campaignId: 777, kind: "sync", dueAt: 12345, revision: 0, attempts: 0, lastError: null });
  } finally {
    db?.close();
    if (original === undefined) delete process.env.CAMPAIGNREPO_DB;
    else process.env.CAMPAIGNREPO_DB = original;
    rmSync(directory, { recursive: true, force: true });
  }
});
