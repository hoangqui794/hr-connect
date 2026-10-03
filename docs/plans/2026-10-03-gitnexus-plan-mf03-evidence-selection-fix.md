# MF-03 evidence selection fix

**Generated plan:** `docs/plans/2026-10-03-gitnexus-plan-mf03-evidence-selection-fix.md`  
**Repository:** `C:/Users/truon/Documents/DA/hr-connect`  
**Pinned HEAD:** `be6aef1a580ab59433b26fcecebdeaf563e0737f`  
**Plan form:** compact bug-fix plan  
**Graph status:** CLI index current at pinned HEAD; MCP transport unavailable. CLI impact reports LOW risk with one direct caller (`RequirementMatcher.match`) and one affected API flow (`match_candidate`).

## 1. Objective

Correct two general MF-03 evidence defects without candidate-, CV-, or industry-specific rules: unrelated completion percentages must not prove measurable performance, and list fragments such as `or mentoring` must be normalized so explicit evidence can match.

## 2. Current behavior and root cause

- [verified] `Measured improvement` accepts any percentage or loosely shaped numeric phrase, so `Built 80% of core system modules` can be selected even though it is not a performance result (`ai-service/app/services/requirement_evidence.py:29`).
- [verified] clause splitting can leave a leading conjunction after comma splitting; only punctuation is stripped, producing residual criteria such as `or mentoring` (`ai-service/app/services/requirement_evidence.py:72-75`).
- [verified] evidence selection takes the first matching span, so a broad pattern can outrank a stronger later span (`ai-service/app/services/requirement_evidence.py:91-95`).
- [verified] mixed `and`/`or` wording always adds a synthetic missing criterion, reducing coverage even when the list structure is resolvable (`ai-service/app/services/requirement_evidence.py:85-104`).
- [graph] `evaluate_clauses` has one direct caller, `RequirementMatcher.match`; impact is LOW and reaches the `/api/v1/match` flow through `MatchingService.match`.

## 3. Proposed changes

1. Add a bounded fragment normalizer that removes leading conjunctions and safe list punctuation while preserving unknown clauses for manual review.
2. Replace naked numeric performance matching with contextual validation: a measurable-performance span must contain a performance/capacity concept and an explicit metric or scale; support `%`, time, throughput, request-rate, and scaled-record forms such as `1M+ daily records`.
3. Rank eligible evidence spans so the strongest contextual performance statement wins instead of the first broad numeric sentence.
4. Resolve simple comma lists ending in `or` as `ANY_OF`; retain `MIXED_REQUIREMENT_LOGIC_REVIEW` only for genuinely unresolved mixed logic, and never add a synthetic missing criterion when the structure is understood.
5. Add anonymized regression tests for positive, negative, boundary, and API-through-path behavior.

## 4. Scope boundaries

- Modify only `ai-service/app/services/requirement_evidence.py` and `ai-service/tests/test_requirement_evidence.py` unless a failing test proves a directly related integration adjustment is required.
- Do not modify .NET projects, scoring weights, semantic model behavior, parser layout/OCR logic, API schemas, or business decisions.
- Do not add CV names, company names, fixture filenames, or per-candidate exceptions.
- Deterministic evidence remains authoritative; semantic retrieval cannot verify a claim.

## 5. Implementation sequence

1. Add regression tests first and prove they fail against the current implementation.
2. Implement fragment normalization and simple list-operator inference.
3. Implement contextual measured-performance validation and evidence ranking.
4. Run focused tests, then the complete `ai-service` suite.
5. Re-index/detect the final change surface and perform a local diff review.

## 6. Test scenarios

- `Built 80% of core modules` alone does not match `Measured improvement`.
- `Handled 1M+ daily records using partitioning and optimized indexing` matches measurable system capacity.
- When both sentences exist, the `1M+ daily records` sentence is selected, not the `80%` completion sentence.
- `Large-scale systems, unit testing, code review, or mentoring` plus `Mentored new team members through code reviews` matches the mentoring criterion and does not emit `or mentoring`.
- A negative/aspirational mentoring statement does not count as evidence.
- The known performance requirement remains `PARTIAL` when backend and measurable capacity are present but client-performance evidence is absent.
- Existing cross-industry evidence cases remain unchanged.

## 7. Verification commands

- `cd ai-service; ./.venv/Scripts/python.exe -m pytest -q tests/test_requirement_evidence.py`
- `cd ai-service; ./.venv/Scripts/python.exe -m pytest -q`
- `node .gitnexus/run.cjs detect-changes --scope all --repo .` using Node 24.21.0 on this host.

## 8. Risks and controls

- Over-tight performance checks could miss valid prose without metrics; those remain partial/manual-review rather than being invented as proof.
- Over-aggressive conjunction stripping could alter real phrases; normalize only leading standalone connectors after segmentation.
- ANY_OF inference could flatten ambiguous grammar; restrict it to simple comma-separated lists whose final separator is `or/hoặc` and retain review warnings elsewhere.

## 9. Definition of Done

- Both reproduced defects have regression tests that fail before and pass after the fix.
- No naked percentage can independently prove measurable performance.
- Scaled throughput/capacity evidence is recognized and selected.
- `mentoring` is emitted as a clean criterion and matches explicit, non-negated evidence.
- Full Python suite passes; no .NET file changes; final review finds no unresolved correctness regression.

## 10. Assumptions and open questions

- [verified] The working tree was clean before planning from Windows Git; WSL line-ending normalization was aligned with repository `core.autocrlf=true` for provenance capture.
- [assumed] Existing manual-review semantics should remain conservative for inferred OTHER requirements.
- Open questions: none blocking.

## 11. Implementation context

```yaml
implementation_context:
  generated_plan_path: 'docs/plans/2026-10-03-gitnexus-plan-mf03-evidence-selection-fix.md'
  target_repo: 'C:/Users/truon/Documents/DA/hr-connect'
  verified_at_commit: 'be6aef1a580ab59433b26fcecebdeaf563e0737f'
  acceptance_criteria:
    - 'Unrelated completion percentages do not prove measured performance.'
    - 'Contextual scaled performance evidence is recognized and preferred.'
    - 'Leading list conjunctions are removed without discarding unknown clauses.'
    - 'Existing evidence and API-path regressions pass.'
  evidence_provenance:
    schema_version: 2
    head_commit: 'be6aef1a580ab59433b26fcecebdeaf563e0737f'
    generated_plan_path: 'docs/plans/2026-10-03-gitnexus-plan-mf03-evidence-selection-fix.md'
    global_dirty_digest:
      algorithm: 'sha256'
      canonicalization: 'gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records'
      value: '0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd'
    cited_path_manifest:
      - path: 'ai-service/app/services/requirement_evidence.py'
        object_kind: {head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent'}
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:dec6705e6bed4ed4ec2760630791c308e360d2b2a687f7c3aec418ebaf598ead'
        index_digest: 'sha256:dec6705e6bed4ed4ec2760630791c308e360d2b2a687f7c3aec418ebaf598ead'
        worktree_digest: 'sha256:e23a2a3ad5557bf26916a473007455fed113b50550c622d8d0f7e6c21ed18e59'
        untracked_digest: 'absent'
      - path: 'ai-service/app/services/requirement_matcher.py'
        object_kind: {head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent'}
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:4ae36ac97631d4d40452aeae9f31a66f1163510516f9ca380bf6ce4a621d7420'
        index_digest: 'sha256:4ae36ac97631d4d40452aeae9f31a66f1163510516f9ca380bf6ce4a621d7420'
        worktree_digest: 'sha256:4117205d94b766d3d4971d8fa40d4a76c3f2363643d85d1f3ca9a9351cd3b0dc'
        untracked_digest: 'absent'
      - path: 'ai-service/tests/test_requirement_evidence.py'
        object_kind: {head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent'}
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:dccfa96715a2fb3de2800e137945da58b84447b22f974f7b49dc72868e065584'
        index_digest: 'sha256:dccfa96715a2fb3de2800e137945da58b84447b22f974f7b49dc72868e065584'
        worktree_digest: 'sha256:aa2fa2e213395263de03e843de672dec74cee28edc3f155cf9aa767d7ae5065f'
        untracked_digest: 'absent'
  primary_symbols:
    - symbol: 'evaluate_clauses'
      file: 'ai-service/app/services/requirement_evidence.py'
      lines: '58-107'
      role: 'Decomposes OTHER requirements and selects deterministic evidence.'
  related_symbols:
    - symbol: 'RequirementMatcher.match'
      relationship: 'CALLS evaluate_clauses; direct depth-1 dependent'
      relevance: 'Carries criteria, warnings, coverage, and evidence into API response.'
  execution_path:
    - 'match_candidate -> MatchingService.match -> RequirementMatcher.match -> evaluate_clauses'
  pdg_constraints: []
  architectural_patterns:
    - pattern: 'Conservative deterministic evidence with exact source spans and manual review.'
      example_location: 'ai-service/app/services/requirement_evidence.py'
      usage_guidance: 'Reject unsupported, negated, aspirational, and third-party evidence.'
  files_to_modify:
    - file: 'ai-service/app/services/requirement_evidence.py'
      symbols: ['Capability', 'evaluate_clauses']
      intended_change: 'Normalize fragments, validate/rank performance evidence, and resolve simple list logic.'
    - file: 'ai-service/tests/test_requirement_evidence.py'
      symbols: ['evaluate', 'evidence regression tests']
      intended_change: 'Add anonymized tests for both defects and boundaries.'
  tests:
    - file: 'ai-service/tests/test_requirement_evidence.py'
      scenarios:
        - '80 percent completion only -> measured performance NOT_FOUND'
        - '1M+ daily records -> measured capacity MATCHED'
        - 'comma-or mentoring list -> clean mentoring criterion MATCHED'
        - 'aspirational mentoring -> NOT_FOUND'
  verification_commands:
    - 'cd ai-service; ./.venv/Scripts/python.exe -m pytest -q tests/test_requirement_evidence.py'
    - 'cd ai-service; ./.venv/Scripts/python.exe -m pytest -q'
  risks:
    - 'False negatives for unquantified performance prose remain reviewable rather than verified.'
    - 'List parsing is intentionally bounded; ambiguous mixed grammar keeps a warning.'
  assumptions:
    - 'Manual-review behavior for inferred OTHER requirements remains unchanged.'
  open_questions: []
  avoid:
    - 'Do not modify existing .NET projects.'
    - 'Do not hard-code candidate, company, filename, industry, or fixture-specific exceptions.'
    - 'Do not let semantic retrieval prove deterministic evidence.'
    - 'Do not change scoring weights or parser layout/OCR behavior.'
```
