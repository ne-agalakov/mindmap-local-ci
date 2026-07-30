# Known gaps after Phase 2C-C3 implementation verification

## Closed by the C3 implementation candidate

- packaged runtime reads active generation only through control registry;
- registry/pointer/attestation/generation/schema/workspace/seal/hash validation;
- fail-closed handling for missing, malformed, corrupt, mismatched, stale and interrupted state;
- no legacy/inactive fallback, hidden repair/migration or mutation;
- deterministic close/reopen and browser reload;
- pointer replacement detection between reads;
- actual-Chrome REQ-OBS-001, possible-hang state and sanitized diagnostics;
- zero network/model calls and no personal data on sanitized fixtures.

## Still open before C3 acceptance

- final documentation exact tree and release metadata;
- rerun full CI/package on that tree;
- downloaded final artifact inspection;
- factual expected-head merge and post-merge readback.

## Still prohibited or unproved

- C4 exact-source one-shot package;
- private backup filesystem behavior;
- target-Mac production storage and actual migration/activation/rollback;
- production REQ-OBS-001;
- semantic quality, multi-order stability and real-data safety.
