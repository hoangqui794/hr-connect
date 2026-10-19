# GitNexus Engineering Plan

> Task: Hoàn thiện MF02 để chống trùng Candidate khi Affiliate dùng email/số điện thoại khác, hợp nhất danh tính an toàn và xử lý khiếu nại/attribution ở mức production.
> Evidence verified at commit `be0042f1a74f6ec7bda4121090d9deb20d802c67`; GitNexus index refreshed this session with `--index-only --pdg` (96,040 nodes, 163,819 edges, 344 flows).
> Evidence provenance schema 2 could not be serialized by the mandated helper because it fails closed on Windows (`win32` has neither Linux `/proc/self/fd` nor macOS `O_DIRECTORY/O_NOFOLLOW`). The repository was clean before this plan was created; `gitnexus-work` must re-anchor provenance before implementation.

## 1. Objective

Xây dựng cơ chế nhận diện một người có thể xuất hiện dưới nhiều hồ sơ Candidate, nhưng không dùng CCCD và không tự kết luận chỉ từ dữ liệu gần giống. MF02 phải:

- giữ kiểm tra trùng chính xác theo email/số điện thoại hiện có;
- phát hiện trường hợp cùng người nhưng dùng email và số điện thoại khác bằng nhiều tín hiệu có giải thích;
- cho Candidate chứng minh quyền sở hữu danh tính;
- cho Admin xem bằng chứng, xem trước tác động và hợp nhất có kiểm soát;
- bảo toàn Submission, CV, Application, Attribution, Commission và Audit;
- xác định Affiliate thắng theo lượt hợp lệ được Candidate xác nhận sớm nhất;
- chặn chi hoa hồng trong lúc có khiếu nại;
- đáp ứng dữ liệu tối thiểu 50.000 Candidate mà không quét mờ toàn bảng trong request nộp CV.

Phạm vi triển khai là Backend MF02 và tài liệu bàn giao FE. Không sửa UI trong kế hoạch này. Không thu thập CCCD thường quy.

## 2. Current Behaviour

- [verified] `SubmitCandidateCommandHandler.Handle` chuẩn hóa email/phone, tìm Candidate theo email đã xác minh, email trên Candidate hoặc phone, và từ chối khi hai dữ liệu trỏ sang hai Candidate khác nhau (`HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs:177-258`).
- [verified] Nếu đã có Submission `ACCEPTED`, Application hoặc một consent còn hiệu lực cho đúng `CandidateId + JobId`, request bị chặn trước khi upload CV (`SubmitCandidateCommandHandler.cs:297-337`).
- [verified] Lượt mới được tạo với `PENDING_CONSENT`; Candidate/CV, consent token, email outbox và notification được lưu trước khi trả response (`SubmitCandidateCommandHandler.cs:416-553`).
- [verified] Khi Candidate xác nhận, handler kiểm tra trùng lần nữa, tạo `Application`, tạo `Attribution` với rule `CANDIDATE_CONSENT_THEN_FIRST_ACCEPTED`, rồi mới trigger MF03 (`RespondSubmissionConsentCommandHandler.cs:270-342`).
- [verified] Database bảo vệ một `ACCEPTED` và một `PENDING_CONSENT` trên mỗi `JobId + CandidateId`, đồng thời Application có unique `CandidateId + JobId` (`ApplicationDbContext.cs:535`, `2950-2962`).
- [verified] Candidate có thể claim email cũ bằng OTP. Khi cả hai hồ sơ đều có dữ liệu nghiệp vụ, Admin approval hiện trả “manual merge required”, chưa có merge thật (`ApproveIdentityClaimCommandHandler.cs:61-118`).
- [verified] `TrySwapIdentityCandidateAsync` chỉ đổi tài khoản từ placeholder rỗng sang hồ sơ cũ; nó từ chối nếu placeholder đã có CV, Submission, Application, JobMatch hoặc Skill (`CandidateRepository.cs:120-172`).
- [verified] Khiếu nại hiện hỗ trợ `DUPLICATE_SUBMISSION` và `ATTRIBUTION`; Admin có thể UPHELD/REJECTED, và UPHELD đổi Affiliate/WinningSubmission trên Attribution nếu commission chưa PAID (`DisputeFeatures.cs:85-172`, `199-299`).
- [verified] MF05 đã kiểm tra dispute `OPEN/UNDER_REVIEW` trước khi duyệt commission (`SettlementCommands.cs:149-160`; `FinanceRepository.cs:187-189`).
- [verified] Điểm thiếu cốt lõi: `Submission` không có snapshot danh tính; `Dispute` và `Attribution` không có concurrency token; Candidate chỉ có một email/phone chuẩn hóa; không có duplicate case, tín hiệu CV, preview merge hoặc merge hồ sơ có dữ liệu (`Candidate.cs`, `Submission.cs`, `Attribution.cs`, `Dispute.cs`).

## 3. Relevant Architecture

### 3.1 Ranh giới sở hữu

- [verified] **MF02** sở hữu Candidate identity, Affiliate Submission, consent, duplicate case, merge, Attribution decision và dispute workflow.
- [inferred] **MF01** chỉ cung cấp Job, Company, Service Type và quyền nộp; MF02 không thay đổi quy tắc tạo/tìm Job.
- [verified] **MF03** chỉ nhận scoring sau khi Submission trở thành `ACCEPTED`; không chạy khi đang consent hoặc identity review.
- [verified] **MF05** đọc Attribution/Commission và đã giữ commission khi dispute đang hoạt động. MF02 chỉ thay đổi attribution bằng transaction và audit, không tự tạo nghiệp vụ payout.
- [inferred] **FE** chỉ tích hợp API/status mới sau khi Backend hoàn tất; hợp đồng được ghi tại `HRConnect-FE/docs/integration/MF02/13-CANDIDATE-DUPLICATE-CASES.md`.

### 3.2 Mô hình nhận diện đề xuất

Tách ba mức để tránh false positive:

1. **Deterministic identity**: email đã xác minh hoặc số điện thoại đã xác minh. Có thể dùng để resolve cùng Candidate ngay.
2. **Strong duplicate signal**: cùng SHA-256 nội dung PDF và tên chuẩn hóa; hoặc tên + ngày sinh + phone/email alias đã xác minh. Tạo case và tạm giữ bước accept nếu cùng Job/cùng doanh nghiệp.
3. **Review-only signal**: text fingerprint của CV, tên gần giống, học vấn/kinh nghiệm gần giống. Chỉ tạo cảnh báo; tuyệt đối không tự merge, tự từ chối hoặc đổi attribution.

CCCD không nằm trong mô hình vì tăng rủi ro dữ liệu nhạy cảm, không cần thiết để đạt yêu cầu và không giải quyết được consent/attribution tốt hơn xác minh contact + evidence.

### 3.3 Nguyên tắc hợp nhất

- Hợp nhất là **logical merge**: Candidate nguồn được `ARCHIVED`, trỏ `MergedIntoCandidateId` trực tiếp tới canonical Candidate; lịch sử cũ giữ nguyên FK và được truy vấn qua identity family.
- Không xóa hay viết lại Submission/CV/Audit cũ. Các query mới resolve canonical Candidate và tập descendant đã merge.
- Mọi merge phải khóa hai Candidate theo thứ tự GUID cố định, dùng concurrency token của duplicate case, chạy trong một transaction và có idempotency key.
- Nếu hai hồ sơ có cùng Job, merge preview phải xác định winner trước. Application thua được đóng bằng reason công khai phù hợp; Attribution thua chuyển `SUPERSEDED`; commission chưa trả bị giữ/hủy theo kết quả. Nếu đã PAID, merge bị chặn để Admin xử lý tài chính trước.

## 4. GitNexus Findings

- [graph] `impact(target_uid=SubmitCandidateCommandHandler.Handle, direction=upstream, depth=3)` trả `risk=CRITICAL`, 34 direct callers, toàn bộ nằm trong `SubmitCandidateCommandHandlerTests`; thêm logic trực tiếp vào handler phải giữ nguyên lỗi/status cũ. GitNexus cũng báo incoming là lower-bound do 3 call site không suy ra được receiver type.
- [graph] `impact(target_uid=RespondSubmissionConsentCommandHandler.Handle, direction=upstream, depth=3)` trả `risk=MEDIUM`, 13 direct callers trong `RespondSubmissionConsentCommandHandlerTests`; các nhánh confirm/decline/expiry/replacement phải tiếp tục hoạt động.
- [graph] `impact(target_uid=VerifyCandidateIdentityClaimCommandHandler.Handle, direction=upstream, depth=3)` trả 3 direct callers; `ApproveIdentityClaimCommandHandler.Handle` trả 5; đây là seam phù hợp để mở rộng claim từ email-only sang contact identity và manual merge.
- [graph] `impact(target_uid=DisputeHandlers.Handle(ResolveDisputeCommand), direction=upstream, depth=3)` trả 3 direct tests: REJECTED giữ attribution, UPHELD chuyển attribution/commission chưa trả, và PAID phải bị từ chối.
- [graph] `context(name=Handle, file_path=...SubmitCandidateCommandHandler.cs)` xác nhận handler gọi Candidate, Submission, Application, storage, audit, notification, finance replacement và consent repositories; nên extract orchestration sang identity services thay vì tiếp tục phình handler.
- [graph] `query("candidate identity claim verify merge duplicate profile admin approval")` tìm thấy cả Candidate portal, Admin identity claim page, migration identity claim và tests; API mới cần tương thích với email identity flow hiện có.
- [graph] `query("dispute attribution commission transfer freeze resolve duplicate submission")` liên kết dispute với Attribution và Finance; thay đổi dispute phải regression cả MF05 commission hold.
- [verified] Direct dependents được tính đầy đủ theo file: 34 methods trong `SubmitCandidateCommandHandlerTests.cs`, 13 methods trong `RespondSubmissionConsentCommandHandlerTests.cs`, 3 methods trong `DisputeTests.cs`, 3 verify-claim tests và 5 approve-claim tests. Không đổi constructor/response cũ nếu không có adapter/default field.

## 5. Statement-Level PDG Findings

### 5.1 Affiliate submission

- [graph] `pdg_query(mode=controls, target=...SubmitCandidateCommandHandler.cs)` xác nhận nhánh exact-email/phone điều khiển Candidate resolution; duplicate/application checks xảy ra trước upload; tạo Candidate, upload, Submission và consent chỉ đi tiếp sau toàn bộ guard.
- [graph] PDG cũng xác nhận unique-violation branch rollback transaction, bồi hoàn file storage và ghi blocked duplicate. Đây là ordering constraint bắt buộc.
- [inferred] Tính fingerprint phải thực hiện trong cùng một lần đọc/validate stream ở storage service; không đọc lại stream trong handler và không tải file lên trước khi các deterministic guard hoàn tất.
- [inferred] Fuzzy detection không được chạy đồng bộ trong request. Handler chỉ tra index exact/high-confidence có giới hạn; phần similarity chạy worker/outbox.

### 5.2 Consent acceptance

- [graph] `pdg_query(mode=controls, target=...RespondSubmissionConsentCommandHandler.cs)` xác nhận expiry/decline/job/candidate/affiliate guards chạy trước transaction; trong transaction có ownership lock, recheck duplicate, đổi consent/submission, lưu accepted status, tạo Application/Attribution và trigger scoring.
- [inferred] Identity-review gate phải đặt sau consent được xác minh nhưng trước `Application`/`Attribution`/MF03. Khi gate kích hoạt, consent có thể là `CONFIRMED`, Submission chuyển `PENDING_IDENTITY_REVIEW`, và response không được nói hồ sơ đã được tiếp nhận.
- [inferred] Khi duplicate case được resolve, một finalize service dùng lại đúng acceptance invariant; không copy rời logic tạo Application/Attribution/MF03 sang Admin handler.

### 5.3 Dispute resolution

- [graph] `pdg_query(mode=controls, target=...DisputeFeatures.cs)` cho thấy `UPHELD` gọi `TransferAttributionAsync`; `attribution == null`, complainant không tồn tại hoặc đã là owner hiện chỉ return rồi dispute vẫn được UPHELD.
- [verified] `Dispute` không có concurrency token và resolve không mở transaction rõ ràng (`Dispute.cs`; `DisputeFeatures.cs:199-244`). Hai Admin có thể cùng xử lý trên trạng thái đọc cũ.
- [inferred] Resolve phải khóa dispute + attribution + commission, yêu cầu concurrency token, phân biệt outcome `NO_TRANSFER_REQUIRED` với lỗi dữ liệu, và commit audit/notification cùng transaction.

## 6. Proposed Changes

### 6.1 Data model và migration

1. **`CandidateDuplicateCase` + `CandidateDuplicateSignal`**
   - File mới: `HRConnect/HRConnect.Domain/Entities/CandidateDuplicateCase.cs`, `CandidateDuplicateSignal.cs`.
   - Case lưu `CandidateAId`, `CandidateBId` theo thứ tự ổn định, optional `SubmissionId/JobId`, `RiskLevel`, `Status` (`OPEN`, `AWAITING_CANDIDATE`, `UNDER_REVIEW`, `MERGED`, `DISMISSED`, `BLOCKED_FINANCE`), `Resolution`, reviewer, timestamps, `ConcurrencyToken`, `IdempotencyKey`.
   - Signal lưu reason code, detector version, score, hash/key version và JSON evidence đã giảm PII. Unique active case trên cặp Candidate có thứ tự + Job scope để tránh spam.

2. **`SubmissionIdentitySnapshot`**
   - File mới: `HRConnect/HRConnect.Domain/Entities/SubmissionIdentitySnapshot.cs`.
   - Quan hệ one-to-one với Submission; lưu full-name normalized hash, email HMAC, phone HMAC, CV binary SHA-256, CV text fingerprint/version, asserted contact source, verification level, captured server time.
   - Không lưu raw CV text. Email/phone hiển thị lấy từ nguồn hiện có và luôn mask trong Admin DTO; snapshot dùng HMAC có key version, không dùng plain SHA-256 cho dữ liệu đoán được.

3. **Candidate/CV/Submission/Attribution/Dispute**
   - `Candidate`: thêm `MergeConcurrencyToken`; merge chain phải được flatten về canonical một cấp.
   - `CandidateCv`: thêm `ContentSha256`, `TextFingerprint`, `FingerprintVersion` và index phù hợp; hash được tạo trong upload pipeline.
   - `Submission`: thêm status `PENDING_IDENTITY_REVIEW` và quan hệ snapshot.
   - `Attribution`, `Dispute`: thêm `ConcurrencyToken`; Attribution thêm `SUPERSEDED` vào constraint nếu chưa có.
   - Bỏ unique “một pending consent trên Candidate+Job”; thay bằng unique active pending trên `CandidateId + JobId + SubmittedBy`, vẫn giữ một `ACCEPTED`. Điều này ngăn Affiliate đầu tiên giữ chỗ 48 giờ mà Candidate chưa xác nhận.

4. **Migration/backfill**
   - Migration additive, không drop dữ liệu trong lần đầu.
   - Backfill snapshot theo batch, checkpoint/idempotent; HMAC email/phone từ normalized fields, CV hash chỉ tính khi object storage đọc được.
   - Rows không đọc được CV được đánh `FINGERPRINT_PENDING/UNAVAILABLE`, không khóa hồ sơ.
   - Thêm index: email/phone HMAC + key version; CV hash; duplicate case status/created; ordered candidate pair; merged target; Submission status/job/candidate/submittedBy.

### 6.2 Identity services

1. Tạo `ICandidateIdentityResolver` để gom exact email identity, verified phone identity, Candidate legacy fields và canonical resolution. Handler chỉ nhận kết quả `ExactMatch`, `Conflict`, `NoMatch`.
2. Tạo `ICandidateDuplicateDetector`:
   - synchronous: indexed exact verified contact và exact CV hash + normalized-name hash;
   - asynchronous: bounded candidates từ hash/name prefix/date-of-birth, sau đó tính similarity;
   - trả reason codes có giải thích; không trả một boolean mơ hồ.
3. Tạo `ICandidateCanonicalResolver` để resolve source → canonical, detect cycle, flatten chain và lấy identity family IDs cho duplicate query.
4. Mở rộng identity claim để hỗ trợ verified phone alias khi có SMS provider; email flow cũ giữ nguyên. Nếu SMS chưa cấu hình, API trả capability disabled, không giả lập OTP.

### 6.3 Submission và consent

1. `CvStorageService.UploadCvPdfCoreAsync` tính hash trong lúc validate/copy stream và trả fingerprint metadata trong `UploadCvResult`.
2. `SubmitCandidateCommandHandler.Handle`:
   - giữ tất cả authorization/job/ownership guard hiện có;
   - resolve canonical identity qua service;
   - tạo immutable snapshot cùng transaction với Submission;
   - cho nhiều Affiliate tạo `PENDING_CONSENT` riêng; response không lộ người nộp khác;
   - high-confidence same-job suspect tạo/reuse duplicate case và trả trạng thái chung “cần Candidate xác minh”, không tự merge.
3. `RespondSubmissionConsentCommandHandler.Handle`:
   - Candidate xác nhận consent vẫn được ghi nhận idempotently;
   - nếu duplicate case cùng Job cần review, chuyển Submission sang `PENDING_IDENTITY_REVIEW`, không tạo Application/Attribution/MF03;
   - nếu không có hold, transaction acceptance cũ tiếp tục;
   - winner là consent `CONFIRMED` có `RespondedAt` sớm nhất; tie-break bằng server `SubmittedAt`, sau đó `SubmissionId`. Không dùng thời gian do client gửi.
4. Tạo `FinalizeIdentityReviewedSubmissionService` dùng chung acceptance logic sau khi case được merge/dismiss; recheck job, ownership, replacement slot, accepted winner và finance trước commit.

### 6.4 Candidate self-service

- Giữ API email claim hiện có và bổ sung danh sách case chỉ chứa thông tin của chính Candidate.
- Candidate có thể chọn “đây là hồ sơ của tôi”, sau đó phải chứng minh contact cũ qua OTP hoặc đang đăng nhập đúng account sở hữu verified identity.
- Candidate không bao giờ thấy tên Affiliate đối thủ, email/phone đầy đủ của hồ sơ kia hoặc ghi chú Admin.
- Khi Candidate chứng minh cả hai identity và không có collision ứng tuyển/tài chính, case có thể auto-merge qua cùng merge service; có collision thì chuyển Admin.

### 6.5 Admin duplicate-case và merge API

Thêm endpoints có permission `candidate_duplicate.view` và `candidate_duplicate.resolve`:

- `GET /api/v1/admin/candidate-duplicate-cases` — phân trang, lọc status/risk/job/company/date.
- `GET /api/v1/admin/candidate-duplicate-cases/{caseId}` — dữ liệu mask, signals, consent timeline, submissions/applications/attributions/commissions liên quan.
- `POST /api/v1/admin/candidate-duplicate-cases/{caseId}/preview-merge` — read-only, trả canonical đề xuất, collisions và finance blockers.
- `POST /api/v1/admin/candidate-duplicate-cases/{caseId}/resolve` — `MERGE`, `DISMISS`, `NEED_MORE_EVIDENCE`; bắt buộc `concurrencyToken`, `idempotencyKey`, reason.

`CandidateMergeService` phải:

- khóa case, hai Candidate và affected attribution/commission theo thứ tự ổn định;
- re-run preview trong transaction;
- chặn merge nếu có paid commission chưa điều chỉnh;
- chọn canonical theo verified account trước, dữ liệu nghiệp vụ hợp lệ sau, rồi `CreatedAt/CandidateId` để tie-break;
- archive source, flatten merge pointer, chuyển verified aliases;
- không đổi lịch sử FK; cập nhật read models/canonical resolution;
- resolve overlapping Job theo earliest confirmed valid consent;
- đóng Application thua với reason riêng, supersede attribution thua, xử lý commission chưa trả;
- audit before/after IDs, signals, winner rule, impacted entity IDs và correlation ID;
- phát notification riêng tư cho Candidate và các Affiliate bị ảnh hưởng.

### 6.6 Dispute production hardening

- `CreateDisputeCommand`: hỗ trợ evidence records/attachment object keys thay vì một chuỗi JSON tự do; validate MIME/size/ownership và signed URL ngắn hạn.
- `ResolveDisputeCommand`: thêm concurrency token; transaction rõ ràng; lock dispute/attribution/commission; idempotent cùng decision; stale request trả `409 STALE_DISPUTE`.
- Không cho UPHELD “thành công rỗng”: nếu không có attribution thì chỉ hợp lệ khi resolution type là `NO_ATTRIBUTION_YET`; nếu lẽ ra phải transfer mà không có dữ liệu, trả conflict và giữ case mở.
- Khi duplicate merge tạo collision, liên kết `DuplicateCaseId` với Dispute để Admin nhìn chung evidence, nhưng giữ lifecycle riêng.
- Tiếp tục finance hold đang có; thêm integration test đảm bảo OPEN/UNDER_REVIEW case/dispute chặn approve/payout, resolve mới giải phóng.

### 6.7 Privacy, security, observability

- Dùng HMAC-SHA256 với secret key ring/version trong secret manager cho email/phone snapshot; hỗ trợ rotate/backfill kép. Không ghi raw PII, OTP, token hoặc CV text vào log/audit.
- Rate-limit start/resend/verify claim theo account + hashed contact + IP; generic response chống enumeration.
- RBAC tách view/resolve; Admin detail mask mặc định, chỉ reveal tối thiểu khi permission riêng tồn tại.
- Retention: evidence attachment hết hạn theo chính sách dispute; hash/audit giữ theo yêu cầu pháp lý; delete request không làm mất financial audit bắt buộc.
- Metrics: exact-match rate, suspected-case rate theo reason, false-positive/dismiss rate, merge latency, stale conflict, held commissions, finalize failures, queue lag.
- Structured log dùng `correlationId`, `caseId`, `submissionId`, `candidateId` nhưng không ghi email/phone/name.

### 6.8 FE handoff document

Tạo `HRConnect-FE/docs/integration/MF02/13-CANDIDATE-DUPLICATE-CASES.md` sau khi API ổn định, gồm routes, DTO, permissions, status labels, error codes, polling/invalidation, optimistic concurrency, privacy rules và ma trận màn hình Candidate/Affiliate/Admin. Đây là tài liệu để dev FE tự làm; kế hoạch không sửa FE component.

## 7. Implementation Sequence

1. **Chốt invariants và contract tests**: thêm constants/status/error codes/DTO compatibility tests; giữ response cũ và chỉ thêm nullable fields.
2. **Fingerprint pipeline**: mở rộng `UploadCvResult`, `CandidateCv`, storage service và tests để tính hash một lần, không đổi quy tắc PDF/storage.
3. **Schema additive**: thêm entities, DbSets/config/index/concurrency, migration và model snapshot; chạy migration trên PostgreSQL test database.
4. **Backfill job**: thêm batch command/worker có checkpoint, dry-run metrics và retry; chưa bật detection.
5. **Extract identity resolver**: chuyển exact-match code khỏi Submit handler sang service, giữ nguyên hành vi qua 34 regression tests.
6. **Duplicate detector + case repository**: synchronous indexed rules, async worker, idempotent case upsert, feature flags `IdentityDuplicateDetection:ShadowMode` và thresholds.
7. **Submission snapshot/multi-pending**: ghi snapshot, đổi pending uniqueness và bảo vệ race; ban đầu chạy shadow mode, chưa hold.
8. **Consent identity-review gate**: thêm status/hold/finalize service; đảm bảo MF03 chỉ nhận accepted winner.
9. **Canonical resolver + merge preview/service**: logical merge, collision matrix, finance blockers, audit/notification, idempotency/concurrency.
10. **Candidate identity APIs**: case summary/self-claim, email compatibility và optional phone capability.
11. **Admin APIs/RBAC**: queue/detail/preview/resolve, permission seed và audit coverage.
12. **Dispute hardening**: concurrency, transaction, evidence storage, no-op transfer fix, duplicate-case link.
13. **MF05 integration tests**: commission hold/transfer/supersede/paid blockers; không đổi public MF05 API nếu không cần.
14. **Observability và rollout**: metrics/alerts/dashboard, shadow report, threshold tuning, then enable hold for same-job high-confidence only.
15. **FE handoff + final verification**: viết doc hợp đồng từ OpenAPI thực tế, chạy full test/load/security checks và GitNexus `detect_changes` trước từng commit.

Mỗi bước phải để tree build được. Migration destructive cleanup và xóa legacy path chỉ thực hiện ở release sau khi backfill/monitor ổn định.

## 8. Test Strategy

### 8.1 Unit/regression

- `SubmitCandidateCommandHandlerTests.cs`: giữ toàn bộ 34 direct tests; thêm different email+phone + same CV/name; same CV khác người; nhiều pending từ Affiliate khác; snapshot/HMAC; storage compensation; shadow mode.
- `RespondSubmissionConsentCommandHandlerTests.cs`: giữ 13 direct tests; thêm confirmed-but-held; earliest confirmed wins; tie-break; case dismissed/merged finalize; MF03 exactly once.
- Identity claim tests: email flow không đổi; verified phone capability; proof không đủ; both profiles have business data routes to case; stale token/idempotency.
- `DisputeTests.cs`: giữ 3 resolve direct tests và các create/list/privacy tests; thêm stale concurrency, double resolve, missing attribution, linked duplicate case, evidence authorization.
- `AffiliateCommissionHoldTests.cs`: OPEN/UNDER_REVIEW hold, DISMISSED/REJECTED release, MERGED/UPHELD transfer, PAID blocker.

### 8.2 Integration/PostgreSQL

- Hai Affiliate submit đồng thời cùng verified identity/job → chỉ một accepted winner, không duplicate Application/Attribution.
- Hai hồ sơ khác contact nhưng same high-confidence signals → case idempotent, consent xác nhận được nhưng acceptance bị hold.
- Hai Admin resolve cùng case → một commit, request stale nhận 409.
- Merge hai Candidate có overlapping jobs → preview khớp mutation; history không mất; winner đúng rule; loser application/attribution ở trạng thái terminal.
- Merge gặp PAID commission → rollback toàn bộ, case `BLOCKED_FINANCE`, không đổi Candidate.
- Worker retry/outbox duplicate delivery → không tạo case, notification hoặc MF03 trùng.
- Migration/backfill chạy lại hai lần → không đổi kết quả, không khóa bảng lâu vượt budget.

### 8.3 Security/privacy

- Affiliate không xem identity/case của Affiliate khác.
- Candidate chỉ xem case của identity family mình đã xác minh.
- Admin thiếu permission bị 403; stale concurrency bị 409.
- API/log/audit không chứa raw OTP/token/CV text và không trả email/phone đầy đủ.
- Evidence signed URL hết hạn; object key không đoán/đọc chéo được.

### 8.4 Performance

- Seed ít nhất 50.000 Candidate, 200.000 Submission, 100.000 CV fingerprints.
- Exact lookup p95 mục tiêu < 150 ms ở DB; submit API không tính fuzzy toàn bảng; request end-to-end không tăng quá 20% so với baseline không upload.
- Background detector xử lý batch có giới hạn, queue lag có alert; truy vấn Admin p95 < 500 ms với pagination/index.
- Dùng `EXPLAIN (ANALYZE, BUFFERS)` cho HMAC/hash/case queue/family queries và lưu baseline trong test artifact.

### 8.5 Verification commands

```powershell
dotnet restore HRConnect/HRConnect.sln
dotnet build HRConnect/HRConnect.sln --no-restore
dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --no-build
dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --no-build --filter "FullyQualifiedName~SubmitCandidateCommandHandlerTests|FullyQualifiedName~RespondSubmissionConsentCommandHandlerTests|FullyQualifiedName~IdentityClaim|FullyQualifiedName~DisputeTests|FullyQualifiedName~AffiliateCommissionHoldTests"
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Thêm PostgreSQL integration/load project command khi project đó được tạo; không dùng EF InMemory để kết luận race/unique/locking đúng.

## 9. Risk and Impact Analysis

- **CRITICAL — Submit handler**: 34 direct test dependents và 3 caller chưa resolve trong graph. Extract service phải là behavior-preserving; error code/message/status cũ là compatibility contract.
- **MEDIUM — Consent handler**: 13 direct test dependents. Sai ordering có thể tạo Application/Attribution/MF03 trước review hoặc trigger hai lần.
- **MEDIUM — Admin identity approval**: 5 direct tests. Flow placeholder-swap hiện có phải tiếp tục; business-data merge đi path mới.
- **LOW graph / HIGH business — Dispute resolve**: chỉ 3 direct callers nhưng chạm tiền. Concurrency/transaction và PAID blocker là release gate.
- **Migration**: thay pending unique index có race window; deploy migration trước code và bật feature flag sau. Backfill phải batch, retry và quan sát lock.
- **False positive**: cùng template CV hoặc cùng tên không chứng minh cùng người. Review-only signal không được tự block/merge; chỉ high-confidence same-job mới hold.
- **False negative**: ảnh scan/CV chỉnh nhẹ làm hash khác. Async fingerprint hỗ trợ cảnh báo, không hứa chống trùng tuyệt đối.
- **Attribution fairness**: không lấy `SubmittedAt` một mình vì Affiliate có thể giữ chỗ bằng contact giả; winner dựa Candidate-confirmed valid submission, server timestamps và deterministic tie-break.
- **Finance**: logical merge có thể tạo overlapping accepted histories. Không hard-delete; paid money luôn chặn auto-resolution.
- **Privacy**: HMAC secret mất sẽ làm matching snapshot không dùng được; cần key version/rotation/dual-read. Không đưa CCCD vào scope.
- **Storage**: hash/fingerprint phải đi cùng stream pipeline; lỗi DB sau upload vẫn phải compensation như hiện tại.
- **GitNexus limitation**: impact incoming là lower-bound do 3 unresolved receiver call sites; implementation phải bổ sung `rg`/compiler/tests và `detect_changes`, không coi graph là complete.

## 10. Files Expected to Change

| File | Symbols | Reason |
| ---- | ------- | ------ |
| `HRConnect/HRConnect.Domain/Entities/Candidate.cs` | `Candidate` | Merge concurrency/canonical metadata |
| `HRConnect/HRConnect.Domain/Entities/CandidateCv.cs` | `CandidateCv` | CV fingerprints |
| `HRConnect/HRConnect.Domain/Entities/Submission.cs` | `Submission` | Identity-review state/snapshot relation |
| `HRConnect/HRConnect.Domain/Entities/SubmissionConsent.cs` | `SubmissionConsent` | Verified decision metadata if required |
| `HRConnect/HRConnect.Domain/Entities/Attribution.cs` | `Attribution` | Concurrency/superseded state |
| `HRConnect/HRConnect.Domain/Entities/Dispute.cs` | `Dispute` | Concurrency, duplicate-case/evidence linkage |
| `HRConnect/HRConnect.Domain/Entities/CandidateDuplicateCase.cs` | new entity | Review/merge lifecycle |
| `HRConnect/HRConnect.Domain/Entities/CandidateDuplicateSignal.cs` | new entity | Explainable signals |
| `HRConnect/HRConnect.Domain/Entities/SubmissionIdentitySnapshot.cs` | new entity | Immutable intake evidence |
| `HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs` | model configuration | Constraints/indexes/relations |
| `HRConnect/HRConnect.Infrastructure/Migrations/*CandidateIdentityDedup*` | migration/snapshot | Additive schema and index rollout |
| `HRConnect/HRConnect.Infrastructure/Repositories/CandidateRepository.cs` | identity/canonical queries | Family resolution/locks |
| `HRConnect/HRConnect.Infrastructure/Repositories/DisputeRepository.cs` | dispute locking | Transaction-safe resolution |
| `HRConnect/HRConnect.Infrastructure/Repositories/FinanceRepository.cs` | finance blockers | Case/dispute hold support |
| `HRConnect/HRConnect.Infrastructure/Services/Storage/CvStorageService.cs` | `UploadCvPdfCoreAsync` | One-pass fingerprinting |
| `HRConnect/HRConnect.Application/Common/Models/CvStorageModels.cs` | `UploadCvResult` | Return fingerprint metadata |
| `HRConnect/HRConnect.Application/Features/CandidateDuplicates/**` | new services/commands/queries | Detection, preview, merge, finalize |
| `HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs` | `Handle` | Delegate identity, snapshot, cases |
| `HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs` | `Handle` | Review gate/finalization |
| `HRConnect/HRConnect.Application/Features/Candidates/Identity/**` | claim handlers | Candidate proof/contact aliases |
| `HRConnect/HRConnect.Application/Features/Admin/IdentityClaims/**` | approval handlers | Route business-data conflicts to merge case |
| `HRConnect/HRConnect.Application/Features/Disputes/DisputeFeatures.cs` | create/resolve/transfer | Concurrency/evidence/no-op fix |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs` | candidate identity routes | Self-service case/proof APIs |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/Admin/AdminApprovalEndpoints.cs` | admin identity routes | Queue/detail/preview/resolve APIs |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/Disputes/DisputeEndpoints.cs` | dispute routes/DTOs | Concurrency/evidence contract |
| `HRConnect/HRConnect.UnitTests/Features/**` | existing + new suites | Regression, merge, race, privacy, finance |
| `HRConnect-FE/docs/integration/MF02/13-CANDIDATE-DUPLICATE-CASES.md` | new handoff doc | FE integration after API completion |

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: 'Production-grade MF02 identity deduplication, logical merge, fair attribution and dispute resolution without CCCD.'
  acceptance_criteria:
    - 'Exact verified email/phone matching remains synchronous and backward compatible.'
    - 'Different-contact same-person cases become explainable duplicate cases; fuzzy evidence never auto-merges.'
    - 'Candidate consent and identity proof gate Application/Attribution/MF03 for high-risk same-job cases.'
    - 'Logical merge preserves all Submission/CV/Application/Audit history and resolves job collisions deterministically.'
    - 'Attribution uses earliest Candidate-confirmed valid submission with server timestamps.'
    - 'Dispute/merge resolution is transactional, idempotent, concurrency-safe and finance-safe.'
    - 'No CCCD; PII is minimized/masked/HMACed and no raw CV text is retained for matching.'
    - '50k Candidate dataset meets stated indexed-query/load targets.'
  evidence_provenance:
    schema_version: 2
    head_commit: 'be0042f1a74f6ec7bda4121090d9deb20d802c67'
    generated_plan_path: 'docs/plans/2026-10-19-gitnexus-plan-candidate-identity-dedup-disputes.md'
    global_dirty_digest:
      algorithm: 'sha256'
      canonicalization: 'gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records'
      value: 'UNAVAILABLE_WIN32_HELPER_REFUSED; REANCHOR_REQUIRED'
    cited_path_manifest: []
  primary_symbols:
    - symbol: 'SubmitCandidateCommandHandler.Handle'
      file: 'HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs'
      lines: '93-672'
      role: 'Intake, exact identity, storage, consent creation.'
    - symbol: 'RespondSubmissionConsentCommandHandler.Handle'
      file: 'HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs'
      lines: '64-375'
      role: 'Candidate decision, Application/Attribution creation, MF03 trigger.'
    - symbol: 'ApproveIdentityClaimCommandHandler.Handle'
      file: 'HRConnect/HRConnect.Application/Features/Admin/IdentityClaims/ApproveIdentityClaim/ApproveIdentityClaimCommandHandler.cs'
      lines: '23-215'
      role: 'Existing safe placeholder swap; manual-merge seam.'
    - symbol: 'DisputeHandlers.Handle(ResolveDisputeCommand)'
      file: 'HRConnect/HRConnect.Application/Features/Disputes/DisputeFeatures.cs'
      lines: '199-244'
      role: 'Admin monetary decision and attribution transfer.'
  related_symbols:
    - symbol: 'CandidateRepository.TrySwapIdentityCandidateAsync'
      relationship: 'called by identity claim handlers'
      relevance: 'Existing safe empty-placeholder path; preserve it.'
    - symbol: 'SettlementCommandHandlers.Handle(ApproveCommissionCommand)'
      relationship: 'reads active dispute through FinanceRepository'
      relevance: 'Existing MF05 commission hold contract.'
    - symbol: 'CvStorageService.UploadCvPdfCoreAsync'
      relationship: 'called by Affiliate and Candidate upload paths'
      relevance: 'Only safe place for one-pass fingerprinting.'
  execution_path:
    - 'Authorize Affiliate and Job/service-type access.'
    - 'Resolve deterministic verified identity and canonical Candidate.'
    - 'Validate/upload PDF once, compute fingerprints, create snapshot + PENDING_CONSENT.'
    - 'Candidate confirms/declines; high-risk same-job case enters PENDING_IDENTITY_REVIEW.'
    - 'Case dismissal/merge finalizes one winner, then creates Application/Attribution and triggers MF03 exactly once.'
    - 'Dispute or merge case freezes finance until a transactional Admin decision.'
  pdg_constraints:
    - description: 'Duplicate guards must remain before upload; DB failure must compensate storage.'
      affected_statements: ['SubmitCandidateCommandHandler.cs:297-337', 'SubmitCandidateCommandHandler.cs:414-589']
      implementation_consequence: 'Do not move upload ahead of deterministic guards; keep rollback/compensation.'
    - description: 'Identity hold must occur after valid consent but before Application/Attribution/MF03.'
      affected_statements: ['RespondSubmissionConsentCommandHandler.cs:214-342']
      implementation_consequence: 'Extract shared finalize service and make it exactly-once.'
    - description: 'UPHELD transfer currently no-ops when attribution is absent.'
      affected_statements: ['DisputeFeatures.cs:251-275']
      implementation_consequence: 'Use explicit resolution outcomes; never silently succeed when transfer was required.'
  architectural_patterns:
    - pattern: 'MediatR command/query handlers + Minimal API endpoints + repository interfaces'
      example_location: 'HRConnect/HRConnect.Application/Features/Disputes/DisputeFeatures.cs'
      usage_guidance: 'Keep transport, orchestration and persistence separated.'
    - pattern: 'Optimistic concurrency token with 409 stale error'
      example_location: 'ApproveIdentityClaimCommandHandler.Handle'
      usage_guidance: 'Reuse for duplicate case, merge and dispute resolve.'
    - pattern: 'Outbox/notification and storage compensation'
      example_location: 'SubmitCandidateCommandHandler.Handle'
      usage_guidance: 'External side effects must be retry-safe and compensated.'
  files_to_modify:
    - file: 'HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs'
      symbols: ['SubmitCandidateCommandHandler.Handle']
      intended_change: 'Delegate exact identity/detection and persist snapshot/case without breaking old contract.'
    - file: 'HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs'
      symbols: ['RespondSubmissionConsentCommandHandler.Handle']
      intended_change: 'Add identity-review hold and shared exactly-once finalization.'
    - file: 'HRConnect/HRConnect.Application/Features/Disputes/DisputeFeatures.cs'
      symbols: ['Create dispute', 'Resolve dispute', 'Transfer attribution']
      intended_change: 'Transactional concurrency-safe evidence-based resolution.'
    - file: 'HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs'
      symbols: ['Candidate/Submission/Attribution/Dispute model configurations']
      intended_change: 'Add entities, constraints, indexes and concurrency.'
  tests:
    - file: 'HRConnect/HRConnect.UnitTests/Features/Affiliates/SubmitCandidateCommandHandlerTests.cs'
      scenarios: ['Different contacts + strong signal -> case/consent', 'same template different person -> no auto-merge', 'concurrent submit -> deterministic result']
    - file: 'HRConnect/HRConnect.UnitTests/Features/SubmissionConsents/RespondSubmissionConsentCommandHandlerTests.cs'
      scenarios: ['confirm + hold -> no app/MF03', 'earliest confirmed wins', 'finalize exactly once']
    - file: 'HRConnect/HRConnect.UnitTests/Features/Disputes/DisputeTests.cs'
      scenarios: ['stale resolve -> 409', 'missing attribution -> explicit outcome', 'paid commission -> rollback']
  verification_commands:
    - 'dotnet restore HRConnect/HRConnect.sln'
    - 'dotnet build HRConnect/HRConnect.sln --no-restore'
    - 'dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --no-build'
    - 'node .gitnexus/run.cjs detect-changes --scope all --repo .'
  risks:
    - 'Submit handler graph risk CRITICAL; incoming caller list is a lower bound.'
    - 'False positives can unfairly block a real Candidate or Affiliate; fuzzy evidence is review-only.'
    - 'Merge/attribution touches money; PAID commission blocks automated mutation.'
    - 'Migration/index/backfill can lock production tables if not batched.'
  assumptions:
    - 'Reverify HEAD and regenerate schema-2 provenance because Windows helper could not serialize it.'
    - 'Confirm an SMS provider before enabling phone OTP; otherwise keep capability disabled.'
    - 'Measure baseline latency and query plans on PostgreSQL, not EF InMemory.'
  open_questions:
    - 'Which production SMS provider and sender identity will be used for verified phone aliases?'
    - 'What legal retention period applies to dispute evidence and identity snapshots?'
    - 'Who has authority to settle a previously PAID commission before a merge can proceed?'
  avoid:
    - 'Do not collect CCCD for routine duplicate prevention.'
    - 'Do not auto-merge or auto-reject from name/CV similarity alone.'
    - 'Do not expose another Affiliate identity or full Candidate contact data.'
    - 'Do not rewrite/delete historical Submission, CV or Audit rows.'
    - 'Do not trigger MF03 before identity review is cleared.'
    - 'Do not repeat full repository discovery; re-anchor drift, then use this context.'
```

## 12. Assumptions and Open Questions

### Confirmed decisions

- [verified] Thời hạn khiếu nại hiện lấy từ business setting và mặc định thiết kế là 30 ngày; giữ cấu hình thay vì hardcode.
- [verified] Candidate có thể được nộp vào Job khác; duplicate ownership là theo Candidate + Job, còn client-ownership áp dụng theo service/business rule hiện có.
- [inferred] Không yêu cầu CCCD. Contact verification, consent, immutable evidence và Admin review đủ phù hợp hơn cho capstone và production privacy.
- [inferred] “Cùng CV” là tín hiệu, không phải bằng chứng duy nhất; nhiều người có thể dùng chung template.

### Assumptions phải kiểm tra trước khi code

1. Production có PostgreSQL và hỗ trợ row/advisory lock như repository hiện dùng; xác nhận connection/provider trong integration environment.
2. Cloudflare R2 object hiện có thể stream để backfill hash; đo chi phí/throughput trước khi chạy toàn kho.
3. Secret manager có thể lưu HMAC key ring; không đặt key trong `appsettings*.json` hoặc repo.
4. Phone OTP chỉ bật sau khi có nhà cung cấp SMS thật. Không dùng email OTP để giả làm phone verification.
5. Permission seeder/admin roles có cơ chế thêm permission mới mà không cấp nhầm Client/Affiliate.

### Open questions cần Product/Leader chốt trước phase bật production

1. Evidence dispute giữ bao lâu: 90 ngày, 1 năm hay theo vòng đời payout?
2. Khi hai confirmed submissions cùng người/cùng Job nhưng Candidate muốn chọn Affiliate khác, hệ thống luôn theo earliest-confirmed hay cho Candidate chọn với lý do? Kế hoạch mặc định **earliest confirmed valid submission**.
3. Ai xử lý paid commission: Platform Admin hay Finance role; cần quy trình adjustment ngoài auto-merge.
4. Ngưỡng high-confidence ban đầu chỉ exact CV hash + normalized name hay yêu cầu thêm DOB? Kế hoạch mặc định cùng Job cần exact CV hash + name; khác Job chỉ cảnh báo.
5. Có nhà cung cấp SMS nào được duyệt? Nếu chưa, release đầu chỉ email identity + Admin review.

## 13. Definition of Done

- Exact email/phone duplicate tests cũ vẫn pass; API cũ không mất field/error code/status.
- Hai hồ sơ khác email+phone nhưng có strong evidence tạo một duplicate case idempotent và không tự merge.
- Candidate xác nhận consent nhưng case same-job high-risk chưa giải quyết thì không có Application, Attribution hoặc MF03 work.
- Candidate/Admin có thể chứng minh, preview và logical-merge; mọi lịch sử vẫn truy vấn được qua canonical family.
- Overlapping Job chọn đúng earliest confirmed valid submission bằng server timestamps; tie-break deterministic.
- Hai Admin resolve đồng thời chỉ một request commit; request còn lại nhận stale 409.
- OPEN/UNDER_REVIEW dispute/case giữ commission; PAID commission chặn merge/transfer; không có partial mutation.
- Audit ghi đủ before/after IDs, rule, reason, correlation nhưng không chứa raw PII/CV text/token.
- Backfill idempotent, có dry run/checkpoint/metrics và rollback plan; deploy qua shadow mode rồi mới bật hold.
- PostgreSQL integration/concurrency/security/full regression tests pass; load test 50k đạt mục tiêu đã nêu.
- OpenAPI và `HRConnect-FE/docs/integration/MF02/13-CANDIDATE-DUPLICATE-CASES.md` khớp implementation cuối.
- GitNexus provenance được re-anchor ở commit triển khai và `detect_changes(scope=all)` không partial/truncated trước mỗi commit.
