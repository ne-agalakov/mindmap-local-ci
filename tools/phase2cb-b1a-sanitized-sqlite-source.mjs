import { DatabaseSync } from "node:sqlite";
import { chmod, readFile, stat } from "node:fs/promises";
import { canonicalJson } from "../storage/canonical-json.ts";

export function createSanitizedPhase2CbSqliteFixture(path, candidate) {
  const database = new DatabaseSync(path);
  try {
    database.exec(`
      PRAGMA journal_mode=DELETE;
      CREATE TABLE phase2cb_fixture (
        fixture_id TEXT PRIMARY KEY,
        candidate_json TEXT NOT NULL
      );
    `);
    database.prepare(
      "INSERT INTO phase2cb_fixture (fixture_id, candidate_json) VALUES (?, ?)",
    ).run("sanitized-b1a", canonicalJson(candidate));
  } finally {
    database.close();
  }
  return chmod(path, 0o444);
}

export class SanitizedPhase2CbSqliteSourceAdapter {
  mode = "sanitized-fixture";

  constructor({ path, sourceId, hashBytes }) {
    this.path = path;
    this.sourceId = sourceId;
    this.hashBytes = hashBytes;
  }

  async snapshot() {
    try {
      const [info, bytes] = await Promise.all([stat(this.path), readFile(this.path)]);
      return {
        exists: true,
        sizeBytes: bytes.byteLength,
        sha256: await this.hashBytes(bytes),
        modifiedTimeMs: info.mtimeMs,
      };
    } catch (error) {
      if (error?.code === "ENOENT") return { exists: false, sizeBytes: 0, sha256: "" };
      throw error;
    }
  }

  async readCandidate() {
    const database = new DatabaseSync(this.path, { readOnly: true });
    try {
      const row = database.prepare(
        "SELECT candidate_json FROM phase2cb_fixture WHERE fixture_id = ?",
      ).get("sanitized-b1a");
      if (!row || typeof row.candidate_json !== "string") throw new Error("sanitized_fixture_payload_missing");
      return JSON.parse(row.candidate_json);
    } finally {
      database.close();
    }
  }
}
