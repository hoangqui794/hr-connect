# GitNexus Engineering Plan

> Task: Refactor MF-03 CV extraction into one hybrid, multi-strategy parser for varied industries and layouts while preserving the existing API contract and human-review safeguards.
> Evidence verified at commit `cd4642a7949b4d6127b99a6b8e12ab83fa66ce2d`; GitNexus index is 1 commit behind and was not refreshed because its provenance could not be verified as current. Source verification is therefore authoritative.
> Evidence provenance schema 2; global dirty digest `0a5db75a8d6fd5e9aa788f12e02b2010a4128c7eef02a330b59baf7e8fe0d16b`; cited-path manifest has 9 sorted entries; the exact generated-plan path is excluded.

## 1. Objective

Replace the current single, line-order-driven structured parser with a common pipeline that classifies document layout, applies bounded extraction strategies, and resolves only evidence-backed results. It must handle single-column, sidebar/two-column, timeline/date-rail, table-like, and OCR/unstructured CVs across industries without hard-coding individual CVs.

## 2. Current Behaviour

- [verified] `DocumentParser` already provides positioned `DocumentBlock` values plus coarse `SINGLE_COLUMN`, `MULTI_COLUMN`, or `UNSTRUCTURED` layout (`ai-service/app/services/document_parser.py:35-53`, `230-292`).
- [verified] `StructuredCvParser.parse_with_diagnostics` normalizes text, splits heading-based sections, parses each field, and emits a candidate-wide confidence/warnings result (`ai-service/app/services/structured_cv_parser.py:107-150`).
- [verified] Experience parsing has bounded Company–Role–Date reconstruction, but it operates on one linear list and fixed adjacent line patterns (`ai-service/app/services/structured_cv_parser.py:270-428`).
- [verified] Both test parsing and immediate file matching reach that parser through `_parse_upload`, preserving document blocks/layout/OCR flags in the response (`ai-service/app/api/cv.py:39-76`, `89-158`).

## 3. Relevant Architecture

- [verified] MF-03 is a standalone FastAPI decision-support service; it must not change .NET projects, create recruitment decisions, or persist CV data (`ai-service/README.md:1-13`, `71-75`).
- [verified] Existing document-parser tests already generate digital two-column and date-rail PDFs without real candidate data (`ai-service/tests/test_document_parser.py:47-75`, `109-155`).
- [verified] The current benchmark aggregates local files without exporting raw CV text, names, contacts, or per-file outcomes (`ai-service/tools/benchmark_cv_parser.py:1-6`, `32-100`).

## 4. GitNexus Findings

- [graph] `impact parse_with_diagnostics --direction upstream --depth 3 --include-tests --file ai-service/app/services/structured_cv_parser.py --kind Method` reported 14 direct dependents, including `_parse_upload`, `parse`, and structured-parser tests; `parse_cv` and `match_cv_file` are depth-2 paths. The graph is marked one commit behind HEAD, so this is a routing aid only.
- [graph] `impact _parse_upload --direction upstream --depth 3 --include-tests --file ai-service/app/api/cv.py --kind Function` reports its two direct dependents are `parse_cv` and `match_cv_file`.
- [verified] Direct source confirms those two public endpoints call `_parse_upload`; compatibility must be tested at both endpoints, not just at parser-unit level (`ai-service/app/api/cv.py:95-104`, `114-158`).

## 5. Statement-Level PDG Findings

PDG is unavailable through the installed GitNexus CLI and the graph index is stale; no PDG slice is claimed. Source establishes the constraints instead:

- [verified] `_parse_upload` creates the structured result before constructing the API response, so the facade must keep the exact `StructuredParseResult` shape and warning semantics (`ai-service/app/api/cv.py:52-74`).
- [verified] `parse_with_diagnostics` marks unresolved experience as manual review and caps confidence; the new resolver must retain this fail-safe rather than filling gaps by inference (`ai-service/app/services/structured_cv_parser.py:136-150`).
- [inferred] Layout strategies must consume immutable extraction evidence and return candidates; only a resolver may select among conflicts. This prevents a strategy from silently overwriting a higher-quality result.

## 6. Proposed Changes

1. `ai-service/app/services/document_parser.py` — preserve `DocumentBlock` geometry and replace the coarse internal layout decision with a richer, backward-compatible classification input. Keep `ExtractedDocument.layout` string-compatible for current API clients.
2. `ai-service/app/services/structured_cv_parser.py` — keep `StructuredCvParser.parse` and `parse_with_diagnostics` as the compatibility façade. Move strategy selection and candidate merging behind this boundary; do not alter endpoint request/response schemas.
3. New parser-only modules under `ai-service/app/services/` — introduce immutable layout classification and extraction-candidate data structures, then independent sequential, column/sidebar, timeline/date-rail, table-row, and OCR-fallback strategies. Each strategy must state its evidence spans, source layout, confidence, and diagnostics.
4. New resolver component under `ai-service/app/services/` — merge field candidates only when they agree or one is materially better and fully evidenced. For Company–Role–Date, require all three local evidence components; conflicts or absent evidence remain null/unresolved and trigger manual review.
5. `ai-service/tests/` — add synthetic, anonymized fixtures for every layout/industry pattern; add strategy and resolver tests independently, then retain end-to-end parser/API regression coverage.
6. `ai-service/tools/benchmark_cv_parser.py` and `tests/fixtures/parser_benchmark.json` — score field-level correctness and diagnostics against expanded anonymous fixtures. Keep real CV files and human labels outside Git; report only aggregates.

## 7. Implementation Sequence

1. Define layout-classification and extraction-candidate contracts, including evidence coordinates/lines, per-field confidence, strategy name, and diagnostic category. Add tests proving a classifier never treats missing geometry as trustworthy layout evidence.
2. Extract the existing ordered-text/heading parser into the sequential strategy without changing its current cases. Run existing parser tests before adding new behavior.
3. Implement timeline/date-rail strategy using same-page geometric row grouping; require a local Company–Role–Date triplet before emitting work experience. Cover left/right date rails and mixed date formats.
4. Implement sidebar/two-column and table-row strategies with bounded row/column reconstruction. They may return no candidate when geometry is ambiguous; fallback then becomes manual review, not guessed data.
5. Implement OCR fallback strategy: accept OCR blocks when positions exist; label text-only OCR as low-confidence and preserve `OCR_POSITION_DATA_UNAVAILABLE` diagnostics.
6. Add resolver and wire it through `StructuredCvParser.parse_with_diagnostics`. Preserve `StructuredParseResult`, current field models, warning de-duplication, and threshold behavior; add explicit conflict diagnostics.
7. Expand anonymized fixtures across sales, HR, logistics, healthcare, education, architecture, finance, software, manufacturing, and student CV patterns. Include negative evidence cases (role+date without company; placeholder template; project date mistaken for employment).
8. Extend benchmark and regression commands. Add a local-only optional expected-results manifest for user/HR annotation of real CVs; CI must rely solely on anonymous fixtures. Set production readiness only when the agreed field/layout gates are met.
9. Run focused tests then the full MF-03 suite. Re-run the privacy-preserving local benchmark and compare aggregate coverage/diagnostics only; document any fields still sent to review.

## 8. Test Strategy

- Update `ai-service/tests/test_document_parser.py`: single column, sidebar, date rail, table-like rows, positioned OCR, and unpositioned OCR layout classification.
- Update `ai-service/tests/test_structured_cv_parser.py`: preserve all established section/skill/project behavior; add independent assertions for timeline, columns, resolver agreement, resolver conflict, and no Company–Role–Date fabrication.
- Add tests for each new strategy and resolver: input blocks/text → candidate list → expected evidence/confidence/diagnostic, with no FastAPI dependency.
- Update `ai-service/tests/test_parser_benchmark.py`: fixture schema validation, per-field exact expected outcome, per-layout coverage, diagnostics, and quality-gate failure below the threshold.
- Add API regression tests for `/cv/parse` and `/match-file` to prove unchanged response aliases, warnings, manual-review behavior, and parsed data consumed by matching.
- Verified command: `cd ai-service; .\.venv\Scripts\python.exe -m pytest` (README documents `pytest` at `ai-service/README.md:94-100`).

## 9. Risk and Impact Analysis

- High risk: parser façade changes affect both public endpoints and matching input. Mitigation: keep signatures/models and add endpoint regressions.
- High risk: cross-column association can invent employment history. Mitigation: resolver accepts only local Company–Role–Date evidence; unresolved/contradictory results become manual review.
- Medium risk: multiple strategies duplicate a valid fact. Mitigation: stable evidence identity and deterministic de-duplication; never sum duplicate employment intervals.
- Medium risk: OCR/table extraction is noisier. Mitigation: explicit provenance/confidence, diagnostics, and no elevated confidence from OCR without positions.
- Privacy risk: real CV labels/outputs could leak PII. Mitigation: local ignored annotations only, no filenames/text in fixtures, committed tests, logs, or benchmark reports.
- Non-goal: this refactor does not change MatchTier, score weights, .NET APIs, database schema, shortlist/reject actions, or production queue architecture.

## 10. Files Expected to Change

| File | Symbols | Reason |
| --- | --- | --- |
| `ai-service/app/services/document_parser.py` | `DocumentBlock`, `_order_pdf_blocks` | Supply reliable geometry/layout evidence without breaking current extraction metadata. |
| `ai-service/app/services/structured_cv_parser.py` | `StructuredCvParser.parse`, `parse_with_diagnostics`, experience/section helpers | Retain façade and delegate to hybrid parser/resolver. |
| `ai-service/app/services/<new layout/strategy/resolver modules>` | New internal components | Isolate classifier, strategies, candidate records, and resolver. |
| `ai-service/app/api/cv.py` | `_parse_upload` | Compatibility regression only; change only if new diagnostics need already-supported propagation. |
| `ai-service/tests/test_document_parser.py` | layout tests | Synthetic geometry/layout coverage. |
| `ai-service/tests/test_structured_cv_parser.py` | parser tests | Behaviour and safety regressions. |
| `ai-service/tests/<new strategy/resolver tests>` | new tests | Independent testability of every strategy and resolver. |
| `ai-service/tests/fixtures/parser_benchmark.json` | benchmark fixtures | Anonymous cross-industry layout cases. |
| `ai-service/tests/test_parser_benchmark.py` | benchmark assertions | Field/layout/diagnostic quality gates. |
| `ai-service/tools/benchmark_cv_parser.py` | benchmark report | Aggregate local evaluation and optional ignored annotations. |

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: "Hybrid, evidence-first CV parsing for multiple layouts and industries in MF-03 only."
  acceptance_criteria:
    - "Existing /cv/parse and /match-file contracts remain compatible."
    - "Every extracted work record has local Company, Role, and Date evidence."
    - "Ambiguous, conflicting, or low-quality OCR evidence triggers manual review rather than invention."
    - "Committed fixtures contain no real CV text, identity, contacts, or filenames."
    - "Every strategy has independent tests and all MF-03 tests pass."
  evidence_provenance:
    schema_version: 2
    head_commit: "cd4642a7949b4d6127b99a6b8e12ab83fa66ce2d"
    generated_plan_path: "docs/plans/2026-09-28-gitnexus-plan-hybrid-cv-parser.md"
    global_dirty_digest:
      algorithm: "sha256"
      canonicalization: "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records"
      value: "0a5db75a8d6fd5e9aa788f12e02b2010a4128c7eef02a330b59baf7e8fe0d16b"
    cited_path_manifest:
      - {path: "ai-service/README.md", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:f83eaebeca193bc19700b67f3aa264120e976a2f43f00c5c4c38e1fc16e0bc57", index_digest: "sha256:f83eaebeca193bc19700b67f3aa264120e976a2f43f00c5c4c38e1fc16e0bc57", worktree_digest: "sha256:82563512575ed63beeea14c7ea973d5859978cacab3185fcfebbac3f0c3b88bd", untracked_digest: absent}
      - {path: "ai-service/app/api/cv.py", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:4a6da19829d8bd7627384a5a7cba311002409c738b4862f7eb83433c0585d174", index_digest: "sha256:4a6da19829d8bd7627384a5a7cba311002409c738b4862f7eb83433c0585d174", worktree_digest: "sha256:7bee4311dd83faa63a7bfaa604ba0b6fd537143abc972ccdb161f0bd51c65455", untracked_digest: absent}
      - {path: "ai-service/app/services/document_parser.py", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:6567f31c3fbe931053abebaf811a878499d61c10133aee21f71117167bbe3727", index_digest: "sha256:6567f31c3fbe931053abebaf811a878499d61c10133aee21f71117167bbe3727", worktree_digest: "sha256:e4fcb51d19507c0be88ae7a25548286d1f32d03c760d0391612a263744786fff", untracked_digest: absent}
      - {path: "ai-service/app/services/structured_cv_parser.py", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:6a2f7c9e6071ab2084810d30460b5c45da5773cdc22d841be00440ce56c7d782", index_digest: "sha256:6a2f7c9e6071ab2084810d30460b5c45da5773cdc22d841be00440ce56c7d782", worktree_digest: "sha256:da84b90e5b3d84a7db5e423fa8f1255edde776e6b2123dfba07dfb7e28cdc8f5", untracked_digest: absent}
      - {path: "ai-service/tests/fixtures/parser_benchmark.json", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: clean, rename_from: null, rename_to: null, head_digest: "sha256:4603bc49ee0aff5ad8240798d8d91f7373ed046377353dc3e89ec703a8a188d3", index_digest: "sha256:4603bc49ee0aff5ad8240798d8d91f7373ed046377353dc3e89ec703a8a188d3", worktree_digest: "sha256:4603bc49ee0aff5ad8240798d8d91f7373ed046377353dc3e89ec703a8a188d3", untracked_digest: absent}
      - {path: "ai-service/tests/test_document_parser.py", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:7e22bd85ab48c567c013cc44a89e4e5db971070b20f7cce2eba6d265d2c14865", index_digest: "sha256:7e22bd85ab48c567c013cc44a89e4e5db971070b20f7cce2eba6d265d2c14865", worktree_digest: "sha256:40047b586e119a9bc62969875ce4a7cb6e54fabda85a88854f97588705928c1e", untracked_digest: absent}
      - {path: "ai-service/tests/test_parser_benchmark.py", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: clean, rename_from: null, rename_to: null, head_digest: "sha256:d59dd7f5c2d70594e794ada407a8fbcc2e8ed179ab6303e8eb326d8aea3ed72f", index_digest: "sha256:d59dd7f5c2d70594e794ada407a8fbcc2e8ed179ab6303e8eb326d8aea3ed72f", worktree_digest: "sha256:d59dd7f5c2d70594e794ada407a8fbcc2e8ed179ab6303e8eb326d8aea3ed72f", untracked_digest: absent}
      - {path: "ai-service/tests/test_structured_cv_parser.py", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:d3d2c45a734777e88d257f3579229a7e5d4c879f52e497c730cee383e4a0825c", index_digest: "sha256:d3d2c45a734777e88d257f3579229a7e5d4c879f52e497c730cee383e4a0825c", worktree_digest: "sha256:3c3d4338c4359e9bf922392527d003c8cdfaa3f49315058fb8253bcfb55c485e", untracked_digest: absent}
      - {path: "ai-service/tools/benchmark_cv_parser.py", object_kind: {head: regular, index: regular, worktree: regular, untracked: absent}, state: clean, rename_from: null, rename_to: null, head_digest: "sha256:a280f74d41905a1a826273d8de2e2d5966364f73a3fa611bac33f787bec205c7", index_digest: "sha256:a280f74d41905a1a826273d8de2e2d5966364f73a3fa611bac33f787bec205c7", worktree_digest: "sha256:a280f74d41905a1a826273d8de2e2d5966364f73a3fa611bac33f787bec205c7", untracked_digest: absent}
  primary_symbols:
    - {symbol: "StructuredCvParser.parse_with_diagnostics", file: "ai-service/app/services/structured_cv_parser.py", lines: "111-150", role: "Parser compatibility facade and diagnostics boundary"}
    - {symbol: "DocumentParser._order_pdf_blocks", file: "ai-service/app/services/document_parser.py", lines: "230-292", role: "Current geometry ordering/layout source"}
    - {symbol: "_parse_upload", file: "ai-service/app/api/cv.py", lines: "39-76", role: "Shared API integration boundary"}
  related_symbols:
    - {symbol: "parse_cv", relationship: "CALLS _parse_upload", relevance: "Public standalone parser endpoint"}
    - {symbol: "match_cv_file", relationship: "CALLS _parse_upload", relevance: "Parser output feeds matching"}
    - {symbol: "StructuredCvParser._parse_experience", relationship: "Called by parse_with_diagnostics", relevance: "Current sequential Company-Role-Date logic"}
  execution_path:
    - "Upload is validated and extracted into text, blocks, layout, OCR metadata."
    - "The compatibility façade chooses hybrid strategies and resolves evidence-backed fields."
    - "Response exposes parsed candidate, confidence, manual-review flag, and warnings."
    - "match-file consumes the same parsed candidate for matching."
  pdg_constraints:
    - {description: "No current PDG layer available through the CLI; re-check before execution.", affected_statements: [], implementation_consequence: "Use source tests and direct endpoint regressions as the compatibility gate."}
  architectural_patterns:
    - {pattern: "Conservative evidence-first extraction", example_location: "ai-service/app/services/structured_cv_parser.py:136-150", usage_guidance: "Leave uncertain fields unresolved and request manual review."}
    - {pattern: "Synthetic document fixtures", example_location: "ai-service/tests/test_document_parser.py:47-75", usage_guidance: "Test visual layouts with generated files and no real CV data."}
  files_to_modify:
    - {file: "ai-service/app/services/document_parser.py", symbols: ["DocumentBlock", "_order_pdf_blocks"], intended_change: "Expose stable layout evidence for strategies."}
    - {file: "ai-service/app/services/structured_cv_parser.py", symbols: ["parse", "parse_with_diagnostics", "_parse_experience"], intended_change: "Compatibility façade over strategy pipeline and resolver."}
    - {file: "ai-service/app/services/<new parser modules>", symbols: [], intended_change: "Classifier, strategies, candidate model, resolver."}
    - {file: "ai-service/tests/", symbols: [], intended_change: "Synthetic per-strategy and regression coverage."}
  tests:
    - {file: "ai-service/tests/test_document_parser.py", scenarios: ["generated layout geometry produces correct class", "OCR without coordinates lowers confidence"]}
    - {file: "ai-service/tests/test_structured_cv_parser.py", scenarios: ["Company-Role-Date is required", "conflicts require review", "existing fields remain compatible"]}
    - {file: "ai-service/tests/<new strategy and resolver tests>", scenarios: ["each strategy exposes evidence and bounded output", "resolver merges agreement and rejects conflict"]}
    - {file: "ai-service/tests/test_parser_benchmark.py", scenarios: ["anonymous field/layout/diagnostic quality gates"]}
  verification_commands:
    - "cd ai-service; .\\.venv\\Scripts\\python.exe -m pytest"
  risks:
    - "Geometry grouping can falsely link records across columns; require local evidence and manual review fallback."
    - "Existing endpoints and matching depend on the shared parser façade."
    - "Real CV benchmark data must remain local and untracked."
  assumptions:
    - "Before implementation, confirm current working-tree changes are intentional and retain them; evidence provenance reports several cited files as unstaged."
    - "Before any graph-based impact claim during work, refresh or verify the GitNexus index provenance."
    - "Agree final production thresholds with HR after enough anonymous labeled cases exist; do not infer readiness from coverage alone."
  open_questions:
    - "Which anonymized expected fields and review outcomes will HR validate for a cross-industry acceptance corpus?"
    - "Should a future API expose per-field evidence diagnostics, or remain internal until a human-review UI exists?"
  avoid:
    - "Do not modify existing .NET projects, databases, recruitment state, or MatchTier mapping."
    - "Do not commit real CV text, PII, filenames, raw benchmark output, or local annotations."
    - "Do not add a per-template hard-coded exception or auto-reject/shortlist behavior."
```

## 12. Assumptions and Open Questions

Assumptions:

- Existing unstaged MF-03 changes are user work and must be preserved.
- The intended compatibility target is current FastAPI output models; no .NET change is authorized.
- A field-level production gate needs HR-validated anonymous labels; aggregate “has field” coverage alone cannot prove accuracy.

Open questions / deferred follow-ups:

- HR must set the final acceptance threshold and review the anonymized expected-result corpus before any `productionReady=true` claim.
- Per-field evidence display and correction storage belong to a later MF-04/human-review integration; they are intentionally not implemented in this parser refactor.
- A durable distributed queue and scoring-model calibration are unrelated to parsing and remain out of scope.

## 13. Definition of Done

- All existing MF-03 tests pass, plus independent classifier, strategy, resolver, benchmark, and endpoint regression tests.
- The hybrid pipeline recognizes the defined layout categories or explicitly falls back to manual review.
- No strategy can create an experience record without Company–Role–Date evidence; project dates do not count as employment.
- Public `/cv/parse` and `/match-file` responses remain backward-compatible and carry existing confidence/warning/manual-review behaviour.
- Repository fixtures and reports are anonymous; real CV evaluation stays local and aggregate-only.
- The agreed anonymous-corpus field/layout gates pass before any production-readiness claim.
