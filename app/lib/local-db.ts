import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

export type PersistedThought = {
  id: string;
  title: string;
  content: string;
  type: string;
  project: string;
  tags: string[];
  createdAt: string;
  status: "inbox" | "active" | "archived";
  summary?: string;
  signals?: Array<{ kind: string; targetId?: string; message: string }>;
  nextStep?: string;
  embedding?: number[];
  originalContent?: string;
  primaryNodeId?: string;
  additionalNodeIds?: string[];
};

export type PersistedLink = {
  id: string;
  source: string;
  target: string;
  type: string;
  reason: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
};

export type PersistedKnowledgeNode = {
  id: string;
  name: string;
  kind: "area" | "direction" | "project";
  parentId?: string;
  createdAt: string;
  source: "ai" | "user" | "migration";
  confidence?: number;
  reason?: string;
  description?: string;
  status: "active" | "archived";
};

export type PersistedAiDecision = {
  id: string;
  thoughtId?: string;
  eventType:
    | "analysis_proposed"
    | "analysis_saved"
    | "analysis_cancelled"
    | "thought_edited"
    | "thought_deleted"
    | "thought_accepted"
    | "link_reviewed"
    | "batch_started"
    | "batch_paused"
    | "batch_completed"
    | "batch_failed"
    | "batch_continuation_blocked"
    | "pipeline_ai_call_planned"
    | "pipeline_ai_call_completed"
    | "pipeline_preflight"
    | "pipeline_extract"
    | "pipeline_embeddings"
    | "pipeline_cluster_plan"
    | "pipeline_cluster_assignment"
    | "pipeline_cluster"
    | "pipeline_hierarchy_plan"
    | "pipeline_hierarchy_assignment"
    | "pipeline_hierarchy_repair"
    | "pipeline_hierarchy"
    | "pipeline_candidates"
    | "pipeline_relations"
    | "pipeline_validated";
  createdAt: string;
  engine: "ollama" | "offline" | "user";
  model?: string;
  input?: unknown;
  output?: unknown;
  userAction?: string;
  changes?: unknown;
};

export type MindMapSnapshot = {
  thoughts: PersistedThought[];
  links: PersistedLink[];
  nodes: PersistedKnowledgeNode[];
  decisions: PersistedAiDecision[];
};

const DATABASE_NAME = "mindmap-local-semantic-v060";
const STORE_NAME = "database";
const DATABASE_KEY = "mindmap-v0.6.sqlite";

let sqlPromise: Promise<SqlJsStatic> | null = null;
let databasePromise: Promise<Database> | null = null;

function getSql() {
  sqlPromise ??= initSqlJs({
    locateFile: () => typeof window === "undefined"
      ? new URL("../../public/sql-wasm.wasm", import.meta.url).pathname
      : "/sql-wasm.wasm",
  });
  return sqlPromise;
}

function openIndexedDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDatabaseBytes() {
  const indexedDb = await openIndexedDb();
  return new Promise<Uint8Array | null>((resolve, reject) => {
    const transaction = indexedDb.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(DATABASE_KEY);
    request.onsuccess = () => {
      const value = request.result;
      resolve(value instanceof ArrayBuffer ? new Uint8Array(value) : null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => indexedDb.close();
  });
}

async function writeDatabaseBytes(bytes: Uint8Array) {
  const indexedDb = await openIndexedDb();
  const copy = bytes.slice().buffer;
  await new Promise<void>((resolve, reject) => {
    const transaction = indexedDb.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(copy, DATABASE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  indexedDb.close();
}

function createSchema(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS thoughts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      project TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      next_step TEXT,
      embedding_json TEXT,
      analysis_summary TEXT,
      signals_json TEXT
    )
  `);
  ensureColumn(database, "thoughts", "analysis_summary", "TEXT");
  ensureColumn(database, "thoughts", "signals_json", "TEXT");
  ensureColumn(database, "thoughts", "source_content", "TEXT");
  ensureColumn(database, "thoughts", "primary_node_id", "TEXT");
  ensureColumn(database, "thoughts", "additional_node_ids_json", "TEXT NOT NULL DEFAULT '[]'");
  database.run(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL
    )
  `);
  database.run("CREATE INDEX IF NOT EXISTS thoughts_project_idx ON thoughts(project)");
  database.run("CREATE INDEX IF NOT EXISTS thoughts_status_idx ON thoughts(status)");
  database.run("CREATE INDEX IF NOT EXISTS links_source_idx ON links(source)");
  database.run("CREATE INDEX IF NOT EXISTS links_target_idx ON links(target)");
  database.run(`
    CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      parent_id TEXT,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence REAL,
      reason TEXT,
      description TEXT,
      status TEXT NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS ai_decisions (
      id TEXT PRIMARY KEY,
      thought_id TEXT,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      engine TEXT NOT NULL,
      model TEXT,
      input_json TEXT,
      output_json TEXT,
      user_action TEXT,
      changes_json TEXT
    )
  `);
  database.run("CREATE INDEX IF NOT EXISTS knowledge_nodes_parent_idx ON knowledge_nodes(parent_id)");
  database.run("CREATE INDEX IF NOT EXISTS ai_decisions_thought_idx ON ai_decisions(thought_id)");
  database.run("CREATE INDEX IF NOT EXISTS ai_decisions_created_idx ON ai_decisions(created_at)");
}

function ensureColumn(database: Database, table: string, column: string, definition: string) {
  const columns = rows(database, `PRAGMA table_info(${table})`).map((row) => String(row.name));
  if (!columns.includes(column)) database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function getDatabase() {
  databasePromise ??= (async () => {
    const [SQL, savedBytes] = await Promise.all([getSql(), readDatabaseBytes()]);
    const database = savedBytes ? new SQL.Database(savedBytes) : new SQL.Database();
    createSchema(database);
    return database;
  })();
  return databasePromise;
}

function rows(database: Database, query: string) {
  const statement = database.prepare(query);
  const result: Record<string, unknown>[] = [];
  while (statement.step()) result.push(statement.getAsObject());
  statement.free();
  return result;
}

export async function loadSnapshot(seed: MindMapSnapshot): Promise<MindMapSnapshot> {
  const database = await getDatabase();
  const storedCounts = {
    thoughts: tableRowCount(database, "thoughts"),
    links: tableRowCount(database, "links"),
    nodes: tableRowCount(database, "knowledge_nodes"),
    decisions: tableRowCount(database, "ai_decisions"),
  };
  // During the v0.6 batch pipeline thoughts are intentionally materialized only
  // after every semantic stage succeeds. An in-progress run can therefore have
  // zero thoughts while its checkpoint journal already contains valuable work.
  // Seeding based on the thoughts table alone used to erase that journal on F5.
  if (shouldSeedSnapshot(storedCounts)) await saveSnapshot(seed);

  const thoughts = rows(database, "SELECT * FROM thoughts ORDER BY created_at DESC").map((row) => ({
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    type: String(row.type),
    project: String(row.project),
    tags: JSON.parse(String(row.tags_json || "[]")) as string[],
    createdAt: String(row.created_at),
    status: String(row.status) as PersistedThought["status"],
    summary: row.analysis_summary ? String(row.analysis_summary) : undefined,
    signals: row.signals_json
      ? (JSON.parse(String(row.signals_json)) as PersistedThought["signals"])
      : undefined,
    nextStep: row.next_step ? String(row.next_step) : undefined,
    embedding: row.embedding_json
      ? (JSON.parse(String(row.embedding_json)) as number[])
      : undefined,
    originalContent: row.source_content ? String(row.source_content) : String(row.content),
    primaryNodeId: row.primary_node_id ? String(row.primary_node_id) : undefined,
    additionalNodeIds: row.additional_node_ids_json
      ? (JSON.parse(String(row.additional_node_ids_json)) as string[])
      : [],
  }));
  const links = rows(database, "SELECT * FROM links").map((row) => ({
    id: String(row.id),
    source: String(row.source),
    target: String(row.target),
    type: String(row.type),
    reason: String(row.reason),
    confidence: Number(row.confidence),
    status: String(row.status) as PersistedLink["status"],
  }));
  let nodes: PersistedKnowledgeNode[] = rows(database, "SELECT * FROM knowledge_nodes ORDER BY created_at ASC").map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: String(row.kind) as PersistedKnowledgeNode["kind"],
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    createdAt: String(row.created_at),
    source: String(row.source) as PersistedKnowledgeNode["source"],
    confidence: row.confidence == null ? undefined : Number(row.confidence),
    reason: row.reason ? String(row.reason) : undefined,
    description: row.description ? String(row.description) : undefined,
    status: String(row.status) as PersistedKnowledgeNode["status"],
  }));
  const decisions = rows(database, "SELECT * FROM ai_decisions ORDER BY created_at ASC").map((row) => ({
    id: String(row.id),
    thoughtId: row.thought_id ? String(row.thought_id) : undefined,
    eventType: String(row.event_type) as PersistedAiDecision["eventType"],
    createdAt: String(row.created_at),
    engine: String(row.engine) as PersistedAiDecision["engine"],
    model: row.model ? String(row.model) : undefined,
    input: parseJson(row.input_json),
    output: parseJson(row.output_json),
    userAction: row.user_action ? String(row.user_action) : undefined,
    changes: parseJson(row.changes_json),
  }));

  if (nodes.length === 0) {
    const migrated = migrateLegacyProjects(thoughts);
    nodes = migrated.nodes;
    migrated.primaryByThought.forEach((nodeId, thoughtId) => {
      const thought = thoughts.find((item) => item.id === thoughtId);
      if (thought && !thought.primaryNodeId) thought.primaryNodeId = nodeId;
    });
  }
  return { thoughts, links, nodes, decisions };
}

export function shouldSeedSnapshot(counts: {
  thoughts: number;
  links: number;
  nodes: number;
  decisions: number;
}) {
  return Object.values(counts).every((count) => count === 0);
}

function tableRowCount(database: Database, table: "thoughts" | "links" | "knowledge_nodes" | "ai_decisions") {
  return Number(rows(database, `SELECT COUNT(*) AS count FROM ${table}`)[0]?.count ?? 0);
}

export async function saveSnapshot(snapshot: MindMapSnapshot) {
  const database = await getDatabase();
  database.run("BEGIN");
  try {
    database.run("DELETE FROM links");
    database.run("DELETE FROM thoughts");
    database.run("DELETE FROM knowledge_nodes");
    database.run("DELETE FROM ai_decisions");
    const thoughtStatement = database.prepare(`
      INSERT INTO thoughts
      (id, title, content, type, project, tags_json, created_at, status, next_step, embedding_json, analysis_summary, signals_json, source_content, primary_node_id, additional_node_ids_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const thought of snapshot.thoughts) {
      thoughtStatement.run([
        thought.id,
        thought.title,
        thought.content,
        thought.type,
        thought.project,
        JSON.stringify(thought.tags),
        thought.createdAt,
        thought.status,
        thought.nextStep ?? null,
        thought.embedding ? JSON.stringify(thought.embedding) : null,
        thought.summary ?? null,
        thought.signals?.length ? JSON.stringify(thought.signals) : null,
        thought.originalContent ?? thought.content,
        thought.primaryNodeId ?? null,
        JSON.stringify(thought.additionalNodeIds ?? []),
      ]);
    }
    thoughtStatement.free();

    const linkStatement = database.prepare(`
      INSERT INTO links (id, source, target, type, reason, confidence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const link of snapshot.links) {
      linkStatement.run([
        link.id,
        link.source,
        link.target,
        link.type,
        link.reason,
        link.confidence,
        link.status,
      ]);
    }
    linkStatement.free();

    const nodeStatement = database.prepare(`
      INSERT INTO knowledge_nodes
      (id, name, kind, parent_id, created_at, source, confidence, reason, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const node of snapshot.nodes) {
      nodeStatement.run([
        node.id,
        node.name,
        node.kind,
        node.parentId ?? null,
        node.createdAt,
        node.source,
        node.confidence ?? null,
        node.reason ?? null,
        node.description ?? null,
        node.status,
      ]);
    }
    nodeStatement.free();

    const decisionStatement = database.prepare(`
      INSERT INTO ai_decisions
      (id, thought_id, event_type, created_at, engine, model, input_json, output_json, user_action, changes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const decision of snapshot.decisions) {
      decisionStatement.run([
        decision.id,
        decision.thoughtId ?? null,
        decision.eventType,
        decision.createdAt,
        decision.engine,
        decision.model ?? null,
        decision.input === undefined ? null : JSON.stringify(decision.input),
        decision.output === undefined ? null : JSON.stringify(decision.output),
        decision.userAction ?? null,
        decision.changes === undefined ? null : JSON.stringify(decision.changes),
      ]);
    }
    decisionStatement.free();
    database.run("COMMIT");
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
  await writeDatabaseBytes(database.export());
}

export async function exportDatabase() {
  const database = await getDatabase();
  return database.export();
}

export async function importDatabase(bytes: Uint8Array) {
  const SQL = await getSql();
  const imported = new SQL.Database(bytes);
  createSchema(imported);
  const tables = rows(
    imported,
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('thoughts', 'links')",
  );
  if (tables.length !== 2) {
    imported.close();
    throw new Error("invalid_mindmap_database");
  }
  const current = await databasePromise;
  current?.close();
  databasePromise = Promise.resolve(imported);
  await writeDatabaseBytes(imported.export());
}

function parseJson(value: unknown) {
  if (!value) return undefined;
  try {
    return JSON.parse(String(value)) as unknown;
  } catch {
    return undefined;
  }
}

function migrateLegacyProjects(thoughts: PersistedThought[]) {
  const nodes: PersistedKnowledgeNode[] = [];
  const primaryByThought = new Map<string, string>();
  const ids = new Map<string, string>();
  for (const thought of thoughts) {
    const name = thought.project?.trim();
    if (!name || name === "Без проекта") continue;
    let id = ids.get(name.toLocaleLowerCase("ru"));
    if (!id) {
      id = `migrated-${stableHash(name)}`;
      ids.set(name.toLocaleLowerCase("ru"), id);
      nodes.push({
        id,
        name,
        kind: "project",
        createdAt: thought.createdAt || new Date().toISOString(),
        source: "migration",
        reason: "Перенесено из поля проекта предыдущей версии.",
        status: "active",
      });
    }
    primaryByThought.set(thought.id, id);
  }
  return { nodes, primaryByThought };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
