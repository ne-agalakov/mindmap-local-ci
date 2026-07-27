# MindMap — решения и статус

Дата актуализации: 2026-07-26.

## Назначение

Персональная local-first AI-система: мысль → понимание → связи → приоритет → решение → действие → результат → память.

Alpha.19 остаётся замороженным legacy-прототипом и не принимает реальные мысли.

## Принятые этапы

- Phase 0 exact source: `850a5fc60a154047eae1f6a5d4f63c7969ae8412`;
- Phase 1A pure state-core: `e7b7593932614f8dfa843298f35eff0230c1e827`;
- Phase 2A storage contract: `aa5eaaae08a3da4d0ff00ea03aea12b793137a21`;
- Phase 2B native IndexedDB run storage: `b4b35dcd7125c820f75f89387bc18ac3fa509cb0`;
- Phase 2C-A graph/payload storage: `292634312ad04fa6e6cfc5a5ded311ac1020094d`.

Legacy source remains private and immutable:

- size `5 070 848` bytes;
- SHA-256 `356b943275cce292d0e14f8a7fbe95af07e79de73f06d3e361874d342aa2f918`;
- 96 synthetic, 0 personal thoughts;
- integrity `ok`;
- write/migration/network/model calls — 0.

## Phase 2C-A — принята

PR #38 squash-merged from exact reviewed head:

```text
reviewed head: 29a317b58cbecaea13e4f21c02af2b945a6e6edc
merge:         292634312ad04fa6e6cfc5a5ded311ac1020094d
```

Приняты canonical graph/payload contracts и native IndexedDB graph storage:

- payloads, thoughts, typed hierarchy;
- placement либо explicit `unresolved`;
- proposed/confirmed/rejected links;
- embeddings bound to exact text;
- damaged references separately;
- atomic event/materialized-state/receipt transaction;
- deterministic replay and reopen-stable hash;
- stale/idempotency guards;
- workspace isolation, abort rollback and corruption refusal;
- fresh unified run+graph database;
- run-only database refusal.

### Финальная проверка

Exact public counterpart:

```text
public head: ee5401a4a2ca7763467562417b9c5c4aece01214
shared tree: e81ae1b309a806f0078b5a8a2057f51d4c0e403d
```

- verify `30198811851` — success;
- package `30198811852` — success;
- Linux/macOS/full tests/actual Chrome/package — passed;
- outer artifact `2184324939c12db0af27ad913904d953b0ee5b5f73b1c7e85c580f020263688c`;
- inner source `81d469a6eb53908b1c863c8643598a1953bffa8392174d9e1292b3a1e2058c3b`;
- inner exporter `1388fbc608d27c6d446646c84fd7c29ab59a76ed3e587a4b41f803b901b32109`;
- browser proof `5c63ffa99679b9cff87d8c82b16d7d4f31080e3bbbc6c7c1a218e8cbe1ddb755`;
- privacy/credential/data findings — 0.

Drive после merge обновлён и прочитан обратно:

- instruction `AIroW37ZYyE_aMLJxvUodCy1o2WnLjd_tUMJTp94Bzpm6pz-hhRp9RqMXgiZ2WRefBFDz1TGrQG6CsmnkGHpnTuyEq1c-1duUZCUDvaop3E`;
- status `AIroW36BDxK0THdoc-SlGQ3zq2CtBoPdpwJ7zjGcXzvKZKrrIqU_baZXfnNi1ZqFIlT8oRYmJDKor_N-MhawbIZjEhEkCCC9RWkXs4cIoF0`;
- recovery `AIroW35Q8r2B6M35cMS0OBUjGWp2HtXfscrHknyRRLjwcTgYoBC4lub293D009ujIgGpodrxiTPn0kaCZAm1DpdfU3YwWwji8BA-DUVZSXU`.

### Исправленные причины финального gate

1. Release-doc marker был регистрозависим: ожидал `same-fixture`, README начинал предложение с `Same-fixture`. Исправлен сам gate; storage-код не падал.
2. Первый внешний privacy regex сопоставил два документационных шаблона пути, а не реальные пути. Формулировки уточнены; повторный scan дал ноль concrete local user-home findings.

## Phase 2C-B0 — реализована, но не принята

PR #40 реализует только pure mapping planner `phase2cb-mapping-v1` на sanitized fixtures:

- exact source/target identity gates;
- deterministic mapping IDs, ordering, canonical JSON and hashes;
- explicit placement, unresolved and damaged references;
- quarantined legacy run history without invented modern attempts;
- typed stops before mutation;
- frozen B1 rollback/diagnostic contract;
- no SQLite, IndexedDB, network, model or runtime dependency in the B0 module.

Exact pre-documentation gate:

```text
private head: 69429ee80d7be0425501054ed54f3052867c9968
public head:  8fc83312f71a29ec50fd57659fb39ff9ae5c0784
shared tree:  ada806f53d27c83a3375aa4fd01879d0dca48881
```

- verify `30205617026` — success;
- package `30205616954` — success;
- Linux/macOS/full tests/actual Chrome/package — passed;
- outer artifact `66d641699fd1d11f3e8745890bfa5dc7a4325b57f67d9cad78ebd72fdbc967a2`;
- inner source `54505aab1fc45048f6ebbe6050b9eefec945be29a7652cb01a06a719bfc30efa`;
- inner exporter `e8ae3b3e2870e89062eacc404cfcb75689a08006188b1765beb88582adef6b3c`;
- browser proof `86a800ba525d188a35934cc4f40f62b896d3483f43cbf951b959aba54e200b36`;
- privacy/credential/database/forbidden-dependency findings — 0.

Найден и исправлен отдельный release-blocker: exact tested package сохранял `ARTIFACT_REVISION` только в состоянии принятой Phase 2C-A. Mapping-код не падал, но документационная рассинхронизация запрещает merge.

## Границы доказательства

Не доказаны:

- принятие/merge provenance Phase 2C-B0;
- exact final-head public CI/artifact review для синхронизированного B0 tree;
- exact-source B1 dry run;
- source byte-stability;
- native IndexedDB isolated target;
- deterministic repeat-run target hash;
- injected B1 transaction rollback;
- same-fixture cross-environment snapshot equality;
- actual target-Mac migration;
- production runtime/UI и REQ-OBS-001;
- service-level exactly-once model execution;
- semantic quality, multi-order stability и personal-data safety.

## Стоп-линия

Разрешены только финальная синхронизация/проверка/merge Phase 2C-B0 в PR #40.

Запрещены opening exact private SQLite source, B1 target creation, Candidate 5, Qwen/DeepSeek, Candidate 6, legacy write/repair, actual target-Mac migration, runtime/UI integration и реальные мысли.

## Следующий проверяемый шаг

Repository metadata и три canonical Google Docs обновлены и прочитаны обратно. Повторить exact final-head public CI/artifact inspection и слить PR #40 только при неизменном expected head; затем отдельно записать post-merge provenance. Только отдельный post-merge gate может разрешить B1 read-only source → fresh isolated temporary target. Actual migration автоматически не разрешается.

### Phase 2C-B0 Drive readback

Canonical Google Docs updated and reverse-read on `2026-07-26T14:35:01Z`:

- instruction `AIroW3496qPwmnEkRHJm7VfUnzHsjREVxT8yFbFEWmDkzRKZnr7TdtDbG21LBIvtgL4rWUQ7VTplg1xpEKCFJqnX0P7JoWpx8o-Z-8TKI4I`;
- status `AIroW35iMdez6GJ2RFE5vJ4wH_DC6XWdaQJeKLbNL9gmEbIF9eJm0Dz5tMvI--HfSzMCil42lahleajeyuDkNoGYRrw7yPIUnLdXqkVebFI`;
- recovery `AIroW35_V_znhKFxWPXm5oYB4mRs8XDAK9seNc1sjUFCtwc-TpPw74-Nm53V7FewUe7J8qkg-QyWa7v-53-pkBJjL72Nl3qRm-5JkGlFmUc`.

All three exact B0 headings were found after write. This closes the pre-merge Drive synchronization gate, not B0 acceptance.

## Phase 2C-B0 — принята

PR #40 слит merge-коммитом `dbf2484c78e4eedcbb2efb3f0b61394b79a6d216`. Финальный private head `2e0719c68813d61171b70a1ab98081febdb6ea01` и public counterpart `cbbd0bb629eea56082e7da54f439c50ca96e56cc` имеют exact tree `10b0cd7fea77fdff04cf2e072be9604d2a5c05cb`.

Финальные gate:

- verify `30208230376` — success;
- package `30208230352` — success;
- outer source artifact `e13780b4a53b9ebbbd3d2d356e70e42812eb0fcb7a6e71687c012019c88a4069`;
- inner source `1ac13430d4e28456f4f29aec0061a4789b45449a415da6caa1a4886acbfd974b`;
- inner exporter `c86a24da9ba268992046045ba250c2ac27c8316205f19453e687f20fbf192941`;
- browser proof `beec9c5a333960cf05befb418bc50d8124ba6e3bbd5cee93b7469f386ff971c3`;
- post-merge Drive readback — verified.

Приняты только deterministic mapping/typed-stop contracts B0 на sanitized fixtures. Private SQLite source не открывался; target не создавался; migration и model calls — 0.

## Следующий проверяемый шаг после B0

Подготовить отдельный B1-план exact-source read-only → fresh isolated temporary target. До его отдельного review/approval B1 не запускается. Actual migration, runtime/UI, Candidate 5/6, Qwen/DeepSeek и реальные мысли остаются запрещены.
