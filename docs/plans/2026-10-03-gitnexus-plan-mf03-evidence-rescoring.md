# GitNexus Engineering Plan

> Task: Align MF-03 with the approved human-in-the-loop flow, propagate parser/matcher evidence, and support controlled rescoring without coupling AI to service fees or recruitment decisions.
> Evidence verified at commit `22726fb752acaa3a269299c98e4ba87d24736c4c`; GitNexus index refreshed this session with `node .gitnexus/run.cjs analyze --index-only --pdg` using CLI 1.6.12 / Node 24.21.0.
> Evidence provenance schema 2; global dirty digest `a3389f57c6a6aea14d7c050aee014cc2735ac6ad274844de8b0aba3673fbc118`; cited-path manifest 20 sorted entries; exact generated plan path excluded.

## 1. Objective

Deliver an end-to-end MF-03 result contract that distinguishes proven, partial, missing, and unreadable evidence; persists non-PII diagnostics per scoring attempt; exposes manual-review information to recruitment review; permits authorized rescoring of terminal attempts for explicit reasons; and updates the technical documentation/infographic to match the running MF-02 → MF-03 flow.

## 2. Current Behaviour

- [verified] Affiliate submissions create an Application, Attribution, and MF-03 request only after candidate consent is confirmed (`RespondSubmissionConsentCommandHandler.cs:100-186`); decline creates no MF-03 work (`RespondSubmissionConsentCommandHandlerTests.cs:27-85`).
- [verified] `ScoringOrchestrator.process` builds parse confidence/warnings but omits `diagnostics`, `semanticScore`, `missingRequirements`, and `matchingReasons` from the callback (`scoring_orchestrator.py:24-111`).
- [verified] The standalone parse endpoint already converts extraction/layout/warning state into non-PII diagnostics (`cv.py:32-50,61-98`), so background scoring and direct parsing currently expose different diagnostic quality.
- [verified] `AiResultCallbackProcessor.ProcessAsync` validates request/application/CV/job/attempt identity, computes Match Tier from active backend configuration, persists safe callback JSON, and rejects terminal-state downgrade (`AiIntegrationEndpoints.cs:153-259`).
- [verified] Safe callback serialization deliberately omits structured CV data, but it also omits parser diagnostics and matcher metadata (`AiIntegrationEndpoints.cs:262-277`).
- [verified] Internal HR retry currently permits only a latest `FAILED` attempt and rejects `COMPLETED`, `PENDING`, and `PROCESSING` (`RetryAiScoringCommand.cs:38-77`; tests at `RetryAiScoringCommandHandlerTests.cs:16-60`).
- [verified] Recruitment detail exposes score, tier, highlights, and status only (`RecruitmentApplicationDetailResponse.cs:87-96`; query mapping at `GetRecruitmentApplicationDetailQueryHandler.cs:144-150`).
- [verified] Matching supports `MATCHED`, `PARTIAL`, and `NOT_FOUND`, but not `UNKNOWN`; missing parse evidence can therefore be reported as candidate absence (`matching_response.py:8-26`; `requirement_matcher.py:60-120`).

## 3. Relevant Architecture

- [verified] HR Connect is the durable owner of `AiMatchResult`; MF-03 remains stateless with respect to PostgreSQL and sends results through the internal callback (`ai-service/README.md:41-75`).
- [verified] The dispatcher claims a durable attempt before enqueueing and preserves a newer callback state when dispatch fails (`Mf03ScoringDispatcher.cs:54-140`, source verified during planning).
- [verified] Backend, not AI, maps score to `MatchTierConfig` (`AiIntegrationEndpoints.cs:211-224`).
- [verified] `RawResponse` already provides a per-attempt JSONB envelope, so diagnostics and fingerprints can be persisted without changing the high-impact `AiMatchResult` schema (`AiMatchResult.cs:9-54`; `ApplicationDbContext.cs:337-380`).
- [inferred] Keeping new diagnostics inside the existing safe JSON envelope avoids a database migration and prevents unnecessary disruption to the 11 direct dependents of `AiMatchResult`.

## 4. GitNexus Findings

- [graph] `impact(ScoringOrchestrator, upstream, maxDepth:3)` reports LOW risk, 10 dependents, with three direct importers: `scoring_queue.py`, `scoring_worker.py`, and `test_scoring_worker.py`.
- [graph] `impact(AiResultCallbackProcessor.ProcessAsync#4, upstream, maxDepth:3)` reports LOW risk, two direct callers in `AiIntegrationEndpoints.cs`, and four callback processor tests at depth 2.
- [graph] `impact(RetryAiScoringCommandHandler, upstream, maxDepth:3)` reports LOW risk with direct dependencies in `InternalHrEndpoints.cs` and `RetryAiScoringCommandHandlerTests.cs`.
- [graph] `impact(AiMatchResult, upstream, maxDepth:3)` reports CRITICAL risk: 31 impacted symbols and 11 direct dependents across Candidates, Internal, Integration, Recruitment, and tests. The implementation therefore must not add entity columns unless the existing JSON envelope proves insufficient.
- [graph] `impact(GetRecruitmentApplicationDetailQueryHandler, upstream, maxDepth:3)` returned UNKNOWN/no resolved callers. Source search verified its response is served by `RecruitmentEndpoints.cs` and has unit-test coverage, so the graph zero is not treated as safety evidence.
- [graph] The refreshed graph contains 54,780 nodes, 93,542 edges, 450 clusters, and 189 flows at the pinned commit.

## 5. Statement-Level PDG Findings

- [graph] The repository was rebuilt with `--pdg`, but `pdg_query` returned no control-dependence edges for Python `ScoringOrchestrator.process` or the two C# central handlers. This is recorded as a source-weighted limitation, not as proof that the functions have no guards.
- [verified] Callback identity guards execute before any result mutation; terminal idempotency is checked before status-specific persistence (`AiIntegrationEndpoints.cs:159-205`).
- [verified] Score range validation and tier lookup control the completed-result mutation path (`AiIntegrationEndpoints.cs:205-237`).
- [verified] Retry eligibility is determined entirely by latest attempt status before `TriggerScoringAsync` creates the next durable attempt (`RetryAiScoringCommand.cs:42-65`).
- [verified] Parser warnings determine `requires_manual_review`; unresolved experience evidence caps confidence at 0.55 (`structured_cv_parser.py:171-194`, source verified during planning).

## 6. Proposed Changes

### 6.1 Shared parse diagnostics and background parity

- Refactor `_parse_diagnostics` from `ai-service/app/api/cv.py` into a shared, PII-free helper under `ai-service/app/services/` and use it in both `_parse_upload` and `ScoringOrchestrator.process`.
- Populate `CvParseResponse.diagnostics` in background scoring exactly as the direct parse endpoint does.
- Add callback fields for `parseConfidence`, `requiresManualReview`, `warnings`, `diagnostics`, `semanticScore`, `missingRequirements`, and `matchingReasons`.
- Add deterministic SHA-256 input fingerprints for downloaded CV bytes and canonical JD content; never place raw CV text, presigned URLs, emails, phone numbers, or structured CV data in the safe result envelope/logs.

### 6.2 Evidence state semantics

- Extend `RequirementMatch.matchStatus` and `matchMethod` with `UNKNOWN`.
- Extend the matching candidate contract with parser confidence/manual-review/warning context.
- Convert a negative requirement result to `UNKNOWN` only when diagnostics show the relevant source field/layout could not be reliably read; preserve `NOT_FOUND` when parsing was sufficiently reliable and no evidence exists.
- Keep UNKNOWN coverage at zero in the experimental score and mark the overall result as requiring manual review; do not let semantic similarity upgrade UNKNOWN/NOT_FOUND to MATCHED.

### 6.3 Safe callback persistence and review projection

- Extend `AiResultCallback` with optional backward-compatible diagnostic/matcher/fingerprint fields.
- Include only those non-PII fields in `SerializeSafeCallback`; continue excluding `StructuredCvData`.
- Keep Match Tier derivation in HR Connect and keep terminal callback idempotency unchanged.
- Parse the safe envelope into typed recruitment summary fields: parse confidence, requires-manual-review, warnings, diagnostics, semantic score, missing requirements, matching reasons, and input fingerprints. Malformed/legacy RawResponse must degrade to null/empty diagnostics without breaking application detail.
- Do not change `AiMatchResult` columns or create a migration in this phase.

### 6.4 Controlled retry versus rescore

- Replace the retry-only command input with an explicit reason enum: `FAILED_RETRY`, `JD_UPDATED`, `MANUAL_REVIEW`; retain existing authorization.
- Reject any request while the latest attempt is `PENDING` or `PROCESSING`.
- Permit `FAILED_RETRY` only after `FAILED`; permit `JD_UPDATED` and `MANUAL_REVIEW` after a terminal `COMPLETED` or `FAILED` result.
- Continue using the accepted submission's CV and current Job/JD. Actual CV replacement/version switching remains out of scope until a business-approved Application-to-CV version transition exists.
- Write the rescore reason into audit metadata and return it in the accepted response.

### 6.5 Documentation and visual flow

- Update `ai-service/MF03_IMPLEMENTATION_MAP.md` to current `main`, candidate-consent trigger semantics, background diagnostic contract, backend-owned tiering, retry/rescore rules, and explicit `EXPERIMENTAL` scoring status.
- Update `ai-service/README.md` with `MATCHED/PARTIAL/NOT_FOUND/UNKNOWN`, manual-review behavior, and safe callback fields.
- Add `docs/assets/mf03-ai-matching-flow.png` from the approved generated infographic and a concise `docs/mf03-ai-matching-flow.md` explaining the eight-step flow.
- State explicitly that MF-03 does not calculate Qualified/Counted CV, Service Fee, Commission, Attribution, shortlist, reject, offer, or placement.

## 7. Implementation Sequence

1. Add shared diagnostics builder; update direct parse and background orchestrator; add Python parity tests.
2. Extend matching contracts/status handling and conservative UNKNOWN behavior; add requirement and score regression tests.
3. Extend the Python callback payload with diagnostics, matcher metadata, and fingerprints; verify no PII enters logs or the safe envelope.
4. Extend the optional .NET callback contract and safe serializer; update callback tests for backward compatibility, idempotency, and PII exclusion.
5. Add defensive safe-envelope projection to recruitment detail DTO/query and unit tests for legacy, valid, and malformed JSON.
6. Add explicit retry/rescore reason validation and audit propagation; update endpoint description and retry tests.
7. Update MF-03 documentation and add the infographic asset.
8. Run Python and .NET suites, then run GitNexus `detect_changes(scope:all)`; inspect every HIGH/CRITICAL finding before any commit.

## 8. Test Strategy

- Python unit tests:
  - background scoring callback contains the same diagnostics as `/cv/parse`;
  - callback contains semantic/missing/reason fields and deterministic fingerprints;
  - callback/log assertions contain no raw CV, contact data, token, or URL;
  - reliable absence remains `NOT_FOUND`; parse uncertainty becomes `UNKNOWN`; partial evidence remains `PARTIAL`;
  - UNKNOWN contributes zero coverage and forces manual review without semantic promotion.
- .NET unit tests:
  - old callback payloads remain accepted;
  - new safe fields persist in `RawResponse`; structured CV/contact PII remains absent;
  - recruitment detail projects diagnostics and survives legacy/malformed RawResponse;
  - duplicate terminal callback remains idempotent;
  - retry/rescore reason/status matrix is enforced; in-flight attempts always return conflict;
  - Match Tier is still derived from active backend configuration.
- Existing consent tests must remain green to prove declined/unconfirmed Affiliate CVs never reach MF-03.
- Verification commands:
  - `cd ai-service; .venv/Scripts/python.exe -m pytest`
  - `dotnet test HRConnect/HRConnect.sln --configuration Release`
  - `node .gitnexus/run.cjs detect-changes --scope all --repo .`

## 9. Risk and Impact Analysis

- Callback contract drift: mitigate with optional fields and a legacy-payload test.
- Score interpretation: UNKNOWN must not inflate score; score remains experimental and human review is mandatory when uncertainty exists.
- PII leakage: RawResponse/log tests must prove structured CV and raw text remain excluded.
- Rescore storms: reject in-flight attempts and reuse the unique `(ApplicationId, AttemptNo)` sequence owned by `Mf03ScoringTrigger`.
- Audit ambiguity: distinguish retry from rescore by explicit reason; current CV replacement is not implied.
- Entity blast radius: do not modify `AiMatchResult` schema in this phase because GitNexus reports CRITICAL impact.
- Cross-platform evidence: WSL Git reports cited files as unstaged (consistent with line-ending interpretation) while Windows Git reported no short-status entries. The executor must re-anchor schema-2 evidence before editing and preserve worktree bytes.
- PDG limitation: refreshed layer produced no central-function edges; source guards and tests are authoritative for this plan.

## 10. Files Expected to Change

| File | Symbols | Reason |
| ---- | ------- | ------ |
| `ai-service/app/services/parse_diagnostics.py` | new helper | Shared PII-free diagnostics mapping |
| `ai-service/app/api/cv.py` | `_parse_upload` | Use shared diagnostics |
| `ai-service/app/services/scoring_orchestrator.py` | `ScoringOrchestrator.process` | Callback parity, evidence metadata, fingerprints |
| `ai-service/app/schemas/matching_request.py` | `Candidate`, `Job` | Carry parse context and optional JD version metadata |
| `ai-service/app/schemas/matching_response.py` | `RequirementMatch`, `MatchingResponse` | UNKNOWN/manual-review contract |
| `ai-service/app/services/requirement_matcher.py` | `RequirementMatcher.match` | Evidence-aware UNKNOWN classification |
| `ai-service/app/services/score_calculator.py` | `_ratio`, `calculate` | Conservative UNKNOWN handling |
| `ai-service/tests/test_scoring_worker.py` | scoring callback tests | Contract/privacy/fingerprint coverage |
| `ai-service/tests/test_requirement_matcher.py` | matcher tests | Four-state regression matrix |
| `HRConnect/HRConnect.Presentation/Endpoints/Internal/AiIntegrationEndpoints.cs` | `AiResultCallback`, `ProcessAsync`, `SerializeSafeCallback` | Receive and safely persist evidence metadata |
| `HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/RecruitmentApplicationDetailResponse.cs` | `RecruitmentAiMatchSummaryDto` | Review diagnostics contract |
| `HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/GetRecruitmentApplicationDetailQueryHandler.cs` | `Handle` plus safe parser helper | Expose attempt diagnostics defensively |
| `HRConnect/HRConnect.Application/Features/InternalHr/Commands/RetryAiScoring/RetryAiScoringCommand.cs` | command/handler | Explicit retry/rescore reasons |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/InternalHr/InternalHrEndpoints.cs` | retry route | Accept/document reason |
| related unit tests and MF-03 docs/assets | tests/docs | Regression and architecture alignment |

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: "Propagate MF-03 diagnostics/evidence, add conservative UNKNOWN semantics, expose review context, and permit controlled terminal rescoring."
  acceptance_criteria:
    - "Background and direct CV parsing emit equivalent non-PII diagnostics."
    - "Each requirement is MATCHED, PARTIAL, NOT_FOUND, or UNKNOWN with evidence."
    - "HR review receives parse confidence, warnings, diagnostics, and matching reasons."
    - "Tier remains backend-configured and AI never makes recruitment or financial decisions."
    - "Authorized terminal rescoring is reasoned, audited, and blocked while work is in flight."
    - "No AiMatchResult schema migration is introduced."
  evidence_provenance:
    schema_version: 2
    head_commit: "22726fb752acaa3a269299c98e4ba87d24736c4c"
    generated_plan_path: "docs/plans/2026-10-03-gitnexus-plan-mf03-evidence-rescoring.md"
    global_dirty_digest:
      algorithm: "sha256"
      canonicalization: "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records"
      value: "a3389f57c6a6aea14d7c050aee014cc2735ac6ad274844de8b0aba3673fbc118"
    cited_path_manifest:
      - { path: "HRConnect/HRConnect.Application/Features/InternalHr/Commands/RetryAiScoring/RetryAiScoringCommand.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:970c1f060ca29bee82c588d6f0b181488c399bfcc416a818d2f097fd0abb176f", index_digest: "sha256:970c1f060ca29bee82c588d6f0b181488c399bfcc416a818d2f097fd0abb176f", worktree_digest: "sha256:baed089cf4fe45b48ffefeb01df146a07a2c8782a15d796f274f0206003b70f7", untracked_digest: absent }
      - { path: "HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/GetRecruitmentApplicationDetailQueryHandler.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:6e2eee82bccdfed873e9f812c4e15d70e87ca7a0c32199ebd158e281bd9f2af2", index_digest: "sha256:6e2eee82bccdfed873e9f812c4e15d70e87ca7a0c32199ebd158e281bd9f2af2", worktree_digest: "sha256:751652e7840a39b60128ef21b2dd02c686cbe8dfcd3b53ebdc4f3c2194eced02", untracked_digest: absent }
      - { path: "HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/RecruitmentApplicationDetailResponse.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:6762762f3b46c9876be28ef45091152e32d915d63b4602cbd1cd418a08c6308d", index_digest: "sha256:6762762f3b46c9876be28ef45091152e32d915d63b4602cbd1cd418a08c6308d", worktree_digest: "sha256:9a4c8f9d1911c9726bc599e671bf257e0c18b3f1abfc3c5b0c8cc4ee6a4c6de1", untracked_digest: absent }
      - { path: "HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:d0302e6b761fc61362d78650d8cae3b6d12ae47875e42d0ad730fc32e4a29961", index_digest: "sha256:d0302e6b761fc61362d78650d8cae3b6d12ae47875e42d0ad730fc32e4a29961", worktree_digest: "sha256:7ea4b35c270d24655364a9448d7984b7aba7dadb6928a5249226fef2addd7f2b", untracked_digest: absent }
      - { path: "HRConnect/HRConnect.Presentation/Endpoints/Internal/AiIntegrationEndpoints.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:f8369b3f9c0f8123818e315fdbeec7bb7a9b967036dc55d63a2431d12bc24a34", index_digest: "sha256:f8369b3f9c0f8123818e315fdbeec7bb7a9b967036dc55d63a2431d12bc24a34", worktree_digest: "sha256:1c8d57c7a7a761585d93e23e5706caad1cc70d4a5c388f4428880ed8b9c02766", untracked_digest: absent }
      - { path: "HRConnect/HRConnect.Presentation/Endpoints/V1/InternalHr/InternalHrEndpoints.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:0a81a5aa1fbf023a603ee742cdecceed609b9d4ddd92468646002a40602d8b2f", index_digest: "sha256:0a81a5aa1fbf023a603ee742cdecceed609b9d4ddd92468646002a40602d8b2f", worktree_digest: "sha256:f7a612a9fdbe299d03fdcc9414a8affa124ef90e0f85dda17d6a5ed4885aab8c", untracked_digest: absent }
      - { path: "HRConnect/HRConnect.UnitTests/Endpoints/Internal/AiResultCallbackProcessorTests.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:11c23b55260626bb421aef5c1a7108d83075c1afc77ebc2f7f5e7cc25b11dcf1", index_digest: "sha256:11c23b55260626bb421aef5c1a7108d83075c1afc77ebc2f7f5e7cc25b11dcf1", worktree_digest: "sha256:50b5923868319735725d15042bf29fb0f03d048b55816febbea80a9c7bb9769b", untracked_digest: absent }
      - { path: "HRConnect/HRConnect.UnitTests/Features/InternalHr/RetryAiScoringCommandHandlerTests.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:c05a90e478269c77e139790276843b9c0e1c73198706b0bd98287b627bd41327", index_digest: "sha256:c05a90e478269c77e139790276843b9c0e1c73198706b0bd98287b627bd41327", worktree_digest: "sha256:1d391cb854805addc4dc5116184a1c03b29d41c5bab37bb8a91c6664ef7452c8", untracked_digest: absent }
      - { path: "HRConnect/HRConnect.UnitTests/Features/SubmissionConsents/RespondSubmissionConsentCommandHandlerTests.cs", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:1079b4f5d8d057e73d6364e68bbc17289ab208eee46ac5264c9c34697543ac6a", index_digest: "sha256:1079b4f5d8d057e73d6364e68bbc17289ab208eee46ac5264c9c34697543ac6a", worktree_digest: "sha256:8a056a28ebd4eab3be30d97c40783ddfe38ea42ad29a86db8a391ee841cb788c", untracked_digest: absent }
      - { path: "ai-service/MF03_IMPLEMENTATION_MAP.md", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:fa9045f0f47df51e39916a68a958eb1d32ef0ea812553a7e87b699b4b16f9189", index_digest: "sha256:fa9045f0f47df51e39916a68a958eb1d32ef0ea812553a7e87b699b4b16f9189", worktree_digest: "sha256:bd5e260d4e472444256e8c733ca611b99b6958fbae0558700670157b049582b5", untracked_digest: absent }
      - { path: "ai-service/README.md", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:f83eaebeca193bc19700b67f3aa264120e976a2f43f00c5c4c38e1fc16e0bc57", index_digest: "sha256:f83eaebeca193bc19700b67f3aa264120e976a2f43f00c5c4c38e1fc16e0bc57", worktree_digest: "sha256:05a211fe48b5864c65551e948fae6055d50f162bfa0d7960896f3ad1e9cda292", untracked_digest: absent }
      - { path: "ai-service/app/api/cv.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:c2acab0ae46b5818607c517d5bdd15d11330fe83a1216889d6c0dc0e20da695b", index_digest: "sha256:c2acab0ae46b5818607c517d5bdd15d11330fe83a1216889d6c0dc0e20da695b", worktree_digest: "sha256:ee9ff6468b705eb7da8d03b60eae928f742b347512eb217ac9319c6c04f064a0", untracked_digest: absent }
      - { path: "ai-service/app/schemas/cv.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:d7015e7a10678532fd5c82536b98c29c299c83ab129e089df5b587f6c7fa0f1d", index_digest: "sha256:d7015e7a10678532fd5c82536b98c29c299c83ab129e089df5b587f6c7fa0f1d", worktree_digest: "sha256:d5d73e0ca7f63e61e6195470547ca72c0742c0445bd49ab58bedd59be5500e24", untracked_digest: absent }
      - { path: "ai-service/app/schemas/matching_request.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:4b88e5227314621a2e07db29950b92d7f5af7b9ba565e9cf7a59536a13979c4e", index_digest: "sha256:4b88e5227314621a2e07db29950b92d7f5af7b9ba565e9cf7a59536a13979c4e", worktree_digest: "sha256:8fc1fcf58f214f28003a5c1e69977465b644031d86fbc43f8824af2668af2084", untracked_digest: absent }
      - { path: "ai-service/app/schemas/matching_response.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:73a9e440e2daef1829c8994726f64b51490495490bae1aaea5cbf39ca10ebed5", index_digest: "sha256:73a9e440e2daef1829c8994726f64b51490495490bae1aaea5cbf39ca10ebed5", worktree_digest: "sha256:39a690ab44159f5529fb8b61d1959e943f406868f3c6ade7cdfc73f80cd94877", untracked_digest: absent }
      - { path: "ai-service/app/services/requirement_matcher.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:348deccc69751ab7de9908f16ca7ad28253f50f065dfaf8f9b12468f26559e49", index_digest: "sha256:348deccc69751ab7de9908f16ca7ad28253f50f065dfaf8f9b12468f26559e49", worktree_digest: "sha256:6a9a2a65b4aa467e5aa1899628e084c66778be79594cb0057ed4c91297f64373", untracked_digest: absent }
      - { path: "ai-service/app/services/score_calculator.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:4562e93a358587bc1a552328c5374acb4c189a386f36f869fb1f2108ede58778", index_digest: "sha256:4562e93a358587bc1a552328c5374acb4c189a386f36f869fb1f2108ede58778", worktree_digest: "sha256:b2f1da0e32a1edcae2fc84f9efd8b0ddf310dffcbf55dd20c320211ece3d3f8b", untracked_digest: absent }
      - { path: "ai-service/app/services/scoring_orchestrator.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:40e8bd10f54d4224f6abe11ae053eb41c8d8951376b11b7dd05982298213bd80", index_digest: "sha256:40e8bd10f54d4224f6abe11ae053eb41c8d8951376b11b7dd05982298213bd80", worktree_digest: "sha256:9bb7b0a7bc39459d1f6c34cf435465536936294803d088c358b7f77115aa90ad", untracked_digest: absent }
      - { path: "ai-service/tests/test_requirement_matcher.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:bdfd1666bcc75c359c26d9c6011b30f80cfa27e8a656432fbf9dc3a66b8926ba", index_digest: "sha256:bdfd1666bcc75c359c26d9c6011b30f80cfa27e8a656432fbf9dc3a66b8926ba", worktree_digest: "sha256:0d09b1a8f9a2e7e8f492cd487b57ba03b92572112933ee89d29f0c62af873b0b", untracked_digest: absent }
      - { path: "ai-service/tests/test_scoring_worker.py", object_kind: { head: regular, index: regular, worktree: regular, untracked: absent }, state: unstaged, rename_from: null, rename_to: null, head_digest: "sha256:dec55e72be0b98080cc825d93e284e5e0245e20287df228b1ce7fd692e43ba12", index_digest: "sha256:dec55e72be0b98080cc825d93e284e5e0245e20287df228b1ce7fd692e43ba12", worktree_digest: "sha256:f53b36417c145cb0502add9e40af0a28da83fce70a11281e671f4ea7826cace2", untracked_digest: absent }
  files_to_modify:
    - "ai-service/app/api/cv.py"
    - "ai-service/app/services/scoring_orchestrator.py"
    - "ai-service/app/services/requirement_matcher.py"
    - "ai-service/app/services/score_calculator.py"
    - "ai-service/app/schemas/matching_request.py"
    - "ai-service/app/schemas/matching_response.py"
    - "HRConnect/HRConnect.Presentation/Endpoints/Internal/AiIntegrationEndpoints.cs"
    - "HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/GetRecruitmentApplicationDetailQueryHandler.cs"
    - "HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/RecruitmentApplicationDetailResponse.cs"
    - "HRConnect/HRConnect.Application/Features/InternalHr/Commands/RetryAiScoring/RetryAiScoringCommand.cs"
    - "HRConnect/HRConnect.Presentation/Endpoints/V1/InternalHr/InternalHrEndpoints.cs"
  new_files:
    - "ai-service/app/services/parse_diagnostics.py"
    - "docs/mf03-ai-matching-flow.md"
    - "docs/assets/mf03-ai-matching-flow.png"
  primary_symbols:
    - { name: "ScoringOrchestrator.process", file: "ai-service/app/services/scoring_orchestrator.py", responsibility: "background parse/match/callback orchestration" }
    - { name: "RequirementMatcher.match", file: "ai-service/app/services/requirement_matcher.py", responsibility: "four-state evidence classification" }
    - { name: "AiResultCallbackProcessor.ProcessAsync", file: "HRConnect/HRConnect.Presentation/Endpoints/Internal/AiIntegrationEndpoints.cs", responsibility: "validated safe result persistence and tier mapping" }
    - { name: "RetryAiScoringCommandHandler.Handle", file: "HRConnect/HRConnect.Application/Features/InternalHr/Commands/RetryAiScoring/RetryAiScoringCommand.cs", responsibility: "authorized retry/rescore state matrix" }
    - { name: "GetRecruitmentApplicationDetailQueryHandler.Handle", file: "HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/GetRecruitmentApplicationDetailQueryHandler.cs", responsibility: "human-review projection" }
  direct_dependents:
    - "ScoringOrchestrator: scoring_queue.py, scoring_worker.py, test_scoring_worker.py"
    - "AiResultCallbackProcessor.ProcessAsync: MapAiIntegrationEndpoints and loggerless ProcessAsync overload"
    - "RetryAiScoringCommandHandler: InternalHrEndpoints.cs and RetryAiScoringCommandHandlerTests.cs"
  tests:
    - "ai-service/tests/test_scoring_worker.py"
    - "ai-service/tests/test_requirement_matcher.py"
    - "HRConnect/HRConnect.UnitTests/Endpoints/Internal/AiResultCallbackProcessorTests.cs"
    - "HRConnect/HRConnect.UnitTests/Features/InternalHr/RetryAiScoringCommandHandlerTests.cs"
    - "HRConnect/HRConnect.UnitTests/Features/SubmissionConsents/RespondSubmissionConsentCommandHandlerTests.cs"
    - "Recruitment application detail query tests located by source search"
  verification_commands:
    - "cd ai-service; .venv/Scripts/python.exe -m pytest"
    - "dotnet test HRConnect/HRConnect.sln --configuration Release"
    - "node .gitnexus/run.cjs detect-changes --scope all --repo ."
  pdg_constraints:
    - "PDG layer refreshed successfully, but central functions returned no CDG edges; do not infer guard absence."
    - "Callback identity and terminal-state guards must remain before all persistence mutations."
    - "Retry/rescore must reject PENDING/PROCESSING before creating a new attempt."
  assumptions:
    - "JD_UPDATED means rescore against the current Job/JD and accepted CV, not historical JD reconstruction."
    - "RawResponse remains an internal safe JSON envelope and excludes structured CV/contact data."
  open_questions:
    - "Historical JD snapshots and candidate-selected replacement CV require separate domain design and are not included."
  avoid:
    - "Do not modify AiMatchResult schema or create a migration in this phase."
    - "Do not use ServiceType/source/commission as scoring inputs."
    - "Do not log or persist raw CV text, presigned URLs, service tokens, email, or phone in diagnostic envelopes."
    - "Do not auto-shortlist, auto-reject, create offers, or change placement/application state from MF-03."
```

## 12. Assumptions and Open Questions

- [assumed] The safe `RawResponse` JSON envelope is retained long enough for recruitment review; retention policy remains a business TBD.
- [assumed] A rescore of a completed attempt is allowed only when the caller supplies an approved reason and has `application.retry_ai_scoring`.
- Historical JD snapshotting and switching an Application to a newly uploaded CV are explicitly deferred because the current domain anchors an Application to its accepted Submission.
- A shared durable queue for multi-process production remains a separate infrastructure phase; HR Connect's durable pending rows continue to provide current recovery.
- Thresholds and scoring weights remain configurable/EXPERIMENTAL; this plan does not approve business calibration.

## 13. Definition of Done

- Background callbacks contain complete, non-PII parser/matcher diagnostics and deterministic input fingerprints.
- Requirement results support all four states with regression-tested conservative semantics.
- HR review can see uncertainty and missing evidence without reading raw CV text or internal service responses.
- Retry/rescore status and reason rules are enforced and audited; no duplicate in-flight attempt can be created through the endpoint.
- Existing consent, callback identity/idempotency, tier mapping, and recruitment-decision boundaries remain green.
- Python and .NET test suites pass; GitNexus change detection has no unresolved HIGH/CRITICAL finding.
- MF-03 docs and infographic describe the source-backed flow and clearly separate AI support from human and financial decisions.
