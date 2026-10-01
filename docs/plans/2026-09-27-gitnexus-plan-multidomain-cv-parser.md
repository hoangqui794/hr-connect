# GitNexus Engineering Plan

> Task: Generalize MF-03 CV parsing across industries and common PDF layouts, using the local 31-CV audit as regression evidence.
> Evidence verified at commit `f979d99226da9a536e597cb3d14a086365b05a58`; GitNexus index refresh was inconclusive, so source and tests are the primary evidence.
> Evidence provenance schema 2; global dirty digest `21d6446675d25f4cb0996234557939d53c8115fc692e119d35f6559000a32491`; generated plan path excluded.

## 1. Objective

Make MF-03 reconstruct evidence-backed experience records for Sales, Marketing, Operations, HR, Logistics, Engineering, Healthcare, Education, Design, and IT CVs. Support common layouts without guessing uncertain fields. Keep AI evidence-only and manual-review-only.

## 2. Current Behaviour

- [verified] `DocumentParser._order_pdf_blocks` groups a detected two-column page left-to-right, which can move a narrow date rail after employer/role blocks.
- [verified] `StructuredCvParser._parse_experience` currently depends chiefly on `company -> role` adjacency and a limited title expression.
- [verified] `parse_with_diagnostics` only emits `EXPERIENCE_DATE_NOT_DETECTED` when an `experience` section was found and no record is built.
- [verified] Both `/cv/parse` and `/match-file` share `_parse_upload`, then use the same parser result.

## 3. Relevant Architecture

- [verified] `ai-service/app/services/document_parser.py` extracts positioned text and chooses a page reading order.
- [verified] `ai-service/app/services/structured_cv_parser.py` splits sections, builds `StructuredCandidate`, and must retain evidence/confidence instead of inventing data.
- [verified] `ai-service/app/schemas/cv.py` carries `WorkExperience`, nested projects, and API aliases.
- [verified] User CVs are not a repository fixture; regression tests must be synthetic/anonymized.

## 4. GitNexus Findings

- [graph, stale-index limitation] Querying `_parse_experience` identifies `parse_cv` and `match_cv_file` as affected processes.
- [graph, stale-index limitation] Upstream impact identifies direct caller `parse_with_diagnostics`, then `_parse_upload`, the public parse endpoint, and the file-match endpoint. Risk reported LOW; all callers must retain compatible output.

## 5. Statement-Level PDG Findings

PDG is unavailable in the local CLI. [verified] Source order is the constraint: PDF block order determines text order; text order determines section membership; section membership determines the input to `_parse_experience`. Preserve API/matching order and change only reconstruction/diagnostics.

## 6. Proposed Changes

1. In `DocumentParser._order_pdf_blocks`, detect a narrow date/metadata rail separately from a true sidebar. Date rails use row-major order so aligned company/date text remains adjacent; real sidebars retain column-major order.
2. In `StructuredCvParser`, replace IT-first title matching with structural candidate assembly and broad professional title signals. Support `company -> role -> date`, `company/date -> role`, and `role -> date -> company`.
3. Expand heading normalization (`WORK EXPERIENCES`, Vietnamese/English variants) and create an experience-signal warning when date/title evidence exists but no safe employment record can be produced.
4. Add quality diagnostics for empty/noisy OCR text and lower confidence/require manual review instead of returning misleading complete-looking results.
5. Add anonymized test cases for business and technical CVs. Preserve legacy API aliases/fields and leave .NET projects unchanged.

## 7. Implementation Sequence

1. Add failing tests for the four supported visual sequences, plural headings, non-IT roles, ambiguous date-only evidence, and OCR/no-text diagnostics.
2. Implement date-rail vs sidebar classification and test it against the existing two-column layout contract.
3. Implement domain-neutral experience candidate collection, bounded proximity matching, and project-date exclusion from total experience.
4. Add heading and warning logic; ensure unresolved evidence forces `requiresManualReview`.
5. Cover `/cv/parse` and `/match-file` compatibility, run the full suite, then run a local PII-free benchmark summary.

## 8. Test Strategy

- `test_document_parser.py`: company/date same-row ordering, true sidebar ordering, OCR quality warning inputs.
- `test_structured_cv_parser.py`: Sales Executive, HR Officer, Operations Supervisor, Logistics Coordinator, teacher/nurse/accountant; three ordering patterns; plural heading; ambiguity must not produce a fake job.
- `test_cv_api.py`: multipart response preserves aliases/warnings and matching remains evidence-only.
- Verification: `ai-service/.venv/Scripts/python.exe -m pytest -q`.

## 9. Risk and Impact Analysis

- Date rails and sidebars look similar. Regression tests must prove sidebar order is retained.
- Title vocabularies are only supporting signals; structural proximity plus manual review avoids false positives.
- OCR calls may not be cancellable in-process; do not promise hard timeout cancellation without a measured process boundary.
- No raw CV text, tokens, or user PDFs may be committed or logged.

## 10. Files Expected to Change

| File | Symbols | Reason |
| --- | --- | --- |
| `ai-service/app/services/document_parser.py` | `_order_pdf_blocks` | Preserve date rows without breaking sidebars. |
| `ai-service/app/services/structured_cv_parser.py` | `_heading_match`, `_parse_experience`, diagnostics | Domain-neutral parsing and safe warnings. |
| `ai-service/app/schemas/cv.py` | diagnostics contract only if needed | Preserve explicit response compatibility. |
| `ai-service/tests/test_document_parser.py` | layout tests | Prevent reading-order regression. |
| `ai-service/tests/test_structured_cv_parser.py` | parser tests | Protect multi-industry layouts. |
| `ai-service/tests/test_cv_api.py` | endpoint test | Retain API compatibility. |

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: 'Generalize MF-03 parser for common CV layouts and industries without autonomous recruiting decisions.'
  acceptance_criteria:
    - 'Recognize company-role-date, company/date-role, and role-date-company evidence.'
    - 'Support non-IT professional titles without role-specific business rules.'
    - 'Ambiguous experience and degraded OCR require manual review.'
    - 'Parse and match response contracts remain compatible.'
    - 'Full AI-service tests pass; no real CV is committed.'
  evidence_provenance:
    schema_version: 2
    head_commit: 'f979d99226da9a536e597cb3d14a086365b05a58'
    generated_plan_path: 'docs/plans/2026-09-27-gitnexus-plan-multidomain-cv-parser.md'
    global_dirty_digest:
      algorithm: 'sha256'
      canonicalization: 'gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records'
      value: '21d6446675d25f4cb0996234557939d53c8115fc692e119d35f6559000a32491'
    cited_path_manifest:
      - { path: 'ai-service/README.md', state: 'unstaged', head_digest: 'sha256:6f41c2b3877f7f641c9052c9303199095582bbfaf189634c8883d8a11927a8f4', index_digest: 'sha256:6f41c2b3877f7f641c9052c9303199095582bbfaf189634c8883d8a11927a8f4', worktree_digest: 'sha256:82563512575ed63beeea14c7ea973d5859978cacab3185fcfebbac3f0c3b88bd', untracked_digest: 'absent' }
      - { path: 'ai-service/app/api/cv.py', state: 'unstaged', head_digest: 'sha256:4fb3016f298cad36dca91c74e95f444078c77cc310fe69b79c2b1fe34b24211c', index_digest: 'sha256:4fb3016f298cad36dca91c74e95f444078c77cc310fe69b79c2b1fe34b24211c', worktree_digest: 'sha256:7bee4311dd83faa63a7bfaa604ba0b6fd537143abc972ccdb161f0bd51c65455', untracked_digest: 'absent' }
      - { path: 'ai-service/app/schemas/cv.py', state: 'unstaged', head_digest: 'sha256:9532730ba2d1dde0e28af2b01caafdb807ac04170b2fc117aabeef6600760f09', index_digest: 'sha256:9532730ba2d1dde0e28af2b01caafdb807ac04170b2fc117aabeef6600760f09', worktree_digest: 'sha256:b7e78928b927fa834284d5b7e4ab141f297ff6751bb31d298662225e40b5c7d4', untracked_digest: 'absent' }
      - { path: 'ai-service/app/services/document_parser.py', state: 'unstaged', head_digest: 'sha256:7eee5cf414ea311979cbbc46bd3342009dea5eb5487c321bcd4848dbf9454a6d', index_digest: 'sha256:7eee5cf414ea311979cbbc46bd3342009dea5eb5487c321bcd4848dbf9454a6d', worktree_digest: 'sha256:5e1d741aa347963eb5a80728b41e05f81e3f6c9cf61536bd6aaa29c4d0e5468a', untracked_digest: 'absent' }
      - { path: 'ai-service/app/services/structured_cv_parser.py', state: 'unstaged', head_digest: 'sha256:c13c73e1c93c8616b0893ad42fef9dbcd40a6d88cbe213e8bfb3da6c15924059', index_digest: 'sha256:c13c73e1c93c8616b0893ad42fef9dbcd40a6d88cbe213e8bfb3da6c15924059', worktree_digest: 'sha256:c7ea5eccca7994a82254b1c0256b3b53fe83febbcf0dab776e3e444095374437', untracked_digest: 'absent' }
      - { path: 'ai-service/tests/test_document_parser.py', state: 'unstaged', head_digest: 'sha256:b0c2e218247716ee91de5a544146d8c9f0a7b85d03e37ff244f87d99eb5e77cd', index_digest: 'sha256:b0c2e218247716ee91de5a544146d8c9f0a7b85d03e37ff244f87d99eb5e77cd', worktree_digest: 'sha256:d28950eb3a3244e460b904691f933f0586c74ad12f1d425a4e682380a90ec0bf', untracked_digest: 'absent' }
      - { path: 'ai-service/tests/test_structured_cv_parser.py', state: 'unstaged', head_digest: 'sha256:04e50c74acb6eb978575251ee86624f1ee70d21415601c078baf41cf443d168f', index_digest: 'sha256:04e50c74acb6eb978575251ee86624f1ee70d21415601c078baf41cf443d168f', worktree_digest: 'sha256:5ad125d6b7cc580aabf722744df881bfb46573207107493d8b66851f6dfd526d', untracked_digest: 'absent' }
  primary_symbols:
    - { symbol: 'DocumentParser._order_pdf_blocks', file: 'ai-service/app/services/document_parser.py', lines: '222-260', role: 'PDF reading order' }
    - { symbol: 'StructuredCvParser._parse_experience', file: 'ai-service/app/services/structured_cv_parser.py', lines: '249-349', role: 'experience reconstruction' }
    - { symbol: 'StructuredCvParser.parse_with_diagnostics', file: 'ai-service/app/services/structured_cv_parser.py', lines: '102-142', role: 'diagnostics/output' }
  related_symbols:
    - { symbol: '_parse_upload', relationship: 'shared parse boundary', relevance: 'used by both public endpoints' }
    - { symbol: '_heading_match', relationship: 'section routing', relevance: 'experience aliases' }
  execution_path:
    - 'Upload -> DocumentParser.parse -> block order/OCR -> StructuredCvParser.parse_with_diagnostics -> CvParseResponse.'
    - 'Match-file uses that parse result before matching.'
  pdg_constraints:
    - { description: 'PDG unavailable; preserve extraction -> section -> experience parse ordering.', affected_statements: ['document_parser.py:119-175', 'structured_cv_parser.py:102-142'], implementation_consequence: 'No score or API sequencing change.' }
  architectural_patterns:
    - { pattern: 'conservative evidence parser', example_location: 'ai-service/app/services/structured_cv_parser.py:249-349', usage_guidance: 'Ambiguity becomes manual review, never invented experience.' }
  files_to_modify:
    - { file: 'ai-service/app/services/document_parser.py', symbols: ['_order_pdf_blocks'], intended_change: 'date rail classification' }
    - { file: 'ai-service/app/services/structured_cv_parser.py', symbols: ['_heading_match', '_parse_experience', 'parse_with_diagnostics'], intended_change: 'domain-neutral reconstruction/diagnostics' }
    - { file: 'ai-service/tests/test_document_parser.py', symbols: ['layout tests'], intended_change: 'reading-order regression coverage' }
    - { file: 'ai-service/tests/test_structured_cv_parser.py', symbols: ['parser tests'], intended_change: 'multi-industry and ambiguity coverage' }
    - { file: 'ai-service/tests/test_cv_api.py', symbols: ['parse endpoint test'], intended_change: 'API compatibility' }
  tests:
    - { file: 'ai-service/tests/test_document_parser.py', scenarios: ['date rail remains row aligned', 'true sidebar remains column ordered'] }
    - { file: 'ai-service/tests/test_structured_cv_parser.py', scenarios: ['Sales/HR/Operations/Logistics title layouts', 'plural heading', 'ambiguous signal requires review'] }
    - { file: 'ai-service/tests/test_cv_api.py', scenarios: ['response warning and matching compatibility'] }
  verification_commands:
    - 'ai-service/.venv/Scripts/python.exe -m pytest -q'
  risks:
    - 'Never confuse date rail with sidebar.'
    - 'Role signals cannot be the sole source of truth.'
  assumptions:
    - 'User retains CVs locally for benchmark; no PII enters Git.'
  open_questions:
    - 'OCR hard timeout requires separate design if in-process library cannot be interrupted.'
  avoid:
    - 'Do not modify .NET projects.'
    - 'Do not automate shortlist or rejection.'
    - 'Do not log or commit raw CV contents.'
```

## 12. Assumptions and Open Questions

- [assumed] Local CV files remain available only for post-change benchmarking.
- [assumed] OCR hard cancellation is a separate concern unless parser work proves it required.
- Deferred: a durable anonymized benchmark dataset and a process-isolated OCR worker.

## 13. Definition of Done

- Tests cover all three experience layouts and non-IT professional titles.
- Date rail/sidebar ordering is regression protected.
- Ambiguous experience or poor OCR requires manual review.
- APIs remain compatible, full AI-service tests pass, and no PII is committed.
