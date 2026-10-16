# GitNexus Engineering Plan

> Task: Hoàn thiện Backend quản trị RBAC production; chỉ viết tài liệu Markdown bàn giao FE sau khi toàn bộ API và test hoàn tất.
> Evidence verified at commit a5b91a56bd112c3b638a99b719b2854f440d19a8; GitNexus index refreshed this session with `gitnexus analyze . --index-only --pdg`.
> Evidence provenance schema 2; global dirty digest 0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd; cited-path manifest 27 sorted entries; exact generated plan path excluded.

## 1. Objective

Xây dựng Backend quản trị Permission catalog, custom Role, Role-Permission matrix và User-Role assignment đủ an toàn cho production. Platform Admin có thể xem quyền hiệu lực, tạo/quản lý custom Role và gán/thu hồi custom Role cho người dùng. Không sửa FE; sau khi toàn bộ API ổn định mới tạo `docs/RBAC/FRONTEND-INTEGRATION.md`.

[inferred] Không cấp Permission trực tiếp cho từng user. Quyền bổ sung cho một người đi qua custom Role để có nguồn quyền rõ ràng, tái sử dụng được, audit và thu hồi được.

## 2. Current Behaviour

- [verified] `DatabaseSeeder.SeedAsync` tạo năm system Role và chạy SQL Permission/RolePermission khi startup.
- [verified] Catalog hiện có hai nguồn: `HRConnect/Permission.md` và SQL nhúng. SQL startup bật lại `permission.is_active=true`, còn matrix dùng `ON CONFLICT DO NOTHING`; exception chỉ được ghi console.
- [verified] `ActiveAuthorizationClaimsTransformation.TransformAsync` dựng lại claims mỗi request từ ACTIVE UserRole + active Role + active Permission, nên thay đổi DB có hiệu lực ở request kế tiếp.
- [verified] Candidate nhận system Role lúc đăng ký; Affiliate/Client nhận hoặc reactivate Role qua workflow duyệt/xác minh.
- [verified] Admin user APIs mới có list/detail/status/unlock. Chưa có Role CRUD, Permission management, replace matrix, assign/revoke Role hoặc effective-permission provenance.
- [verified] Role, Permission và AppUser chưa có concurrency token cho authorization. UserRole có revoke metadata nhưng thiếu DB lifecycle constraint.
- [verified] `AdminApprovalService` reactivate bằng cách set ACTIVE nhưng chưa clear revoked metadata cũ.

## 3. Relevant Architecture

- [verified] Domain → Application CQRS → Infrastructure EF/repository → Presentation Minimal API là ranh giới hiện hành.
- [verified] `ChangeUserStatusCommandHandler` là mẫu write chuẩn: validate, mutate, add audit, single UoW save.
- [verified] `AuditLogService` tự bổ sung IP, user-agent và correlation; caller phải commit audit cùng transaction nghiệp vụ.
- [verified] Admin endpoints dùng system Role Platform Admin và explicit permission checks.
- [inferred] System Role thuộc registration/approval/profile workflows; generic RBAC API chỉ quản lý custom Role để không bypass invariant.
- [inferred] Permission code là contract của source authorization, vì vậy không mở API tạo/xóa Permission tùy ý.

## 4. GitNexus Findings

- [graph] `gitnexus query` cho authorization/role/permission tìm thấy runtime claims, seed, admin user repositories/tests nhưng không có CRUD RBAC hoàn chỉnh.
- [graph] `gitnexus context DatabaseSeeder` xác nhận `SeedAsync → GetPermissionSeedSql` là startup catalog writer.
- [graph] `gitnexus context TransformAsync` xác nhận runtime gọi `IUserRepository.GetByIdWithRolesAndPermissionsAsync` và lọc cả ba lớp assignment/role/permission.
- [graph] `gitnexus impact Role --direction upstream` có direct radius thấp, chủ yếu DatabaseSeeder.
- [graph] `gitnexus impact UserRole --direction upstream` là CRITICAL: 31 dependent, 11 direct, 7 process, 9 module. Direct BE consumers gồm registration, approval, identity claim, demo seeding và admin projection.
- [graph] Hai FE direct consumers được defer sang tài liệu bàn giao; không sửa trong scope Backend.
- [verified] Một số graph edges là UNKNOWN do repository dispatch/DI; source verification đã xác nhận endpoint registration và startup calls nên không coi UNKNOWN là không có caller.

## 5. Statement-Level PDG Findings

- [graph] `ActiveAuthorizationClaimsTransformation.cs:20`: authentication/subject/user-status guards kiểm soát `activeAssignments` khoảng dòng 40 và hai vòng add claims khoảng dòng 55–60. **Ràng buộc:** membership/matrix phải nhất quán tại commit.
- [graph] `DatabaseSeeder.cs:11`: SQL qua non-empty guard tới ExecuteSqlRaw; lỗi đi vào catch/console khoảng dòng 82. **Ràng buộc:** catalog writes chuyển sang migration và startup validation phải fail-fast.
- [graph] `AdminApprovalService.cs:28`: guards chạy trước mutate; reactivation hiện chỉ set ACTIVE. **Ràng buộc:** clear revoke metadata, refresh assignment provenance và rotate AppUser authorization token cùng transaction.
- [graph] PDG `ChangeUserStatusCommandHandler` xác nhận mutate + audit + single save là mẫu phù hợp.
- [graph] Taint/explain không có finding cho ba path trên; đây không phải bằng chứng tuyệt đối vì property/DI flows có thể nằm ngoài closure.

## 6. Proposed Changes

### 6.1 Data model

- **AppUser:** thêm `AuthorizationConcurrencyToken Guid`, EF concurrency token; rotate khi assign/reactivate/revoke Role.
- **Role:** thêm `ConcurrencyToken Guid`; code immutable sau create; DELETE là soft-deactivate custom Role.
- **Permission:** thêm `IsDelegable` và `ConcurrencyToken`; code/resource/action migration-owned và immutable qua API.
- **RolePermission:** thêm `GrantedBy` nullable FK và `GrantSource` (`SYSTEM_MIGRATION` / `ADMIN_ASSIGNMENT`).
- **UserRole:** DB checks cho status ACTIVE/REVOKED và tính nhất quán revoke fields; migration normalize legacy rows trước khi add constraints.
- Protected IAM permissions tối thiểu gồm `role.manage`, `permission.manage`; exact set được rà theo endpoint trước migration. Protected/non-delegable permissions không được gắn vào custom Role.

### 6.2 One authoritative catalog

- Chuyển exact system Role/Permission/default matrix vào EF data migration.
- `DatabaseSeeder` dừng rewrite/reactivate permission/mapping; startup chỉ validate protected catalog và fail-fast nếu thiếu/sai.
- Xóa dual source hoặc biến `Permission.md` thành tài liệu tham chiếu được sinh từ catalog, không còn là input runtime.
- Seeder tests kiểm exact catalog/matrix, không chỉ tìm vài chuỗi.

### 6.3 Repository/application contracts

- Mở rộng Role/UserRole repositories, thêm Permission repository: paged/filter queries, tracked lookup, replace permission set, assignment lifecycle, effective-permission projection kèm source roles.
- Repository không tự SaveChanges; handlers validate → mutate → audit → one UoW save.
- Map concurrency violations/token mismatch thành 409 stable problem code.

### 6.4 Backend APIs

Base group: `/api/v1/admin/authorization`. Mọi API yêu cầu ACTIVE Platform Admin; read dùng *.view, writes dùng *.manage.

**Permission catalog**
1. `GET /permissions`: page/search/resource/action/isActive/isDelegable.
2. `GET /permissions/{permissionId}`: metadata, protected/delegable, custom-role usage count, token.
3. `PATCH /permissions/{permissionId}`: chỉ description/isActive, expected token; reason khi đổi status. Cấm đổi code/resource/action và disable protected permission.

**Custom Role CRUD**
4. `GET /roles`: page/search/system/custom/active filters.
5. `GET /roles/{roleId}`: metadata, permissions, active assignment count, token.
6. `POST /roles`: tạo custom Role; normalized unique non-reserved code.
7. `PATCH /roles/{roleId}`: name/description/isActive + expected token + reason.
8. `DELETE /roles/{roleId}`: audited soft deactivate; nếu còn active assignment trả 409.
9. `PUT /roles/{roleId}/permissions`: atomic replace active delegable Permission IDs + expected role token + reason; reject duplicate/missing/inactive/non-delegable IDs.

**User authorization**
10. `GET /users/{userId}`: user status/token, system/custom assignments, deduplicated effective permissions và source role.
11. `POST /users/{userId}/roles`: assign/reactivate active custom Role cho active user + expected user token + reason.
12. `DELETE /users/{userId}/roles/{roleId}`: revoke custom Role + expected token + reason.

Stable errors: validation 400; missing 404; 403 cho thiếu quyền/`SELF_ROLE_MUTATION_FORBIDDEN`; 409 cho `RBAC_CONCURRENCY_CONFLICT`, `SYSTEM_ROLE_IMMUTABLE`, `ROLE_IN_USE`, `ROLE_INACTIVE`, `USER_INACTIVE`, `NON_DELEGABLE_PERMISSION`, `PROTECTED_PERMISSION`.

### 6.5 Business/security rules

- Custom Role không thể tự trao quyền gọi IAM APIs nếu actor không có system Role Platform Admin.
- Actor không được sửa role assignment của chính mình.
- Generic API không assign/revoke system Role.
- Target user/custom Role phải ACTIVE khi assign.
- Mutation reason bắt buộc; actor lấy từ claims, không lấy body.
- Assign đang ACTIVE/revoke đã REVOKED là 200 no-op current state, không ghi audit changed; stale token vẫn trả 409 trước.
- Mutation và audit cùng transaction. Audit actions: ROLE_CREATED/UPDATED/DEACTIVATED, ROLE_PERMISSIONS_REPLACED, PERMISSION_UPDATED/ACTIVATED/DEACTIVATED, USER_ROLE_ASSIGNED/REVOKED.
- Audit chứa IDs/codes, added/removed sets, reason và token transition; không ghi JWT/secret.

### 6.6 Repair existing workflows

- Registration, Affiliate/Client approval và demo provisioning duy trì lifecycle fields và rotate AppUser token.
- Reactivation clear `RevokedAt/RevokedBy/RevokeReason`, refresh `AssignedAt/AssignedBy/AssignmentSource`.
- Regression-test identity claim eligibility/review và admin user projections do chúng là direct UserRole dependents.
- Không thay đổi JWT shape hoặc claims transformation logic ngoài coverage cần thiết.

### 6.7 FE handoff only after APIs pass

Tạo `docs/RBAC/FRONTEND-INTEGRATION.md` sau cùng: routes/permissions, request-response examples từ code thật, pagination, concurrency/refetch flow, system/custom constraints, stable errors, UI state recommendations và flow “extra access = custom Role → permissions → assign”. Không sửa FE.

## 7. Implementation Sequence

1. Chốt exact catalog, protected/delegable flags và default matrix; inventory read-only legacy UserRole.
2. Thêm entity/mapping/concurrency/provenance/constraints; migration cleanup trước constraints và data-migrate catalog.
3. Dừng runtime catalog rewrite; thêm fail-fast validator và exact catalog tests.
4. Mở rộng repositories/DI/projections.
5. Hoàn thành 3 Permission APIs + audit/concurrency tests.
6. Hoàn thành 6 Role/matrix APIs + system/protected guards.
7. Hoàn thành 3 User authorization APIs + self/system/inactive/concurrency guards.
8. Repair registration/approval/demo role writers và chạy direct-dependent regressions.
9. Wire endpoint group/OpenAPI/problem details.
10. Full tests/build/idempotent migration rehearsal trên DB mới và legacy fixture.
11. Viết FE Markdown từ implemented contract.
12. GitNexus detect_changes/impact/review trước merge.

## 8. Test Strategy

- **Permission:** list/filter; immutable fields; protected disable; stale token; audit rollback.
- **Role:** duplicate/reserved code; system immutable; role in use; soft deactivate/reactivate; stale token.
- **Matrix:** duplicate/missing/inactive/non-delegable IDs; empty custom set; exact diff/audit; rollback.
- **User authorization:** dedup effective permission with source roles; inactive elements excluded; assign/revoke/reactivate lifecycle; self/system/inactive/stale guards.
- **Existing flows:** Candidate registration, Affiliate/Client approval, demo seed, identity claims, admin projections.
- **Auth:** next request immediately reflects assign/revoke/matrix changes; non-Platform Admin blocked even with custom manage permission.
- **Schema/seed:** unique codes, provenance FKs, lifecycle checks, concurrency metadata, legacy cleanup, fail-fast missing catalog, restart does not rewrite runtime state.
- **OpenAPI:** all 12 routes and 400/403/404/409 response schemas.

Commands verified:
- `dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --no-restore`
- `dotnet build HRConnect/HRConnect.sln --no-restore`
- `dotnet ef migrations script --idempotent --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation --output <temporary-path>`
- GitNexus detect_changes + upstream impact on changed RBAC symbols.

## 9. Risk and Impact Analysis

- **Critical UserRole radius:** all 11 direct dependents must be regression-covered.
- **Admin lockout:** bad catalog/matrix can remove Platform Admin access; migration validates protected path before deploy completes.
- **Privilege escalation:** IsDelegable + Platform Admin gate + system Role protection are mandatory.
- **Lost update:** Role/AppUser aggregate tokens guard replace/assign/revoke.
- **Migration:** normalize legacy state without deleting assignment history; rehearse idempotent script.
- **Immediate revocation:** claims refresh each request; docs must not instruct re-login.
- **Performance:** use projections/pagination, not full graph materialization.
- **Audit:** entity and audit never commit separately.
- **Compatibility:** existing JWT and endpoint paths unchanged.
- **FE:** no code edit; final Markdown is the only FE deliverable.

## 10. Files Expected to Change

| Area | Expected files/symbols | Reason |
| --- | --- | --- |
| Domain | AppUser, Role, Permission, RolePermission, UserRole | Tokens, delegability, provenance, lifecycle |
| EF | ApplicationDbContext + new migration/snapshot | Schema, cleanup, exact catalog |
| Seed | DatabaseSeeder, Permission.md | Remove dual-source rewrite; fail-fast validation |
| Repositories | interfaces + Role/UserRole/User/Permission implementations | Queries and tracked writes |
| Application | new Features/Admin/Authorization slice; AuditActions | CQRS APIs, validators, DTOs, audit |
| Existing workflows | RegisterCandidateCommandHandler, AdminApprovalService, demo seeder | Correct role lifecycle/token rotation |
| Presentation | new admin authorization endpoints + Program registration | 12 APIs/OpenAPI |
| Tests | persistence/auth/admin/approval/identity tests | Production coverage |
| Docs | docs/RBAC/FRONTEND-INTEGRATION.md | FE handoff after API completion |

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: 'Backend-only production RBAC management; FE Markdown after all APIs pass.'
  acceptance_criteria:
    - '12 specified admin authorization APIs implemented and documented.'
    - 'Only custom roles are generically managed/assigned.'
    - 'No direct per-user permissions or arbitrary Permission create/delete.'
    - 'Concurrency-safe, transactional and audited mutations.'
    - 'Single migration-backed system authorization catalog; startup fail-fast.'
    - 'Existing registration/approval/identity/admin flows regressions pass.'
    - 'No FE code changes.'
  evidence_provenance:
    schema_version: 2
    head_commit: 'a5b91a56bd112c3b638a99b719b2854f440d19a8'
    generated_plan_path: 'docs/plans/2026-10-16-gitnexus-plan-production-rbac-management.md'
    global_dirty_digest:
      algorithm: 'sha256'
      canonicalization: 'gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records'
      value: '0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd'
    cited_path_manifest:
      - path: 'AGENTS.md'
        object_kind: { head: 'absent', index: 'absent', worktree: 'absent', untracked: 'regular' }
        state: 'untracked'
        rename_from: null
        rename_to: null
        head_digest: 'absent'
        index_digest: 'absent'
        worktree_digest: 'absent'
        untracked_digest: 'sha256:8d6bf91756738c63b47d586b3872c7e81e6b21080c124252305981667be4c577'
      - path: 'HRConnect/HRConnect.Application/Common/Interfaces/IAuditLogService.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:18c66023c90e92f4fe8144851cb1a42dd170e014addfe6bc3824f66fb8cc8411'
        index_digest: 'sha256:18c66023c90e92f4fe8144851cb1a42dd170e014addfe6bc3824f66fb8cc8411'
        worktree_digest: 'sha256:99ddab7f175107e8d4797da9df7b1fb03321f06893a0d09d4176c5562b8a5773'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Application/Common/Interfaces/Repositories/IRoleRepository.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:7276373df999811054889d2226962008b72d1ff7262b79645232feb1a625368a'
        index_digest: 'sha256:7276373df999811054889d2226962008b72d1ff7262b79645232feb1a625368a'
        worktree_digest: 'sha256:a561b5c8cb8bca1bd327ddf5b9b3cc04575a357c6856e10ca0b7bdb8585b3053'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Application/Common/Interfaces/Repositories/IUserRoleRepository.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:857a27d1641434c49a92094db8fb54524b57e993b22e8269332d3b83130580bc'
        index_digest: 'sha256:857a27d1641434c49a92094db8fb54524b57e993b22e8269332d3b83130580bc'
        worktree_digest: 'sha256:b698e268243350390edf533691d8d618240c8b9400dfb035a2eb1a93690cfc0f'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Application/Common/Models/AuditActions.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:23bee843d1ddc0756e440f69908e84277da7eb9c5fc04622366420053afb77c7'
        index_digest: 'sha256:23bee843d1ddc0756e440f69908e84277da7eb9c5fc04622366420053afb77c7'
        worktree_digest: 'sha256:adcf7c530ca6d6ec428f11cf46c037f85ec7e93c9e1c8a8e935cd9b39b3174fd'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Application/Features/Admin/Users/Commands/ChangeUserStatus/ChangeUserStatusCommand.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:82d70be345f0aa9bdfe5acc713774fca35d959edde652e9a4e5e4ca181112c5b'
        index_digest: 'sha256:82d70be345f0aa9bdfe5acc713774fca35d959edde652e9a4e5e4ca181112c5b'
        worktree_digest: 'sha256:96082e0a2c9b4f540ceb883fc7369cda869c2ed170a213ce0d3e898d6e7abe81'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Application/Features/Auth/Commands/RegisterCandidate/RegisterCandidateCommandHandler.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:16278ba84feb30387eec30776f1ae6e6300c1ac3d14b55583de23e3f85d766d4'
        index_digest: 'sha256:16278ba84feb30387eec30776f1ae6e6300c1ac3d14b55583de23e3f85d766d4'
        worktree_digest: 'sha256:76eb72261a6f3165677ceeb3084792896e1980e6db0339c1d5b9821b330b9066'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Domain/Entities/AppUser.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:a8eb959f41a6e3709c38d1300e526449ad33e06f663d60abd47a7fd206861445'
        index_digest: 'sha256:a8eb959f41a6e3709c38d1300e526449ad33e06f663d60abd47a7fd206861445'
        worktree_digest: 'sha256:db3e5a27de04959081ca9ce6010879ce5a09f53444241027837efd9c6bf50d3f'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Domain/Entities/Permission.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:511d7e61bc0291fa1c4176bc535f77e3e91f84134bb972cb585c1288f97414e4'
        index_digest: 'sha256:511d7e61bc0291fa1c4176bc535f77e3e91f84134bb972cb585c1288f97414e4'
        worktree_digest: 'sha256:a52e47516fcba243d1cc14857b22d13a1487c5475385fcc1bb3c440d5baa676c'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Domain/Entities/Role.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:9e5595a9434a2d23484998ee707829b97d2fcebe9b1834622e65b60049a370aa'
        index_digest: 'sha256:9e5595a9434a2d23484998ee707829b97d2fcebe9b1834622e65b60049a370aa'
        worktree_digest: 'sha256:6a96849ff84a5afc6a72e7bb26cc3815afc39d11f8ee63ed3969c8f60e2de56c'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Domain/Entities/RolePermission.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:8272a66ab905e56c7bb2f5eb6e41e7a9351a7c3e3de11facde2a38d282c74c7b'
        index_digest: 'sha256:8272a66ab905e56c7bb2f5eb6e41e7a9351a7c3e3de11facde2a38d282c74c7b'
        worktree_digest: 'sha256:a3174794aba697a0bf26e5c67467037c24aabb0c54d12f618093402516f5c565'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Domain/Entities/UserRole.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:f4c41b92a4cbd1cb456df77d8f0b1853f6cac2c0f2f8cfb242ae6e024e4067d6'
        index_digest: 'sha256:f4c41b92a4cbd1cb456df77d8f0b1853f6cac2c0f2f8cfb242ae6e024e4067d6'
        worktree_digest: 'sha256:f7458931f7919ae8fc7b4d2b5cee7142772581b0e93cd2a8224c671989e178f4'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Infrastructure/Authentication/ActiveAuthorizationClaimsTransformation.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:9b2d47d2bdcde015cff61a9cf887acb4b62b96d6d4c736f926a344517a42152f'
        index_digest: 'sha256:9b2d47d2bdcde015cff61a9cf887acb4b62b96d6d4c736f926a344517a42152f'
        worktree_digest: 'sha256:371ef6c3d197cf4b659c7622b9fa31caf9e390e025a61d5a468762f44618076e'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:90ded71ce918b3c6ac781e59fa0338f04abc960fa096ede89762efdea1836ecb'
        index_digest: 'sha256:90ded71ce918b3c6ac781e59fa0338f04abc960fa096ede89762efdea1836ecb'
        worktree_digest: 'sha256:cf862fea38999c71eaddd8a5e58197f1c9fb7a4c622357e7a601a3fbc53a27d5'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Infrastructure/Persistence/DatabaseSeeder.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:f15aecaddf99a7eeb8d9fb96c1c876169e2ccb93d85051d01844055c66218180'
        index_digest: 'sha256:f15aecaddf99a7eeb8d9fb96c1c876169e2ccb93d85051d01844055c66218180'
        worktree_digest: 'sha256:15396acc24e22a01c6c1a88911487b94a4eb352720d5ef45d9db78d19f0ac187'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Infrastructure/Repositories/RoleRepository.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:d4696655255f714699f5930013bad06f12f2581f244687b747b059d57ada9a0c'
        index_digest: 'sha256:d4696655255f714699f5930013bad06f12f2581f244687b747b059d57ada9a0c'
        worktree_digest: 'sha256:96928653d6467b21f58980247f2a6864a7ad5be2e9e5d7f7eff48375b0d1be34'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Infrastructure/Repositories/UserRepository.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:826ceaea12219d12c99cccdd8b1629892f8c844c7a90ed3616df82dcca3cdf23'
        index_digest: 'sha256:826ceaea12219d12c99cccdd8b1629892f8c844c7a90ed3616df82dcca3cdf23'
        worktree_digest: 'sha256:0e9531d0b2753dc6d8d2ccf1428c3ae4e67deb916cc061abd0f1dde25fe33428'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Infrastructure/Repositories/UserRoleRepository.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:87717275bd69d21bcfa9add8e617762dbd7595ac0ab56a693caad2ba18eca462'
        index_digest: 'sha256:87717275bd69d21bcfa9add8e617762dbd7595ac0ab56a693caad2ba18eca462'
        worktree_digest: 'sha256:fede32be5a37d4b5b5d3222a3d3d1123e3feaaf7eae880ed287031defce4630c'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Infrastructure/Services/Admin/AdminApprovalService.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:0ef1261717091593b01d4f6fb0034c3acf7847e125ae2d56c98f1b9ec9f83c2e'
        index_digest: 'sha256:0ef1261717091593b01d4f6fb0034c3acf7847e125ae2d56c98f1b9ec9f83c2e'
        worktree_digest: 'sha256:f5becb5ce08d23c53224e83ed9b31b6d75ee099a0874c755ce5f50a5aec59394'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Infrastructure/Services/Audit/AuditLogService.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:e7741893346c55fdc3a30e0fd327f46267556ee64c97a648aaefd31294a936f0'
        index_digest: 'sha256:e7741893346c55fdc3a30e0fd327f46267556ee64c97a648aaefd31294a936f0'
        worktree_digest: 'sha256:93f69187509d530cf29afb3368b8e7536fb66fb2f929cb0f52d7af034886ca38'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Presentation/Authorization/PermissionAuthorization.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:12bcf7ad7c9b90b39f51b4fcba04b2854d7feca75f43f4cbef94f72a0ddf83ba'
        index_digest: 'sha256:12bcf7ad7c9b90b39f51b4fcba04b2854d7feca75f43f4cbef94f72a0ddf83ba'
        worktree_digest: 'sha256:118a195b48bc11d1b1f0671ae87429f7dcd89ba8aa9733471d883480f49220fb'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Presentation/Endpoints/V1/Admin/AdminUserEndpoints.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:29cce0cbeddb56455a5e15ab51596189664578e771dcbd8b8c57384c5c68068f'
        index_digest: 'sha256:29cce0cbeddb56455a5e15ab51596189664578e771dcbd8b8c57384c5c68068f'
        worktree_digest: 'sha256:165750b9eb4715f0d53561c7f683d84a0d30df1fa09c97010a70d078d504d95f'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.Presentation/Program.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:d9385f259aea7fe4f4f86b0c9854969534ea26f72facb3cc5be5c0b11afaf065'
        index_digest: 'sha256:d9385f259aea7fe4f4f86b0c9854969534ea26f72facb3cc5be5c0b11afaf065'
        worktree_digest: 'sha256:cf09a7715698943ca42ba4b766d971d57a3cbbbfd5ea734353381e2a1bad4a3e'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.UnitTests/Authentication/ActiveAuthorizationClaimsTransformationTests.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:67127de788743ad6ac24b76989e1a7267e2c2bcaedecaf88219288fe4be229bb'
        index_digest: 'sha256:67127de788743ad6ac24b76989e1a7267e2c2bcaedecaf88219288fe4be229bb'
        worktree_digest: 'sha256:f82bb646733ed306bea19385cd401fd850a7cfd2393f4a1247a8ad45bdfa73cf'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.UnitTests/Features/Admin/Users/AdminUserManagementHandlerTests.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:91bea884f3120fed6f2fa97e25eb54220eb8c7c88006a9bdf9933acc627ff1ca'
        index_digest: 'sha256:91bea884f3120fed6f2fa97e25eb54220eb8c7c88006a9bdf9933acc627ff1ca'
        worktree_digest: 'sha256:644a0e96e81bb359ac02ec659dde6541156579ac3ff139eef5451da3f75b481a'
        untracked_digest: 'absent'
      - path: 'HRConnect/HRConnect.UnitTests/Persistence/PermissionSeederTests.cs'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:233d678a14e8681feea87d906e1e0c3a52d21851ee736af5be8975f9f92055aa'
        index_digest: 'sha256:233d678a14e8681feea87d906e1e0c3a52d21851ee736af5be8975f9f92055aa'
        worktree_digest: 'sha256:cf421cec57f11ff91edc2a92d7d31bc112ba94268d4fcad7e193b33f1ffb9a24'
        untracked_digest: 'absent'
      - path: 'HRConnect/Permission.md'
        object_kind: { head: 'regular', index: 'regular', worktree: 'regular', untracked: 'absent' }
        state: 'clean'
        rename_from: null
        rename_to: null
        head_digest: 'sha256:dcce8c1c280efcc8fd93648b00d35a8bdf29849703fd5a9db0178fca43cf518e'
        index_digest: 'sha256:dcce8c1c280efcc8fd93648b00d35a8bdf29849703fd5a9db0178fca43cf518e'
        worktree_digest: 'sha256:67ed3a175b85a771a18c4e84905cdd3f659c28c1ba915a757fa0893c343bab1a'
        untracked_digest: 'absent'
  primary_symbols:
    - { symbol: 'DatabaseSeeder.SeedAsync', file: 'HRConnect/HRConnect.Infrastructure/Persistence/DatabaseSeeder.cs', lines: 'startup seed path', role: 'Replace writer with validator.' }
    - { symbol: 'ActiveAuthorizationClaimsTransformation.TransformAsync', file: 'HRConnect/HRConnect.Infrastructure/Authentication/ActiveAuthorizationClaimsTransformation.cs', lines: '20-65', role: 'Request-time authorization.' }
    - { symbol: 'AppUser/Role/Permission/RolePermission/UserRole', file: 'HRConnect/HRConnect.Domain/Entities', lines: 'entities', role: 'RBAC model.' }
    - { symbol: 'AdminApprovalService', file: 'HRConnect/HRConnect.Infrastructure/Services/Admin/AdminApprovalService.cs', lines: 'role activation', role: 'System role workflow repair.' }
  related_symbols:
    - { symbol: 'ChangeUserStatusCommandHandler', relationship: 'pattern', relevance: 'Validate-mutate-audit-single-save.' }
    - { symbol: 'RegisterCandidateCommandHandler', relationship: 'UserRole writer', relevance: 'Default Candidate role.' }
    - { symbol: 'IUserRepository.GetByIdWithRolesAndPermissionsAsync', relationship: 'called by claims transform', relevance: 'Effective claims source.' }
  execution_path:
    - 'Startup migrates then validates system authorization catalog.'
    - 'Admin reads paged catalog/roles/user authorization.'
    - 'Write validates Platform Admin, permission, invariant, reason and expected token.'
    - 'Handler mutates, audits, rotates token and commits once.'
    - 'Next request observes new DB-backed claims.'
  pdg_constraints:
    - { description: 'Claims require active assignment/role/permission.', affected_statements: ['ActiveAuthorizationClaimsTransformation.cs:40','ActiveAuthorizationClaimsTransformation.cs:55','ActiveAuthorizationClaimsTransformation.cs:60'], implementation_consequence: 'Commit consistent authorization state atomically.' }
    - { description: 'Seeder currently swallows SQL failure.', affected_statements: ['DatabaseSeeder.cs:70','DatabaseSeeder.cs:82'], implementation_consequence: 'Migration owns writes; validator fails fast.' }
    - { description: 'Approval reactivation only sets ACTIVE.', affected_statements: ['AdminApprovalService.cs:101','AdminApprovalService.cs:120'], implementation_consequence: 'Clear revoke metadata and rotate user token.' }
  architectural_patterns:
    - { pattern: 'CQRS mutation + audit + one UoW save', example_location: 'Features/Admin/Users/Commands/ChangeUserStatus', usage_guidance: 'Use for all RBAC writes.' }
    - { pattern: 'DB-backed request claims', example_location: 'ActiveAuthorizationClaimsTransformation.cs', usage_guidance: 'Test next-request effects.' }
    - { pattern: 'Platform Admin + permission gate', example_location: 'AdminUserEndpoints.cs', usage_guidance: 'Apply to new group.' }
  files_to_modify:
    - { file: 'HRConnect/HRConnect.Domain/Entities', symbols: ['AppUser','Role','Permission','RolePermission','UserRole'], intended_change: 'RBAC production fields.' }
    - { file: 'HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs', symbols: ['OnModelCreating'], intended_change: 'Mappings and constraints.' }
    - { file: 'HRConnect/HRConnect.Infrastructure/Persistence/DatabaseSeeder.cs', symbols: ['SeedAsync','GetPermissionSeedSql'], intended_change: 'Stop rewrite; validate.' }
    - { file: 'HRConnect/HRConnect.Application/Features/Admin/Authorization', symbols: [], intended_change: 'New Backend feature slice.' }
    - { file: 'HRConnect/HRConnect.Presentation/Endpoints/V1/Admin', symbols: [], intended_change: '12 APIs.' }
    - { file: 'docs/RBAC/FRONTEND-INTEGRATION.md', symbols: [], intended_change: 'Post-API FE contract.' }
  tests:
    - { file: 'HRConnect/HRConnect.UnitTests/Persistence/PermissionSeederTests.cs', scenarios: ['Exact catalog/matrix','Missing protected record fails','Restart does not rewrite'] }
    - { file: 'HRConnect/HRConnect.UnitTests/Authentication/ActiveAuthorizationClaimsTransformationTests.cs', scenarios: ['Assign appears next request','Revoke disappears next request','Inactive elements excluded'] }
    - { file: 'HRConnect/HRConnect.UnitTests/Features/Admin/Authorization', scenarios: ['All handler happy/error/concurrency/audit paths','System/protected guards','Matrix diff rollback','Assignment lifecycle'] }
    - { file: 'HRConnect/HRConnect.UnitTests/Features/Admin/Users/AdminUserManagementHandlerTests.cs', scenarios: ['Existing projections remain compatible'] }
  verification_commands:
    - 'dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --no-restore'
    - 'dotnet build HRConnect/HRConnect.sln --no-restore'
    - 'dotnet ef migrations script --idempotent --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation --output <temporary-path>'
    - 'gitnexus detect_changes'
  risks:
    - 'Critical UserRole cross-module impact.'
    - 'Admin lockout from catalog drift.'
    - 'Privilege escalation through delegable permissions.'
    - 'Lost update without aggregate tokens.'
    - 'Legacy lifecycle cleanup and audit atomicity.'
  assumptions:
    - 'Re-run detect_changes/source search for RBAC drift before implementation.'
    - 'Re-audit protected permission set against endpoint permission checks.'
    - 'Inventory production UserRole statuses read-only before migration.'
    - 'Validate migration command against installed dotnet-ef and target framework.'
  open_questions:
    - 'Default: role.view and permission.view may be delegable, but manage permissions are protected.'
    - 'Default: soft-deactivated custom role may be reactivated if its permission set remains valid.'
  avoid:
    - 'Do not add direct per-user permission overrides.'
    - 'Do not expose arbitrary Permission POST/DELETE.'
    - 'Do not generically assign/revoke system roles.'
    - 'Do not allow self role mutation.'
    - 'Do not separate entity and audit commits.'
    - 'Do not edit FE code.'
    - 'Do not repeat full repository discovery.'
```

## 12. Assumptions and Open Questions

**Confirmed:** Backend only; FE Markdown comes last. Custom Role is the unit for extra user access. Permission identifiers are code-owned. System Role remains workflow-owned.

**Re-verify before implementation:**
1. [assumed] No newer RBAC branch after evidence commit: check git log/status, GitNexus detect_changes and targeted source search.
2. [assumed] Protected set starts with role.manage/permission.manage: audit all IAM endpoints before migration.
3. [assumed] Legacy UserRole data can be normalized without loss: run read-only status/revoke-field inventory.
4. [assumed] Platform Admin default matrix retains a valid management path: exact migration test must prove it.

**Defaults pending user override:** view permissions may be delegable; manage permissions are protected. Soft-deactivated custom roles may be reactivated via PATCH when valid. Idempotent assign/revoke returns 200 current representation and creates no change audit.

**Deferred:** FE implementation, ABAC/resource scopes, multi-level approval, temporary assignments, service-account RBAC.

## 13. Definition of Done

- Migration safely adds tokens/provenance/constraints and exact system catalog.
- Startup no longer rewrites authorization; corrupt catalog blocks startup visibly.
- All 12 Backend APIs work with OpenAPI, stable errors, pagination/filter and correct gates.
- System Role/protected Permission/self-mutation escalation paths are blocked.
- Matrix and membership writes resist lost updates and audit atomically.
- Existing registration/approval/identity/admin/runtime-claims tests pass.
- Full unit tests, build and idempotent migration script succeed.
- FE handoff Markdown matches implemented contract; FE source is untouched.
- Final GitNexus review has no blocking finding.
