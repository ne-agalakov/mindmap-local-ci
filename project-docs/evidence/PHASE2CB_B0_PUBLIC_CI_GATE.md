# Phase 2C-B0 public exact-head CI and artifact gate

Date: 2026-07-26

Status: code/CI/artifact execution passed for the pre-documentation tree; final documentation/Drive/merge gate remains open.

## Exact identity

- private PR: `ne-agalakov/mindmap-local#40`;
- private head: `69429ee80d7be0425501054ed54f3052867c9968`;
- private tree: `ada806f53d27c83a3375aa4fd01879d0dca48881`;
- public PR: `ne-agalakov/mindmap-local-ci#2`;
- public head: `8fc83312f71a29ec50fd57659fb39ff9ae5c0784`;
- public tree: `ada806f53d27c83a3375aa4fd01879d0dca48881`;
- snapshot digest: `dded4d331a4e756305b08a5bbbba11a473fff8d588325dc77ec7b63549d9033f`.

Private history was not transferred. Private source opened, target created, migration executed and model calls were all zero.

## CI

- verify `30205617026` — success;
- package-source `30205616954` — success;
- Linux lint/full test suite — success;
- GitHub-hosted macOS — success;
- actual Chrome run-storage and graph-storage — success;
- source and exporter packaging — success.

## Downloaded artifacts

- outer source artifact: `66d641699fd1d11f3e8745890bfa5dc7a4325b57f67d9cad78ebd72fdbc967a2`;
- inner source ZIP: `54505aab1fc45048f6ebbe6050b9eefec945be29a7652cb01a06a719bfc30efa`;
- inner exporter ZIP: `e8ae3b3e2870e89062eacc404cfcb75689a08006188b1765beb88582adef6b3c`;
- browser proof artifact: `86a800ba525d188a35934cc4f40f62b896d3483f43cbf951b959aba54e200b36`;
- browser graph snapshot: `bc59236e3ce7173c3f91176fb163f808a99de6f2343afcdc6eea8b12bdca5a54`.

Independent extraction confirmed all required B0 files and zero database, `.env`, credential, concrete local-path and forbidden B0 dependency findings.

## Release blocker

The exact tested package retained `artifactRevision: 5` and Phase 2C-A-only status. This is a documentation synchronization regression, not a mapping-code failure. Corrected repository metadata is prepared and the three canonical Drive documents are synchronized and reverse-read. The exact final head must still be rerun before merge.
