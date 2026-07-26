import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { MINDMAP_GRAPH_NAMESPACE } from "../graph-storage/contracts.ts";
import { replayGraphEvents } from "../graph-storage/graph-state.ts";
import { InMemoryGraphStorage } from "../graph-storage/in-memory-reference-storage.ts";

const namespace = MINDMAP_GRAPH_NAMESPACE;
const workspace = "synthetic";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashCanonical = (value) => sha256(value);
const hashPayload = (record) => sha256(
  record.encoding === "base64" || record.encoding === "float32-le-base64"
    ? Buffer.from(record.data, "base64")
    : Buffer.from(record.data, "utf8"),
);

const makeStorage = (options = {}) => new InMemoryGraphStorage({ hashCanonical, hashPayload, ...options });

function payload(kind, data, encoding = "utf8", mediaType = "text/plain; charset=utf-8", recordWorkspace = workspace) {
  const bytes = encoding === "base64" || encoding === "float32-le-base64"
    ? Buffer.from(data, "base64")
    : Buffer.from(data, "utf8");
  return {
    namespace,
    workspace: recordWorkspace,
    contentHash: sha256(bytes),
    kind,
    mediaType,
    encoding,
    byteLength: bytes.byteLength,
    data,
  };
}

function vectorPayload(values, recordWorkspace = workspace) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
  return payload("embedding-f32", bytes.toString("base64"), "float32-le-base64", "application/x-float32-le", recordWorkspace);
}

function graphEvent(sequence, type, record, id) {
  return {
    namespace,
    workspace: record.workspace,
    sequence,
    eventId: id,
    occurredAt: `2026-07-25T21:00:${String(sequence).padStart(2, "0")}.000Z`,
    payload: { type, record },
  };
}

function commitRequest(events, overrides = {}) {
  return {
    namespace,
    transactionId: overrides.transactionId ?? "transaction-1",
    idempotencyKey: overrides.idempotencyKey ?? "transaction-1:idem",
    workspace: overrides.workspace ?? workspace,
    expectedRevision: overrides.expectedRevision ?? 0,
    events,
  };
}

function fullFixture(recordWorkspace = workspace) {
  const text = payload("thought-text", "Synthetic graph contract thought.", "utf8", "text/plain; charset=utf-8", recordWorkspace);
  const areaTitle = payload("node-title", "Work", "utf8", "text/plain; charset=utf-8", recordWorkspace);
  const directionTitle = payload("node-title", "MindMap", "utf8", "text/plain; charset=utf-8", recordWorkspace);
  const projectTitle = payload("node-title", "Phase 2C-A", "utf8", "text/plain; charset=utf-8", recordWorkspace);
  const vector = vectorPayload([0.25, -0.5, 0.75], recordWorkspace);
  const area = { namespace, workspace: recordWorkspace, nodeId: "area-work", revision: 1, level: "area", titlePayloadHash: areaTitle.contentHash, createdAt: "2026-07-25T21:01:00.000Z", updatedAt: "2026-07-25T21:01:00.000Z" };
  const direction = { namespace, workspace: recordWorkspace, nodeId: "direction-mindmap", revision: 1, level: "direction", parentNodeId: area.nodeId, titlePayloadHash: directionTitle.contentHash, createdAt: "2026-07-25T21:02:00.000Z", updatedAt: "2026-07-25T21:02:00.000Z" };
  const project = { namespace, workspace: recordWorkspace, nodeId: "project-phase2ca", revision: 1, level: "project", parentNodeId: direction.nodeId, titlePayloadHash: projectTitle.contentHash, projectState: "active", createdAt: "2026-07-25T21:03:00.000Z", updatedAt: "2026-07-25T21:03:00.000Z" };
  const thought = { namespace, workspace: recordWorkspace, thoughtId: "thought-1", revision: 1, textPayloadHash: text.contentHash, semanticType: "observation", status: "active", createdAt: "2026-07-25T21:04:00.000Z", updatedAt: "2026-07-25T21:04:00.000Z" };
  const placement = { namespace, workspace: recordWorkspace, thoughtId: thought.thoughtId, revision: 1, kind: "placed", parentNodeId: project.nodeId, status: "confirmed", updatedAt: "2026-07-25T21:05:00.000Z" };
  const embedding = { namespace, workspace: recordWorkspace, embeddingId: "embedding-1", thoughtId: thought.thoughtId, revision: 1, model: "embeddinggemma", dimensions: 3, sourceTextContentHash: text.contentHash, vectorPayloadHash: vector.contentHash, createdAt: "2026-07-25T21:06:00.000Z" };
  const link = { namespace, workspace: recordWorkspace, linkId: "link-1", revision: 1, source: { kind: "thought", id: thought.thoughtId }, target: { kind: "node", id: project.nodeId }, kind: "related", status: "proposed", createdAt: "2026-07-25T21:07:00.000Z", updatedAt: "2026-07-25T21:07:00.000Z" };
  const rows = [
    ["payload_put", text, "payload-text"], ["payload_put", areaTitle, "payload-area"],
    ["payload_put", directionTitle, "payload-direction"], ["payload_put", projectTitle, "payload-project"],
    ["payload_put", vector, "payload-vector"], ["node_put", area, "node-area"],
    ["node_put", direction, "node-direction"], ["node_put", project, "node-project"],
    ["thought_put", thought, "thought"], ["placement_put", placement, "placement"],
    ["embedding_put", embedding, "embedding"], ["link_put", link, "link"],
  ];
  return {
    text, thought, embedding,
    events: rows.map(([type, record, id], index) => graphEvent(index + 1, type, record, `${recordWorkspace}-${id}`)),
  };
}

test("atomic transaction preserves graph content and deterministic replay semantics", async () => {
  const fixture = fullFixture();
  const graph = makeStorage();
  assert.equal((await graph.commit(commitRequest(fixture.events))).ok, true);
  const snapshot = await graph.exportSnapshot(workspace);
  assert.deepEqual(
    { payloads: snapshot.payloads.length, thoughts: snapshot.thoughts.length, nodes: snapshot.nodes.length, placements: snapshot.placements.length, links: snapshot.links.length, embeddings: snapshot.embeddings.length },
    { payloads: 5, thoughts: 1, nodes: 3, placements: 1, links: 1, embeddings: 1 },
  );
  assert.equal(snapshot.placements[0].kind, "placed");
  assert.equal(snapshot.links[0].status, "proposed");
  assert.match(snapshot.contentHash, /^[a-f0-9]{64}$/);
  const replayed = replayGraphEvents(workspace, await graph.loadEvents(workspace));
  assert.equal(replayed.revision, snapshot.revision);
  assert.equal(replayed.thoughts[0].thoughtId, snapshot.thoughts[0].thoughtId);
  assert.equal(replayed.nodes.length, snapshot.nodes.length);
  assert.equal(replayed.payloads.length, snapshot.payloads.length);
});

test("clean stores yield identical snapshot hashes and retries are idempotent", async () => {
  const fixture = fullFixture();
  const first = makeStorage();
  const second = makeStorage();
  const initial = await first.commit(commitRequest(fixture.events));
  assert.equal(initial.ok, true);
  assert.equal((await second.commit(commitRequest(fixture.events))).ok, true);
  assert.deepEqual(await second.exportSnapshot(workspace), await first.exportSnapshot(workspace));
  const repeated = await first.commit(commitRequest(fixture.events));
  assert.equal(repeated.ok, true);
  assert.equal(repeated.receipt.idempotent, true);
  const conflict = await first.commit(commitRequest(fixture.events, { transactionId: "different" }));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.rejection.code, "idempotency_conflict");
});

test("hash mismatch, missing placement and duplicate path leave no partial state", async () => {
  const graph = makeStorage();
  const invalidPayload = { ...payload("thought-text", "tampered"), contentHash: "0".repeat(64) };
  assert.equal((await graph.commit(commitRequest([graphEvent(1, "payload_put", invalidPayload, "bad-hash")]))).rejection.code, "payload_hash_mismatch");

  const text = payload("thought-text", "No placement");
  const thought = { namespace, workspace, thoughtId: "unplaced", revision: 1, textPayloadHash: text.contentHash, semanticType: "idea", status: "inbox", createdAt: "2026-07-25T21:10:00.000Z", updatedAt: "2026-07-25T21:10:00.000Z" };
  const incomplete = await graph.commit(commitRequest([
    graphEvent(1, "payload_put", text, "unplaced-payload"),
    graphEvent(2, "thought_put", thought, "unplaced-thought"),
  ], { transactionId: "unplaced", idempotencyKey: "unplaced:idem" }));
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.rejection.code, "invalid_placement");

  const title = payload("node-title", "Duplicate area");
  const areaOne = { namespace, workspace, nodeId: "area-1", revision: 1, level: "area", titlePayloadHash: title.contentHash, createdAt: "2026-07-25T21:11:00.000Z", updatedAt: "2026-07-25T21:11:00.000Z" };
  const duplicate = await graph.commit(commitRequest([
    graphEvent(1, "payload_put", title, "duplicate-title"),
    graphEvent(2, "node_put", areaOne, "area-1"),
    graphEvent(3, "node_put", { ...areaOne, nodeId: "area-2" }, "area-2"),
  ], { transactionId: "duplicate", idempotencyKey: "duplicate:idem" }));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.rejection.code, "duplicate_path");
  assert.equal((await graph.load(workspace)).revision, 0);
});

test("unresolved and damaged reference remain separate explicit states", async () => {
  const text = payload("thought-text", "Legacy target missing");
  const thought = { namespace, workspace, thoughtId: "damaged-thought", revision: 1, textPayloadHash: text.contentHash, semanticType: "observation", status: "inbox", createdAt: "2026-07-25T21:12:00.000Z", updatedAt: "2026-07-25T21:12:00.000Z" };
  const unresolved = { namespace, workspace, thoughtId: thought.thoughtId, revision: 1, kind: "unresolved", reason: "legacy_reference_damaged", updatedAt: "2026-07-25T21:12:00.000Z" };
  const damage = { namespace, workspace, damagedReferenceId: "damage-1", source: { kind: "thought", id: thought.thoughtId }, field: "primaryPlacement", target: { kind: "node", id: "missing-node" }, reason: "missing_target", detectedAt: "2026-07-25T21:12:00.000Z" };
  const graph = makeStorage();
  assert.equal((await graph.commit(commitRequest([
    graphEvent(1, "payload_put", text, "damage-payload"),
    graphEvent(2, "thought_put", thought, "damage-thought"),
    graphEvent(3, "placement_put", unresolved, "damage-placement"),
    graphEvent(4, "damaged_reference_put", damage, "damage-record"),
  ]))).ok, true);
  const state = await graph.load(workspace);
  assert.equal(state.placements[0].kind, "unresolved");
  assert.equal(state.damagedReferences.length, 1);
});

test("historical embeddings survive text revision but a new embedding must bind to current text", async () => {
  const fixture = fullFixture();
  const graph = makeStorage();
  assert.equal((await graph.commit(commitRequest(fixture.events))).ok, true);
  const baseRevision = fixture.events.length;
  const revisedText = payload("thought-text", "Revised synthetic thought.");
  const revisedThought = { ...fixture.thought, revision: 2, textPayloadHash: revisedText.contentHash, updatedAt: "2026-07-25T21:20:00.000Z" };
  assert.equal((await graph.commit(commitRequest([
    graphEvent(baseRevision + 1, "payload_put", revisedText, "revised-text"),
    graphEvent(baseRevision + 2, "thought_put", revisedThought, "revised-thought"),
  ], { expectedRevision: baseRevision, transactionId: "text-update", idempotencyKey: "text-update:idem" }))).ok, true);
  const state = await graph.load(workspace);
  assert.equal(state.embeddings[0].sourceTextContentHash, fixture.text.contentHash);

  const vector = vectorPayload([1, 2]);
  const invalidEmbedding = { namespace, workspace, embeddingId: "invalid-new", thoughtId: fixture.thought.thoughtId, revision: 1, model: "embeddinggemma", dimensions: 2, sourceTextContentHash: fixture.text.contentHash, vectorPayloadHash: vector.contentHash, createdAt: "2026-07-25T21:21:00.000Z" };
  const invalid = await graph.commit(commitRequest([
    graphEvent(state.revision + 1, "payload_put", vector, "new-vector"),
    graphEvent(state.revision + 2, "embedding_put", invalidEmbedding, "invalid-new"),
  ], { expectedRevision: state.revision, transactionId: "invalid-embedding", idempotencyKey: "invalid-embedding:idem" }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.rejection.code, "invalid_embedding");
});

test("workspaces are isolated, stale writers lose, and pre-commit failure rolls back", async () => {
  let abort = false;
  const graph = makeStorage({ beforeCommit() { if (abort) throw new Error("simulated_failure"); } });
  const synthetic = fullFixture("synthetic");
  const personal = fullFixture("personal");
  assert.equal((await graph.commit(commitRequest(synthetic.events, { transactionId: "synthetic", idempotencyKey: "synthetic:idem" }))).ok, true);
  assert.equal((await graph.commit(commitRequest(personal.events, { workspace: "personal", transactionId: "personal", idempotencyKey: "personal:idem" }))).ok, true);
  assert.equal((await graph.load("personal")).thoughts[0].workspace, "personal");

  const baseRevision = synthetic.events.length;
  const firstText = payload("thought-text", "First wins");
  const secondText = payload("thought-text", "Second loses");
  const firstThought = { ...synthetic.thought, revision: 2, textPayloadHash: firstText.contentHash, updatedAt: "2026-07-25T21:30:00.000Z" };
  const secondThought = { ...synthetic.thought, revision: 2, textPayloadHash: secondText.contentHash, updatedAt: "2026-07-25T21:31:00.000Z" };
  const [first, second] = await Promise.all([
    graph.commit(commitRequest([graphEvent(baseRevision + 1, "payload_put", firstText, "first-text"), graphEvent(baseRevision + 2, "thought_put", firstThought, "first-thought")], { expectedRevision: baseRevision, transactionId: "first", idempotencyKey: "first:idem" })),
    graph.commit(commitRequest([graphEvent(baseRevision + 1, "payload_put", secondText, "second-text"), graphEvent(baseRevision + 2, "thought_put", secondThought, "second-thought")], { expectedRevision: baseRevision, transactionId: "second", idempotencyKey: "second:idem" })),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.rejection.code, "stale_revision");

  const before = await graph.exportSnapshot(workspace);
  abort = true;
  const thirdText = payload("thought-text", "Must roll back");
  const thirdThought = { ...firstThought, revision: 3, textPayloadHash: thirdText.contentHash, updatedAt: "2026-07-25T21:32:00.000Z" };
  const failed = await graph.commit(commitRequest([
    graphEvent(before.revision + 1, "payload_put", thirdText, "third-text"),
    graphEvent(before.revision + 2, "thought_put", thirdThought, "third-thought"),
  ], { expectedRevision: before.revision, transactionId: "failure", idempotencyKey: "failure:idem" }));
  assert.equal(failed.ok, false);
  assert.equal(failed.rejection.code, "transaction_aborted");
  assert.deepEqual(await graph.exportSnapshot(workspace), before);
});
