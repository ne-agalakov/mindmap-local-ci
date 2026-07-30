# MindMap — восстановление и бюджет локальной модели

## Immutable source

```text
size: 5 070 848 bytes
SHA-256: 356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918
personal thoughts: 0
```

B1b consumed; actual migration false.

## Accepted C4 planning recovery

Planning merge `2c1f476685007a8c2fa52288ac00dfff188edb06` accepts terminal states `rejected_preflight`, `authorization_consumed`, `blocked_recovery`, `sealed_inactive`, `rollback_required`, `completed`.

Authorization is consumed before source open. Failure after consumption never resumes/retries automatically. Pre-promotion failure preserves active pointer. Partial/sealed inactive generation is quarantined. Uncertain promotion is resolved only by readback and is never repeated. Post-promotion resolver failure requires separately authorized pointer-only rollback.

REQ-OBS-001 heartbeat target is 1 second; `possibly_hung` after `max(15 seconds, 5 × interval)` is informational only.

## Current boundary

Only sanitized-fixture implementation is allowed. Exact source/backup, production storage, exact package execution and actual migration remain prohibited. Model/network calls remain 0. No Mac action is required.
