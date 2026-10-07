# GitNexus Engineering Plan

> Task: Cho phép Candidate đăng ký bằng email mới chứng minh email cũ do Affiliate sử dụng và nhận lại đúng hồ sơ, CV, lịch sử ứng tuyển mà không tạo lỗ hổng chiếm đoạt danh tính.
> Evidence verified at commit 14076565868b96e4fb27a8b1a7bb294b510c1b82; GitNexus index refreshed this session with node .gitnexus/run.cjs analyze --index-only --pdg.
> Evidence provenance schema 2; global dirty digest 0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd; cited-path manifest 30 sorted entries; exact generated plan path excluded.

## 1. Objective

Thiết kế luồng claim danh tính Candidate an toàn cho trường hợp Affiliate đã tạo Candidate không có tài khoản bằng email A, sau đó người thật đăng ký bằng email B. Candidate phải chứng minh quyền sở hữu email A trước khi hệ thống liên kết dữ liệu cũ. Một tài khoản vẫn chỉ có một email đăng nhập chính; email đã xác minh khác là danh tính phụ, không tự dùng để đăng nhập hoặc quên mật khẩu. [inferred]

Kết quả phải bảo toàn CV, Submission, Application, Attribution và kết quả MF03 của hồ sơ cũ; không tự liên kết theo tên, số điện thoại đơn lẻ hoặc lời khai của Affiliate; mọi thay đổi nhạy cảm phải có transaction, concurrency protection, audit và nhánh Admin xử lý ngoại lệ.

## 2. Current Behaviour

- [verified] RegisterCandidateCommandHandler.Handle tìm Candidate qua CandidateRegistrationIdentity.ResolveAsync, tạo AppUser chờ OTP và chỉ tạo Candidate mới khi chưa có hồ sơ phù hợp (RegisterCandidateCommandHandler.cs:67-165).
- [verified] Sau OTP, VerifyEmailOtpCommandHandler.Handle chỉ claim Candidate theo email đăng ký và gọi TryLinkByVerifiedEmailAsync; update chỉ thắng khi Candidate.UserId còn null (VerifyEmailOtpCommandHandler.cs:239-255; CandidateRepository.cs:99-106).
- [verified] CandidateRegistrationIdentity.ResolveAsync chặn email và phone trỏ hai Candidate khác nhau, phone khớp nhưng email không khớp, và Candidate đã thuộc user khác (CandidateRegistrationIdentity.cs:9-34).
- [verified] Affiliate submit người chưa tồn tại sẽ tạo Candidate UserId null, tải CV theo CandidateId, rồi tạo Submission, consent và outbox trong transaction (SubmitCandidateCommandHandler.cs:299-510).
- [verified] Candidate có một UserId; CandidateCv, Submission, Application, CandidateJobMatch và CandidateSkill đều sở hữu dữ liệu bằng CandidateId. Application/Submission có unique và composite FK theo Candidate+Job (ApplicationDbContext.cs:465-869,2350-2435).
- [verified] Login và forgot-password tra AppUser.Email. UserToken không bind requester, target Candidate và asserted email, nên không phù hợp để tái sử dụng cho claim email cũ (UserRepository.cs:8-64; UserToken.cs:1-35; ApplicationDbContext.cs:2514-2547).
- [verified] Candidate Profile FE còn cho nhập email trong form hồ sơ và dùng local fallback; candidateService chỉ có ba API profile cơ bản (CandidateProfilePage.tsx:95-268,666-685; candidateService.ts:1-115).

Khoảng trống: người đăng ký email B không thể chứng minh email A nên tài khoản mới bị gắn Candidate mới và không nhìn thấy lịch sử Affiliate đã tạo. [verified]

## 3. Relevant Architecture

- [verified] Backend dùng EF Core/PostgreSQL, MediatR, repositories, IUnitOfWork, email outbox, audit service và minimal APIs.
- [verified] Candidate.UserId là một-một; đổi AppUser.Email không chuyển quyền dữ liệu lịch sử.
- [verified] Application có unique Candidate+Job và composite FK tới accepted Submission; không được bulk reparent hai Candidate có lịch sử khi chưa có conflict policy.
- [verified] ChangePasswordCommandHandler là mẫu mutation nhạy cảm: xác thực credential, transaction, revoke sessions, audit, commit (ChangePasswordCommandHandler.cs:38-119).
- [verified] Program.cs có rate policies theo IP và User+IP; identity claim cần policy riêng (Program.cs:63-151).
- [verified] Repositories/services dùng scoped DI (DependencyInjection.cs:52-97).
- [verified] Permission được seed idempotent và gán theo role trong DatabaseSeeder.cs; Permission.md là tài liệu đồng bộ.
- [verified] Candidate endpoints nằm dưới /api/v1/candidates/profile; Admin approvals dùng /api/v1/admin và kiểm tra permission claim.

## 4. GitNexus Findings

- [graph] impact CandidateRegistrationIdentity.ResolveAsync upstream maxDepth 3: HIGH, 17 impacted, ba direct dependents là RegisterCandidateCommandHandler.Handle, VerifyEmailOtpCommandHandler.Handle và CandidateRegistrationIdentity test.
- [graph] impact RegisterCandidateCommandHandler.Handle upstream maxDepth 3: bốn direct dependents, đều là unit tests cho đăng ký không claim trước OTP, email tồn tại, Candidate đã link và pending registration recoverable.
- [graph] impact VerifyEmailOtpCommandHandler.Handle upstream maxDepth 3: HIGH với mười direct unit tests cho OTP, atomic claim và ba loại tài khoản.
- [graph] impact CandidateRepository.TryLinkByVerifiedEmailAsync upstream maxDepth 3: HIGH lower-bound do DI/interface; concrete direct caller duy nhất là VerifyEmailOtpCommandHandler.Handle.
- [graph] Modules bị ảnh hưởng: Auth/Login, Candidates, Repositories, Persistence, Email, Admin và Tests.
- [graph] Query tìm thấy mẫu resend OTP, email outbox, audit, rate limiter và permission-gated Admin endpoints.
- [verified] Source verification xác nhận direct dependents trên và cho thấy thay đổi phải giữ nguyên Affiliate/Client OTP.

## 5. Statement-Level PDG Findings

- [graph] PDG được rebuild bằng --pdg nhưng pdg_query cho ba C# handler trung tâm không trả CDG/REACHING_DEF edges; plan không dựa vào statement edge giả định.
- [verified] Register slice: normalize → kiểm tra AppUser email → resolve Candidate → transaction → user/role/candidate → OTP/outbox → commit. Không claim trước OTP.
- [verified] Verify slice: token/hash/expiry/attempts → role branch → Candidate transaction → resolve verified email → conditional claim → active/audit → commit.
- [verified] Submit slice: validate Affiliate/job/service → resolve identity → upload CV → transaction Candidate/Submission/Consent/Outbox → commit. Alias resolution phải chạy trước create Candidate.
- [graph] explain VerifyEmailOtpCommandHandler trả 0 taint findings; đây không phải bằng chứng an toàn vì field/closure/implicit flow có thể không được model.

## 6. Proposed Changes

### 6.1. user_email_identity

Tạo entity/table UserEmailIdentity với id, userId, email, normalizedEmail, kind PRIMARY|ALIAS, status PENDING|VERIFIED|REVOKED, verificationSource, timestamps và concurrencyToken. [inferred]

Ràng buộc:

- Unique normalizedEmail cho identity chưa REVOKED.
- Partial unique một PRIMARY chưa REVOKED mỗi user.
- Alias chỉ insert sau OTP claim thành công; không giữ chỗ email bằng alias pending.
- Migration backfill AppUser.Email thành PRIMARY, VERIFIED nếu EmailVerifiedAt có giá trị, nếu không là PENDING.
- Migration phải dừng và báo danh sách conflict nếu dữ liệu hiện hữu trùng normalized email.
- AppUser.Email tiếp tục là email login chính; alias không login/reset password.

### 6.2. candidate_identity_claim

Tạo resource riêng thay vì UserToken vì token hiện tại thiếu claim/destination binding. [verified]

Trường: claimId, requesterUserId, requesterCandidateId, targetCandidateId, asserted/normalizedEmail, tokenHash, status PENDING_VERIFICATION|VERIFIED|COMPLETED|PENDING_ADMIN_REVIEW|REJECTED|EXPIRED|CANCELLED, expiry, attempts, resend metadata, reviewer/reason/timestamps và concurrencyToken.

Ràng buộc:

- Một active claim cho requesterUserId+normalizedEmail.
- Một target Candidate chỉ có một verified/review claim active.
- OTP hash-only, TTL 15 phút, tối đa 5 lần, cooldown resend 60 giây, giới hạn resend.
- Conditional update để verify/resend đồng thời chỉ một request thắng.

### 6.3. CandidateIdentityClaimService

Tạo service làm transaction boundary. [inferred]

Start:

1. User ACTIVE, Candidate ACTIVE/chưa merge, role và permission Candidate hợp lệ.
2. Normalize email; từ chối nếu bằng primary hoặc thuộc account khác.
3. Trả response generic để không enumerate Candidate; claim hợp lệ tạo OTP hash và outbox.
4. OTP chỉ gửi tới email cũ cần chứng minh.

Verify:

1. Lock/conditional update claim; kiểm tra expiry, attempts, replay.
2. Tạo VERIFIED ALIAS dưới unique constraint.
3. Tìm Candidate UserId null, ACTIVE, chưa merge bằng exact normalized email. Phone chỉ là tín hiệu phụ.
4. Không có Candidate cũ: hoàn tất alias và báo không tìm thấy hồ sơ cũ.
5. Candidate hiện tại do registration tạo ra còn trống: safe canonical swap trong một transaction. Clear/archive placeholder, link UserId vào Candidate cũ; giữ CandidateId cũ nên lịch sử tự hiện đúng.
6. “Trống” được kiểm tra tại DB trong transaction: không CV, Submission, Application, CandidateJobMatch, CandidateSkill hoặc dữ liệu nghiệp vụ khác.
7. Có dữ liệu/conflict/inactive/merged/claimed: PENDING_ADMIN_REVIEW, không auto merge, không 500.

### 6.4. Candidate APIs

Tạo permission candidate.identity.manage_own và APIs: [inferred]

- GET /api/v1/candidates/me/email-identities.
- POST /api/v1/candidates/me/identity-claims: generic 202, claimId, maskedDestination, expiresAt, resendAfter.
- POST /identity-claims/{claimId}/verify: OTP + concurrencyToken; COMPLETED hoặc PENDING_ADMIN_REVIEW.
- POST /identity-claims/{claimId}/resend: generic 202, token rotate atomically.
- DELETE /email-identities/{identityId}: chỉ revoke ALIAS.
- POST /email-identities/{identityId}/make-primary: currentPassword/re-auth + concurrencyToken; update AppUser.Email, swap PRIMARY, revoke sessions, audit, buộc login lại.

Swagger phải ghi rõ 200/202/204, 400, 401, 403, 404, 409, 429 bằng tiếng Việt và UI không nhắc JWT/access token.

### 6.5. Admin review APIs

Tạo permission candidate.identity.review, gán PLATFORM_ADMIN/Administrator theo role convention, cập nhật seeder và Permission.md. [inferred]

- GET /api/v1/admin/candidate-identity-claims.
- GET /api/v1/admin/candidate-identity-claims/{claimId}.
- POST .../{claimId}/approve.
- POST .../{claimId}/reject với reason bắt buộc.

Approve recheck invariant trong transaction và chỉ cho safe swap. Hai Candidate đều có lịch sử trả 409, giữ review; detail chỉ trả email mask và số lượng CV/Submission/Application, không token.

### 6.6. Registration và Affiliate lookup

- Thêm IUserEmailIdentityRepository; Candidate/Affiliate/Client registration kiểm tra kho identity trước AppUser để alias VERIFIED không đăng ký account khác.
- Cả ba registration tạo PRIMARY identity cùng transaction; registration OTP xác minh identity đó.
- CandidateRegistrationIdentity.ResolveAsync dùng resolver mới nhưng giữ email/phone mismatch rules.
- SubmitCandidateCommandHandler resolve bằng Candidate.NormalizedEmail hoặc verified alias. Candidate có account thì consent gửi tới AppUser primary email, không dùng email Affiliate tùy ý nhập.
- Vẫn recheck Candidate status/merge và phone consistency.

### 6.7. Audit, email, privacy

Thêm actions IDENTITY_CLAIM_REQUESTED, IDENTITY_EMAIL_VERIFIED, CANDIDATE_IDENTITY_CLAIMED, IDENTITY_CLAIM_REVIEWED, PRIMARY_EMAIL_CHANGED, IDENTITY_EMAIL_REVOKED. Audit chỉ lưu IDs, status và email mask/hash; không raw OTP/full email.

Email claim và consent phải có Affiliate display name đã xác minh, Job, Company, CV filename, submitted/expiry time, lý do nhận email, domain chính thức và hướng dẫn báo cáo. Không lộ phone/email Affiliate mặc định.

### 6.8. Frontend

- Trang/tab “Email & hồ sơ liên kết”: primary, aliases, claim, OTP, resend countdown, review state, revoke, make-primary.
- Email login readonly trong CandidateProfilePage, dẫn tới trang quản lý danh tính.
- Make-primary yêu cầu mật khẩu và logout sau success.
- Không yêu cầu user nhập token kỹ thuật.
- Admin UI có thể tách sprint nhưng backend contract phải hoàn chỉnh.

## 7. Implementation Sequence

1. Tạo feature/candidate-identity-claim; entities/config/migration/backfill và constraint tests.
2. Repositories, DI và atomic persistence methods.
3. Candidate/Affiliate/Client registration tạo PRIMARY identity; chạy Auth tests.
4. GET email identities: test, commit, push riêng.
5. POST start claim: OTP/outbox/rate limit/audit, test, commit, push riêng.
6. POST verify: safe swap/concurrency/review, test history preservation, commit, push riêng.
7. POST resend: cooldown/rotation/concurrent request test, commit, push riêng.
8. DELETE alias và POST make-primary: credential/session/audit; mỗi API commit/push riêng.
9. Admin list/detail/approve/reject + permission/seeder/Swagger; từng API test/push riêng.
10. Affiliate alias resolution và trusted consent email; test/push riêng.
11. Candidate FE flow và readonly primary email; build/lint.
12. Full regression, migration verification, API/FE handoff; dừng ở feature branch để user test, chưa merge dev/main.

## 8. Test Strategy

Existing tests:

- CandidateRegistrationIdentityTests: primary/alias ownership, foreign alias, email-phone conflict.
- RegisterCandidateCommandHandlerTests: PRIMARY identity atomic, alias blocks second account, rollback.
- VerifyEmailOtpCommandHandlerTests: registration identity verified, atomic Candidate claim, Affiliate/Client unchanged.
- SubmitCandidateCommandHandlerTests: alias resolves canonical Candidate, consent to primary, revoked alias ignored, mismatch 409.

New tests:

- Start: existing/non-existing email indistinguishable 202; primary/foreign identity cases; no raw OTP in audit/log.
- Verify: wrong/expired/max/replayed OTP; concurrent verify one winner; global alias uniqueness.
- Safe swap: placeholder empty + old unlinked Candidate preserves old CandidateId and all CV/Submission/Application; placeholder archived/merged.
- Review: any new Candidate CV/submission/application/match/skill prevents mutation and creates review.
- Resend: cooldown/max/concurrency, exactly one live token.
- Revoke: primary cannot revoke; revoked alias ignored for future submit; old history stays.
- Make-primary: wrong password, invalid alias, collision, success revokes sessions atomically.
- Admin: permission, masking, stale concurrency, approve recheck, reject reason/audit.
- Migration: backfill, normalized duplicates, one primary/user, one active owner/email, FK/delete behavior.
- FE build/lint plus manual happy/review/logout flows.

Commands:

- dotnet test HRConnect.sln --no-restore
- dotnet ef migrations has-pending-model-changes --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation --no-build
- npm run build --prefix HRConnect-FE
- npm run lint --prefix HRConnect-FE
- GitNexus detect_changes trước mỗi commit theo AGENTS.md.

## 9. Risk and Impact Analysis

- Critical identity takeover: exact old-email OTP mandatory; phone/name/Affiliate assertion không cấp quyền.
- Critical data corruption: không reparent hai Candidate non-empty.
- High registration bypass: cả ba registration phải consult identity store.
- High concurrency: DB unique + concurrency token là final guard.
- High privacy: generic response, masking, không raw secrets.
- High session risk: primary change revoke refresh sessions.
- High migration risk: duplicate normalized legacy emails phải fail có diagnostics.
- Medium compatibility: login/reset vẫn primary-only.
- Medium operations: outbox worker cần hiểu template mới nhưng không tự sinh OTP mới khi retry.
- Direct dependents: ba direct users của identity resolver, bốn registration tests, mười OTP tests và concrete caller duy nhất của atomic claim đều được cover ở §8.

## 10. Files Expected to Change

| File | Symbols | Reason |
| --- | --- | --- |
| HRConnect.Domain/Entities/UserEmailIdentity.cs | new | Email primary/alias |
| HRConnect.Domain/Entities/CandidateIdentityClaim.cs | new | Claim lifecycle |
| ApplicationDbContext.cs + new migration + snapshot | mappings | constraints/backfill |
| IUserEmailIdentityRepository.cs and repository | new | ownership/atomic operations |
| ICandidateRepository.cs, CandidateRepository.cs | pristine/safe swap | preserve old CandidateId |
| IUserRepository.cs, UserRepository.cs | ownership lookup | primary-only auth |
| DependencyInjection.cs | registrations | wire components |
| CandidateRegistrationIdentity.cs | ResolveAsync | identity-aware registration |
| RegisterCandidate/Affiliate/Client handlers | Handle | primary identity transaction |
| VerifyEmailOtpCommandHandler.cs | Handle | verify registration identity |
| Features/Candidates/Identity/* | new handlers | Candidate APIs |
| Features/Admin/CandidateIdentityClaims/* | new handlers | Admin review |
| SubmitCandidateCommandHandler.cs | Handle | alias resolution/primary recipient |
| HrConnectEmailTemplates.cs | templates | claim/trusted consent |
| AuditActions.cs | constants | audit |
| CandidateEndpoints.cs | mappings | Swagger/API |
| AdminApprovalEndpoints.cs or dedicated file | mappings | Admin APIs |
| Program.cs | rate policy | abuse protection |
| DatabaseSeeder.cs, Permission.md | permissions | default roles/docs |
| Auth/MF02 tests + new integration tests | tests | security/regression |
| candidateService.ts, CandidateProfilePage.tsx, AppRoutes.tsx | FE | identity UX |

## 11. Reusable Implementation Context

~~~json
{
  "implementation_context": {
    "task_summary": "Add verified email aliases and secure Candidate identity claim so a Candidate using a new login email can recover an Affiliate-created profile and history.",
    "acceptance_criteria": [
      "Prove old email by one-time OTP before linking",
      "One primary login email; aliases cannot authenticate",
      "Safe claim preserves old CandidateId and MF02 history",
      "Conflicts route to Admin review without 500",
      "All registration types reject an email owned as alias",
      "Transactional, concurrent-safe, audited, rate-limited",
      "Swagger, permissions and FE contract complete"
    ],
    "evidence_provenance": {
  "schema_version": 2,
  "head_commit": "14076565868b96e4fb27a8b1a7bb294b510c1b82",
  "generated_plan_path": "docs/plans/2026-10-06-gitnexus-plan-candidate-identity-claim.md",
  "global_dirty_digest": {
    "algorithm": "sha256",
    "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
    "value": "0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd"
  },
  "cited_path_manifest": [
    {
      "path": "AGENTS.md",
      "object_kind": {
        "head": "absent",
        "index": "absent",
        "worktree": "absent",
        "untracked": "regular"
      },
      "state": "untracked",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "absent",
      "index_digest": "absent",
      "worktree_digest": "absent",
      "untracked_digest": "sha256:d5fd5bf96c3372c70055448cb08ffd277836919ca057fe2a25353aa47e2c57aa"
    },
    {
      "path": "HRConnect-FE/package.json",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:afa8f11b6bd33db91687ab0a97a8f4e615b4690edb9f78f7335867006b232a45",
      "index_digest": "sha256:afa8f11b6bd33db91687ab0a97a8f4e615b4690edb9f78f7335867006b232a45",
      "worktree_digest": "sha256:3ac1fecfabafb790dc3641529e86dbc82e1fdeb09c55d82cb18c51bf1219f4fc",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:7828d4a6869891cf21b91d6f8aecce37e26a404e45b9a7a3e24b16529068f010",
      "index_digest": "sha256:7828d4a6869891cf21b91d6f8aecce37e26a404e45b9a7a3e24b16529068f010",
      "worktree_digest": "sha256:f9853b1f25034c3419e1a4e94df9143128a0b65b90100a80462b40e829e20bac",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect-FE/src/routes/AppRoutes.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:c685f78c1fd81c130a87b3b9a9f7bfd71454b71619911fe16b4a52ac06016588",
      "index_digest": "sha256:c685f78c1fd81c130a87b3b9a9f7bfd71454b71619911fe16b4a52ac06016588",
      "worktree_digest": "sha256:3fa1b8fba35c3c6559f6e377f54c11c0a3fea7c41383af00f6120aaa588476df",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect-FE/src/services/candidateService.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:740f7bbf2732e236d79b48dc9abbcdf6a6b8a0d616a42294d1f1f19c0d88df8e",
      "index_digest": "sha256:740f7bbf2732e236d79b48dc9abbcdf6a6b8a0d616a42294d1f1f19c0d88df8e",
      "worktree_digest": "sha256:5849a69a9ba2893f88ceb02b09f5a8e73a1d04c9c34cde177da6357dcd1c5dfb",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Common/Email/HrConnectEmailTemplates.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:f3ad886f8e6663e2c5a295884c058dac1f50ff034fc2d86764b27af0503c6ff7",
      "index_digest": "sha256:f3ad886f8e6663e2c5a295884c058dac1f50ff034fc2d86764b27af0503c6ff7",
      "worktree_digest": "sha256:96d59192f13a5e7aab277d757a675ec3c9017f1c66ec12da99234ede27cd6a45",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Common/Interfaces/Repositories/ICandidateRepository.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:35ddff3c1e5789ec7154fef88272349b21bb035fa3cd6a5920eafe5a52dcbb23",
      "index_digest": "sha256:35ddff3c1e5789ec7154fef88272349b21bb035fa3cd6a5920eafe5a52dcbb23",
      "worktree_digest": "sha256:40bb9234382685d321177ef154a7b3bb75b63cec322dc601c30887ab5a74932b",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Common/Interfaces/Repositories/IUserRepository.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:fd42d82fe94247ff177721c9bf3399d091de0a4b06d4ceb53d3ab5271e922fc1",
      "index_digest": "sha256:fd42d82fe94247ff177721c9bf3399d091de0a4b06d4ceb53d3ab5271e922fc1",
      "worktree_digest": "sha256:3be3a6c2787e7c1b72af05c09c6bd822fa7955dfe96fd3d567125cc0595c63ac",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Common/Models/AuditActions.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:cd06ef410bbd41ccc8a9ac440e0deda7ac3cfd346a3b89760e5d195885f4f54a",
      "index_digest": "sha256:cd06ef410bbd41ccc8a9ac440e0deda7ac3cfd346a3b89760e5d195885f4f54a",
      "worktree_digest": "sha256:25e57dff3bbeef5707816431d78d1dd141a3c11ca82c0d916cdbc2bafb1f2626",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:8a50b994bd1e2d7853c15e73318b71e4ec29c1052aa064214a2c146083ebd93c",
      "index_digest": "sha256:8a50b994bd1e2d7853c15e73318b71e4ec29c1052aa064214a2c146083ebd93c",
      "worktree_digest": "sha256:b64c460d1abc4412d9c2430d95bf402bc6d77c846e7586b4782cf3d0be7e72bd",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Auth/Commands/ChangePassword/ChangePasswordCommandHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:3ae49584b2b11bc96c608dfeff58b332cc3f74b5349d74089ffb30e3c8ecd2b9",
      "index_digest": "sha256:3ae49584b2b11bc96c608dfeff58b332cc3f74b5349d74089ffb30e3c8ecd2b9",
      "worktree_digest": "sha256:44327efb8e68f7b1b6c2b438eebd92f36c7fc191f5d1025c8a71b3b8f4621a3f",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Auth/Commands/RegisterCandidate/RegisterCandidateCommandHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:fd48af0bf69898244aad4f7eff5a1ed4ea61615829a1ddab4ff346457a6e7c97",
      "index_digest": "sha256:fd48af0bf69898244aad4f7eff5a1ed4ea61615829a1ddab4ff346457a6e7c97",
      "worktree_digest": "sha256:c3c78ef91416d5c371676e322213864f2d153eb34089263a46e15a60f1bf7fc2",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Auth/Commands/VerifyEmailOtp/VerifyEmailOtpCommandHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:d27fe9532ebe750efb483bcd8d6222286226adc01cc612a5b5cc38fd0e5542bb",
      "index_digest": "sha256:d27fe9532ebe750efb483bcd8d6222286226adc01cc612a5b5cc38fd0e5542bb",
      "worktree_digest": "sha256:7b34b164fe6b7bf95a1d9254fd45a29e5a372e42c7ecbbbf5b9c17ac86a4e9d1",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Auth/Common/CandidateRegistrationIdentity.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:2f1bb2817549a8ebe4ac15d23ed998d28dee5dcfbbc25399fd8205c232f561d2",
      "index_digest": "sha256:2f1bb2817549a8ebe4ac15d23ed998d28dee5dcfbbc25399fd8205c232f561d2",
      "worktree_digest": "sha256:f258fd89053438790d5b17f32bb092b2e66b7b3c8a21bf70ac946f7f2523c6c8",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Domain/Entities/Candidate.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:ee71ae74793c99242852d34bed211fd939e6ee692f116424afba096bb1b80b21",
      "index_digest": "sha256:ee71ae74793c99242852d34bed211fd939e6ee692f116424afba096bb1b80b21",
      "worktree_digest": "sha256:5bb235a2dc7f9688eae69df80b177470f48b5cadb6d6e8793370ed1df0624d9d",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Domain/Entities/UserToken.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:a19d66e8b10cc93e4d418cb66aa8fc45ee12ff25d223185aaff14d299333138f",
      "index_digest": "sha256:a19d66e8b10cc93e4d418cb66aa8fc45ee12ff25d223185aaff14d299333138f",
      "worktree_digest": "sha256:ad4d092221cb5e6502e480e84bf8781da24ee4de8d6ea7ab6dafcbbbb7bba44c",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/DependencyInjection.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:2257ade5472d5c5dec0e480e856cfb7f11fadcf5c15769c4065354ad64036895",
      "index_digest": "sha256:2257ade5472d5c5dec0e480e856cfb7f11fadcf5c15769c4065354ad64036895",
      "worktree_digest": "sha256:c1c16fb31d79497569b952716cd27b0184e7ab53d6cc7ed22ca6cb558ad56826",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:f1b58354cd27337fc4c10faa1f50d93df3f7cd89374faae5b9007aae568bf9da",
      "index_digest": "sha256:f1b58354cd27337fc4c10faa1f50d93df3f7cd89374faae5b9007aae568bf9da",
      "worktree_digest": "sha256:cf15d526a2e69d53335673f0f35bcf77e952b0dca4d61f69f25272bdde0191dc",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:e7d15890d87a376cd98e651d3ca83427ac13ed98014d762b8f04db4f06d641ff",
      "index_digest": "sha256:e7d15890d87a376cd98e651d3ca83427ac13ed98014d762b8f04db4f06d641ff",
      "worktree_digest": "sha256:2be79a86ac04667d41408bfe1ac0368493c571741c8b4446f80c717403b85351",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/Persistence/DatabaseSeeder.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:6fc9f4382f4436871d9a4f515f32a1c2fb3969cffdf879192739cde892c07adb",
      "index_digest": "sha256:6fc9f4382f4436871d9a4f515f32a1c2fb3969cffdf879192739cde892c07adb",
      "worktree_digest": "sha256:d0c30130d55e2ee772e62ad12553ae63340d3c58d86719b49ff1b842984712d5",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/Repositories/CandidateRepository.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:9921d51e2b74248e6cf3f553c64af279feecd82b6eef52e8050c3eb649503d81",
      "index_digest": "sha256:9921d51e2b74248e6cf3f553c64af279feecd82b6eef52e8050c3eb649503d81",
      "worktree_digest": "sha256:b49afe396e2b33e12b2762026ae2e15b7a3e9a7ad817e6d8ebcbbd10e51f9e83",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/Repositories/UserRepository.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:826ceaea12219d12c99cccdd8b1629892f8c844c7a90ed3616df82dcca3cdf23",
      "index_digest": "sha256:826ceaea12219d12c99cccdd8b1629892f8c844c7a90ed3616df82dcca3cdf23",
      "worktree_digest": "sha256:0e9531d0b2753dc6d8d2ccf1428c3ae4e67deb916cc061abd0f1dde25fe33428",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Presentation/Endpoints/V1/Admin/AdminApprovalEndpoints.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:53dab139cc1fb0108ae235babf43b0d8ae6f11ed0c4e4970edb9ff2c1c57b87e",
      "index_digest": "sha256:53dab139cc1fb0108ae235babf43b0d8ae6f11ed0c4e4970edb9ff2c1c57b87e",
      "worktree_digest": "sha256:687a57faec8a87bbadf1d539caaadb628bffb848d7f7285f5b1c028b3a493b9a",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:331e7b9649fa85a586996910e96d7878e99e20e6b699b34b2578b7230a4d0395",
      "index_digest": "sha256:331e7b9649fa85a586996910e96d7878e99e20e6b699b34b2578b7230a4d0395",
      "worktree_digest": "sha256:c3b211f5adea22f522dbc21487affc67d25a98f6bcd0d40cb2e0e99b5ea73aaa",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Presentation/Program.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:37e5e3f61a0e6410c46ef44285879823a3aeeab44f8ad3129341df7e5f5da471",
      "index_digest": "sha256:37e5e3f61a0e6410c46ef44285879823a3aeeab44f8ad3129341df7e5f5da471",
      "worktree_digest": "sha256:5a668d6dc0e8a6a2213a82bf3601029b4a0e04e979708be0b8cd6cdac0171037",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.UnitTests/Features/Affiliates/SubmitCandidateCommandHandlerTests.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:df2f46b35891d309a4753fc2bc5a9c3aa9e5f3aa2080ca7d14f05d9de7dcf7f4",
      "index_digest": "sha256:df2f46b35891d309a4753fc2bc5a9c3aa9e5f3aa2080ca7d14f05d9de7dcf7f4",
      "worktree_digest": "sha256:50493bc213305b014455491fd07c06532d8328bc36858b5ba3f9bb5572535e80",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.UnitTests/Features/Auth/RegisterCandidate/CandidateRegistrationIdentityTests.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:8b014cc2ef06731d2e081395a0860fd9ac73c84d8512f4edfc32224760037e92",
      "index_digest": "sha256:8b014cc2ef06731d2e081395a0860fd9ac73c84d8512f4edfc32224760037e92",
      "worktree_digest": "sha256:ea0933f1525b49fcf50ffb93d1ab71c029797cae3528c34a71ca88ec609bc1a2",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.UnitTests/Features/Auth/RegisterCandidate/RegisterCandidateCommandHandlerTests.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:ead915fa7379c09eeee470b3ec9445f2734432798cf5bb5074d313154f1c1e72",
      "index_digest": "sha256:ead915fa7379c09eeee470b3ec9445f2734432798cf5bb5074d313154f1c1e72",
      "worktree_digest": "sha256:641235d5ca2724883945cdadc30e826d9f9e77c2d1831c31a8f90c85555160b0",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.UnitTests/Features/Auth/VerifyEmailOtp/VerifyEmailOtpCommandHandlerTests.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:d1a7bc144ed61b52da9cb28a6fcd84e2ed44910a4f80f74569cba93049de5264",
      "index_digest": "sha256:d1a7bc144ed61b52da9cb28a6fcd84e2ed44910a4f80f74569cba93049de5264",
      "worktree_digest": "sha256:18a3ac4ea114e043949d9d29ee15a066483f1348423039fbb382bb3bd25ec34f",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/Permission.md",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:011dd4e2ca864b0f0b87771c0cb949aba0b0f55b0ed7f89268e88b52dcf3ceaa",
      "index_digest": "sha256:011dd4e2ca864b0f0b87771c0cb949aba0b0f55b0ed7f89268e88b52dcf3ceaa",
      "worktree_digest": "sha256:ffb2515ffc587327d04adbb654eabc06781623bbdca00f587454ef7027ecc15d",
      "untracked_digest": "absent"
    }
  ]
},
    "primary_symbols": [
      {"symbol":"CandidateRegistrationIdentity.ResolveAsync","file":"HRConnect/HRConnect.Application/Features/Auth/Common/CandidateRegistrationIdentity.cs","lines":"9-34","role":"Registration identity invariant"},
      {"symbol":"RegisterCandidateCommandHandler.Handle","file":"HRConnect/HRConnect.Application/Features/Auth/Commands/RegisterCandidate/RegisterCandidateCommandHandler.cs","lines":"67-305","role":"Pending account/Candidate/OTP transaction"},
      {"symbol":"VerifyEmailOtpCommandHandler.Handle","file":"HRConnect/HRConnect.Application/Features/Auth/Commands/VerifyEmailOtp/VerifyEmailOtpCommandHandler.cs","lines":"58-278","role":"Post-OTP atomic Candidate claim"},
      {"symbol":"SubmitCandidateCommandHandler.Handle","file":"HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs","lines":"79-510","role":"Affiliate Candidate/CV/consent creation"}
    ],
    "related_symbols": [
      {"symbol":"CandidateRepository.TryLinkByVerifiedEmailAsync","file":"HRConnect/HRConnect.Infrastructure/Repositories/CandidateRepository.cs","usage_guidance":"Keep conditional DB update semantics inside claim transaction."},
      {"symbol":"ChangePasswordCommandHandler.Handle","file":"HRConnect/HRConnect.Application/Features/Auth/Commands/ChangePassword/ChangePasswordCommandHandler.cs","usage_guidance":"Reuse credential, transaction, revoke-session, audit ordering."},
      {"symbol":"ApplicationDbContext.OnModelCreating","file":"HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs","usage_guidance":"Respect Candidate/Application/Submission unique and composite constraints."}
    ],
    "files_to_modify": [
      {"file":"HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs","symbols":["OnModelCreating"],"intended_change":"Configure identity and claim tables."},
      {"file":"HRConnect/HRConnect.Application/Features/Auth/Common/CandidateRegistrationIdentity.cs","symbols":["ResolveAsync"],"intended_change":"Identity-store aware registration without weakening conflict rules."},
      {"file":"HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs","symbols":["Handle"],"intended_change":"Resolve alias and use account primary recipient."},
      {"file":"HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs","symbols":["MapCandidateEndpoints"],"intended_change":"Map Candidate identity APIs."},
      {"file":"HRConnect/HRConnect.Presentation/Endpoints/V1/Admin/AdminApprovalEndpoints.cs","symbols":["MapAdminApprovalEndpoints"],"intended_change":"Map Admin claim-review APIs."},
      {"file":"HRConnect-FE/src/features/candidates/CandidateProfilePage.tsx","symbols":["CandidateProfilePage"],"intended_change":"Readonly login email and identity-management navigation."}
    ],
    "tests": [
      {"file":"HRConnect/HRConnect.UnitTests/Features/Auth/RegisterCandidate/CandidateRegistrationIdentityTests.cs","scenarios":["alias ownership","foreign alias","email-phone mismatch"]},
      {"file":"HRConnect/HRConnect.UnitTests/Features/Auth/RegisterCandidate/RegisterCandidateCommandHandlerTests.cs","scenarios":["primary identity atomic","alias collision","rollback"]},
      {"file":"HRConnect/HRConnect.UnitTests/Features/Auth/VerifyEmailOtp/VerifyEmailOtpCommandHandlerTests.cs","scenarios":["registration identity verified","atomic claim","other roles unchanged"]},
      {"file":"HRConnect/HRConnect.UnitTests/Features/Affiliates/SubmitCandidateCommandHandlerTests.cs","scenarios":["alias canonical resolution","primary consent recipient","revoked alias","phone conflict"]},
      {"file":"HRConnect/HRConnect.IntegrationTests/Features/Candidates/CandidateIdentityClaimTests.cs","scenarios":["unique concurrency","safe swap","review conflict","migration constraints"]}
    ],
    "verification_commands": [
      "dotnet test HRConnect.sln --no-restore",
      "dotnet ef migrations has-pending-model-changes --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation --no-build",
      "npm run build --prefix HRConnect-FE",
      "npm run lint --prefix HRConnect-FE",
      "GitNexus detect_changes before each commit"
    ],
    "pdg_constraints": [
      "PDG rebuilt but no C# CDG/REACHING_DEF edges returned; source ordering is authoritative.",
      "No Candidate claim before OTP.",
      "Validate token before mutation; transaction before conditional claim; audit before commit.",
      "Resolve alias before Affiliate creates Candidate."
    ],
    "risks": ["identity takeover","blind merge corruption","email collision race","alias auth regression","legacy duplicate migration"],
    "assumptions": [
      "Check existing normalized AppUser emails before migration.",
      "Re-enumerate CandidateId dependent tables before migration.",
      "Verify outbox worker supports new template payload."
    ],
    "open_questions": [
      "Approve safe-swap-only release boundary; defer general merge of two non-empty candidates.",
      "Admin review UI same delivery or backend contract only.",
      "Report-suspicious-submission in this feature or follow-up."
    ],
    "avoid": [
      "No link by name, phone alone, Affiliate assertion or fuzzy match.",
      "Aliases never authenticate or reset password.",
      "No bulk reparent of two non-empty Candidate graphs.",
      "No raw OTP/full email in audit/log.",
      "No merge dev/main before manual acceptance."
    ]
  }
}
~~~

## 12. Assumptions and Open Questions

Assumptions:

- [assumed] Production AppUser emails are unique after normalization; migration validates and fails with diagnostics otherwise.
- [assumed] Main case is a new registration placeholder with no activity; safe swap fully solves it.
- [assumed] Outbox can add a versioned identity template; executor verifies worker payload compatibility.

Decisions for approval:

1. Recommended release boundary: auto-swap only when the newly registered Candidate is empty. Two Candidate profiles with history stay in Admin review. A general merge engine needs a separate conflict policy for same Job/Application/Attribution.
2. Admin review UI in this delivery, or backend + Swagger handoff first?
3. Include report-suspicious-submission now? Recommendation: follow-up; email still provides an official support path.

Explicitly deferred:

- General merge engine for two non-empty Candidate graphs.
- Affiliate contact relay/opt-in.
- Login with alias.

## 13. Definition of Done

- Migration/backfill succeeds with unique/FK/concurrency constraints and no data loss.
- Candidate, Affiliate and Client registration create PRIMARY identity atomically.
- Candidate can list/start/verify/resend/revoke/make-primary securely.
- Safe swap preserves old CandidateId and all history; conflicts use review response, never 500.
- Primary change revokes sessions; login/reset remain primary-only.
- Affiliate submit resolves verified alias, preserves mismatch checks and sends consent to primary email.
- New permissions are seeded, assigned and documented.
- Audit, email, Swagger and Vietnamese FE flow are complete.
- Tests and commands in §8 pass.
- Each API is tested, committed and pushed separately on feature/candidate-identity-claim; no dev/main merge before user manual test.