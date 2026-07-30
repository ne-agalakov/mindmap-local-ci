# ADR-022 — Accept C4 planning contract; allow sanitized implementation only

Date: 2026-07-30.

Decision: accept the C4 one-shot execution and separate rollback authorization planning contract by factual merge `2c1f476685007a8c2fa52288ac00dfff188edb06`, final tree `7d653175805e39eea9c50c5f76e401f285d07976`.

Consequence: a separate implementation issue may implement and prove the contract only on isolated sanitized fixtures. Exact SQLite/private backup access, B1b repeat, exact execution package/authorization, target-Mac production storage, actual migration/promotion/rollback, model/network calls and personal data remain prohibited.
