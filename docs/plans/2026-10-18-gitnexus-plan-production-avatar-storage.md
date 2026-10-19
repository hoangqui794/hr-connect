# GitNexus Engineering Plan

> Task: Làm lại toàn bộ API avatar và phần FE sử dụng avatar theo tiêu chuẩn production.
> Evidence verified at commit `52bca392c873528b651d5e65106c063fa46f77b9`; GitNexus index 8 commits behind. Refresh bằng `node .gitnexus/run.cjs analyze --index-only --pdg` đã thất bại do native worker không khởi động, vì vậy graph chỉ dùng để định hướng và mọi quyết định chính được kiểm chứng lại từ source hiện tại.
> Evidence provenance schema 2; global dirty digest `0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd`; cited-path manifest 30 sorted entries; exact generated plan path excluded.

## 1. Objective

Thiết kế lại trọn luồng avatar để ảnh được lưu bền vững trên Cloudflare R2, database chỉ lưu định danh ổn định, mọi API/profile trả URL dùng được ở local và production, FE cập nhật đồng nhất ngay sau upload/delete, đồng thời ngăn file giả mạo và xử lý đúng các lỗi giữa R2 với PostgreSQL.

Phạm vi gồm POST/GET/DELETE avatar, dữ liệu và migration, xử lý ảnh, cleanup storage, các DTO profile/auth ở mọi role, cấu hình deploy, UI upload/delete, cache busting, test và rollout. Không thay đổi luồng CV dù dùng chung `IFileStorageService`.

## 2. Current Behaviour

- [verified] `POST /api/v1/users/me/avatar` và alias `/api/v1/users/avatar` chứa hai đoạn endpoint gần như trùng nhau; `GET /users/{userId}/avatar` đọc trực tiếp `AppUser.AvatarUrl`; DELETE xóa trường đó (`HRConnect/HRConnect.Presentation/Endpoints/V1/Users/UserEndpoints.cs:21`, `:100`, `:179`, `:226`).
- [verified] Upload tạo key `avatars/{userId}/{guid}{ext}`, upload lên R2, rồi lưu vào `avatar_url` một trong ba dạng: public URL, presigned URL 7 ngày hoặc object key (`UploadAvatarCommandHandler.cs:54-113`). URL ký có hạn vì thế có thể hết hạn ngay trong database.
- [verified] Avatar cũ chỉ bị xóa khi giá trị DB bắt đầu bằng `avatars/`; giá trị public/presigned URL không được cleanup (`UploadAvatarCommandHandler.cs:94-104`, `DeleteAvatarCommandHandler.cs:37-46`).
- [verified] Upload xóa object cũ trước khi commit DB và không xóa object mới nếu commit thất bại, tạo khả năng DB trỏ file đã mất hoặc R2 còn file mồ côi (`UploadAvatarCommandHandler.cs:94-115`).
- [verified] Validator chỉ tin extension, MIME do client gửi và dung lượng, chưa decode ảnh thật (`UploadAvatarCommandValidator.cs:9-35`).
- [verified] Response upload lộ `ObjectKey`; FE không dùng trường này (`UploadAvatarCommand.cs:28-32`, `HRConnect-FE/src/services/api/userApi.ts:7-55`).
- [verified] Các query current user, Candidate, Affiliate, Internal HR và Admin trả thẳng `AppUser.AvatarUrl`, khiến hợp đồng API không nhất quán khi DB lưu key (`GetCurrentUserQueryHandler.cs:74` và bốn profile handlers tương ứng).
- [verified] FE chỉ coi `http`, `https` hoặc `data` là ảnh tùy chỉnh; URL tương đối/object key sẽ thành initials. Sau upload/delete FE chỉ sửa auth store cục bộ (`AvatarUpload.tsx:24-87`).

## 3. Relevant Architecture

- [verified] `AppUser.AvatarUrl` map vào cột `avatar_url` (`AppUser.cs:23`, `ApplicationDbContext.cs:452`). Đây đang trộn định danh lưu trữ với URL phân phối.
- [verified] `CloudflareR2StorageService` đã có upload, delete và presigned URL; service này dùng chung với CV nên giữ generic và không đưa logic avatar vào đây (`CloudflareR2StorageService.cs:26`, `:128`, `:168`).
- [verified] FE dùng Axios `API_BASE_URL` lấy từ `VITE_API_URL`/`VITE_API_BASE_URL`; `<img src>` không tự kế thừa base URL Axios (`apiClient.ts:12-29`).
- [verified] Repo đã có EF Core migrations, unit tests xUnit và Vitest; CI chạy `dotnet test HRConnect/HRConnect.sln --configuration Release --no-build` (`.github/workflows/ci-cd.yml:61`, `HRConnect-FE/package.json:6`).
- [inferred] Ranh giới đúng là: database lưu object key + version; BE resolver tạo URL công khai ổn định; GET avatar redirect đến URL R2 ngắn hạn; FE chỉ hiển thị URL API đã chuẩn hóa.

## 4. GitNexus Findings

- [graph] `context(UploadAvatarCommandHandler)` xác định handler ở `UploadAvatarCommandHandler.cs:11-130`; caller trực tiếp mà graph thấy là test. Graph stale nên không dùng kết quả này để phủ định các caller runtime/DI.
- [graph] `impact(UploadAvatarCommandHandler, upstream)` và `impact(DeleteAvatarCommandHandler, upstream)` báo LOW với một dependent trực tiếp là unit test; source search bổ sung endpoint MediatR vì static graph không bắt đầy đủ dispatch.
- [graph] `impact(CloudflareR2StorageService, upstream)` báo CRITICAL/106 impacted nhưng output chứa quan hệ nhiễu. Source xác nhận service dùng chung với CV, vì vậy kế hoạch tránh thay đổi hợp đồng generic của service.
- [graph] `api_impact(file=UserEndpoints.cs)` không tìm được route trong index stale. API impact phải chạy lại sau khi re-index trước lúc sửa endpoint; source hiện tại là bằng chứng chính.
- [verified] Direct consumers phải giữ tương thích gồm endpoint upload/get/delete, năm query/profile DTO, `userApi`, `AvatarUpload`, auth store và các unit tests avatar đã tồn tại.

## 5. Statement-Level PDG Findings

- [graph] `pdg_query(mode=controls,target=UploadAvatarCommandHandler)` cho thấy upload ở dòng 61 chi phối ba nhánh URL dòng 75-90, cleanup cũ dòng 95-104, mutation/commit dòng 108-113 và response dòng 117-127.
- [graph] `pdg_query(mode=flows,variable=uploadedKey)` cho thấy cùng `uploadedKey` chảy vào public URL, presigned URL, fallback raw key, log và response. Đây là nguyên nhân một field DB mang ba kiểu giá trị.
- [graph] `pdg_query(mode=controls,target=DeleteAvatarCommandHandler)` cho thấy storage delete dòng 42 xảy ra trước mutation và commit DB dòng 50-54; lỗi storage bị nuốt rồi DB vẫn bị xóa.
- [inferred] Ordering bắt buộc: upload/transform object mới → commit key/version mới và enqueue cleanup cũ trong một transaction → cleanup bất đồng bộ. Nếu commit thất bại, xóa object mới theo cơ chế bù.
- [inferred] DELETE phải clear pointer + enqueue cleanup trong cùng transaction. Không xóa object trước DB vì DB failure sẽ để pointer hỏng.

## 6. Proposed Changes

### 6.1 Data model và migration

- Thêm `AppUser.AvatarObjectKey` (nullable, tối đa phù hợp key R2) và `AvatarUpdatedAt` (nullable UTC); giữ `AvatarUrl` làm legacy trong một release để rolling deploy/backward compatibility. Map `avatar_object_key`, `avatar_updated_at` và tạo migration mới.
- Migration chỉ backfill an toàn các `avatar_url LIKE 'avatars/%'`; absolute legacy URL được resolver đọc fallback, không cố tách key bằng SQL. Upload kế tiếp chuyển user sang model mới và clear `AvatarUrl`.
- Thêm bảng `storage_cleanup_job` với `object_key`, `reason`, `status`, `attempt_count`, `next_attempt_at`, timestamps và unique active key. Chỉ cho phép key namespace `avatars/{userId}/` để job không xóa file CV.

### 6.2 Xử lý ảnh và storage

- Thêm `IAvatarImageProcessor` tại Application và implementation ở Infrastructure dùng một thư viện decode ảnh .NET 8 được pin phiên bản và audit license/CVE khi triển khai (ưu tiên ImageSharp nếu phù hợp giấy phép dự án).
- Chấp nhận JPEG/PNG/WebP tối đa 5 MB; xác thực bằng decode thực tế thay vì extension/MIME; từ chối empty, truncated, ảnh mã hóa sai, SVG/GIF và dữ liệu giả ảnh. Giới hạn dimension/pixel trước full decode để chống decompression bomb.
- Auto-orient, resize giữ tỉ lệ tối đa 1024×1024, bỏ EXIF/metadata và encode canonical WebP chất lượng cấu hình; server tự đặt content type/extension, không dùng giá trị client để tạo key.
- Giữ `IFileStorageService` và `CloudflareR2StorageService` generic; nếu cần cache metadata thì mở rộng bằng options tương thích ngược, không nhúng quy tắc avatar vào service dùng chung.

### 6.3 URL resolver và API contract

- Thêm `IAvatarUrlResolver`: object key/version → canonical avatar URL. URL trả về là `${PUBLIC_API_BASE_URL}/api/v1/users/{id}/avatar?v={avatarUpdatedAtTicks}`; khi thiếu base URL ở local, trả route tương đối và FE chuẩn hóa bằng API base.
- GET `/users/{userId}/avatar` ưu tiên `AvatarObjectKey`, kiểm tra namespace/owner, sau đó redirect 302 tới public CDN URL hoặc presigned URL 5-15 phút. Legacy absolute URL vẫn redirect trong giai đoạn chuyển tiếp. Không ghi presigned URL vào DB/log.
- Upload response chuẩn hóa thành `{ success, message, data: { userId, avatarUrl, updatedAt } }`; bỏ `objectKey`. DELETE trả cùng trạng thái đồng bộ (`avatarUrl: null`, `updatedAt`) để FE cập nhật quyết định.
- Giữ alias POST `/users/avatar` trong một release nhưng delegate cùng một endpoint handler, gắn OpenAPI deprecated và header deprecation/sunset. FE tiếp tục dùng `/users/me/avatar`; xóa alias ở phiên bản API sau.
- Chuẩn hóa status: 400 multipart thiếu, 401 chưa đăng nhập, 403 tài khoản inactive, 404 user/avatar không tồn tại, 413 quá dung lượng, 415 sai loại ảnh, 422 ảnh hỏng/quá kích thước, 503 storage tạm lỗi. Error body theo middleware hiện có, không trả exception/R2 key.

### 6.4 Tính nhất quán và cleanup

- Upload handler: xác thực user active → process ảnh → upload object mới → cập nhật key/version + enqueue cleanup key cũ trong cùng DB transaction → commit. Sau commit worker xóa object cũ và đánh dấu job hoàn tất.
- Nếu upload R2 thất bại, DB không đổi. Nếu DB commit thất bại, xóa object mới ngay; nếu bù cũng thất bại, ghi structured error và enqueue recovery job bằng scope/transaction độc lập.
- DELETE idempotent: không avatar vẫn trả success; nếu có key thì clear key/version/legacy URL và enqueue cleanup cùng commit. Worker retry exponential backoff, có max attempts/dead-letter và log/metric cho job lỗi.
- Worker xác nhận key thuộc `avatars/`, không theo URL tùy ý, không xóa key đang được bất kỳ user nào tham chiếu và dùng optimistic concurrency/idempotency để tránh race upload/delete liên tiếp.

### 6.5 Đồng bộ mọi profile DTO

- Inject resolver vào `GetCurrentUserQueryHandler`, Candidate, Affiliate, Internal HR và Admin profile query handlers; tất cả trả canonical `avatarUrl`, không trả raw DB key.
- Các profile update response đang trả `AvatarUrl` cũng phải đi qua cùng mapper/resolver. Tạo một mapper nhỏ dùng chung để không lặp logic giữa role.

### 6.6 FE production

- `apiClient.ts` export helper `resolveApiAssetUrl` dùng cùng cấu hình API base, hỗ trợ absolute URL và relative `/api/v1/...`, không nối chuỗi hai lần.
- `userApi.ts` cập nhật response type mới, bỏ `objectKey`, chuẩn hóa avatar URL ngay tại boundary và giữ `getAvatarUrl(userId, version?)` làm fallback.
- `AvatarUpload.tsx` dùng preview local trong lúc upload, khóa thao tác đồng thời, hiển thị progress/error thân thiện, revoke object URL, kiểm tra client sớm nhưng vẫn tin kết quả BE. Sau thành công/xóa, refetch current user/profile thay vì chỉ vá một màn hình.
- Auth store có một nguồn avatar canonical; cập nhật mọi shell/profile theo response/refetch để Candidate, Affiliate, Client/HR và Admin đổi cùng lúc. Fallback initials chỉ dùng khi URL null hoặc ảnh load lỗi.
- Gắn cache bust version vào URL; tránh thêm timestamp mới mỗi render. Có retry/fallback khi GET redirect 404/503.

### 6.7 Cấu hình, bảo mật và quan sát

- Sửa precedence R2: biến môi trường flat override section config, section override default. Hỗ trợ/document `R2_PUBLIC_BASE_URL`, `PUBLIC_API_BASE_URL`, avatar max bytes/pixels/dimensions, presigned TTL và worker retry.
- Fail fast ở production nếu thiếu endpoint, bucket, access key hoặc secret. Không hard-code account/bucket thật; `.env.example` chỉ chứa placeholder.
- Object avatar private theo mặc định; GET avatar hiện giữ public-read semantics vì avatar hiển thị ở job/application UI. Upload/delete bắt buộc auth và chỉ tác động current user.
- Log có userId, operationId, object-key hash/jobId và outcome; không log presigned URL, secret hoặc byte ảnh. Thêm counter upload/delete/process/cleanup failure và cleanup backlog.

## 7. Implementation Sequence

1. Tạo nhánh `feature/production-avatar-storage`; re-index GitNexus nếu runner hoạt động, chạy lại impact/API impact và khóa baseline test.
2. Thêm cấu hình avatar/R2, startup validation và dependency xử lý ảnh; viết unit test config/processor trước khi nối endpoint.
3. Thêm `AvatarObjectKey`, `AvatarUpdatedAt`, cleanup job entity/configuration/repository và migration; kiểm tra upgrade/rollback trên PostgreSQL snapshot.
4. Thêm URL resolver + mapper canonical, đổi năm query/profile handlers và profile update responses; giữ legacy fallback.
5. Refactor Upload/Delete handlers theo transaction/compensation/outbox ordering; bỏ `ObjectKey` khỏi public DTO.
6. Thêm cleanup worker có retry/dead-letter, namespace guard và reference check; đăng ký hosted service.
7. Refactor `UserEndpoints` dùng một upload delegate, chuẩn hóa status/OpenAPI, GET redirect ngắn hạn, giữ alias deprecated.
8. Sửa FE asset URL helper, API types, AvatarUpload và auth/profile synchronization; bổ sung loading/error/cache bust.
9. Chạy migration và test cả dữ liệu mới lẫn legacy public/presigned/raw-key; thử R2 thật ở môi trường dev bằng key riêng.
10. Cập nhật `.env.example`, deploy/runbook và tài liệu FE/BE; rollout BE migration-compatible trước, FE sau, theo dõi cleanup backlog; chỉ xóa legacy column/alias ở release kế tiếp.
11. Chạy toàn bộ verification và `detect_changes(scope=all)` trước mỗi commit; commit tách theo migration, BE behavior, FE và docs. Chưa merge nếu contract/integration test chưa đạt.

## 8. Test Strategy

### Backend unit/integration

- Upload validator/processor: file hợp lệ JPEG/PNG/WebP → canonical WebP; extension/MIME spoof, PNG/text, truncated, 0 byte, >5 MB, quá pixel/dimension, SVG/GIF → đúng 413/415/422.
- Upload handler: R2 fail giữ DB; DB fail xóa object mới; replace commit thành công enqueue cleanup cũ sau commit; inactive user 403; legacy URL và raw key được xử lý đúng; response không có object key/presigned URL.
- Delete handler: no-avatar idempotent; clear + job cùng transaction; DB fail không mất pointer; worker delete fail retry; dead-letter; namespace/reference guard.
- Resolver: object key + version, public base, relative local, legacy absolute, null, invalid/foreign key.
- Endpoint integration: auth, multipart limits, status/body/OpenAPI, alias parity/deprecation, GET redirect TTL và 404.
- Migration: schema mới; backfill chỉ `avatars/%`; existing absolute URL còn đọc được; downgrade không làm mất legacy data.

### Frontend

- URL helper: absolute/relative/different API host/trailing slash/version.
- AvatarUpload: preview, success refetch, delete reset, concurrent click disabled, 413/415/422/503 message, image load error → initials, cleanup object URL.
- Auth/profile synchronization: avatar mới xuất hiện ở header và profile của từng role mà không reload; refresh/login vẫn giữ ảnh; delete biến mất toàn hệ thống.

### Verification commands

- `dotnet restore HRConnect/HRConnect.sln`
- `dotnet build HRConnect/HRConnect.sln --configuration Release --no-restore`
- `dotnet test HRConnect/HRConnect.sln --configuration Release --no-build --verbosity normal`
- `cd HRConnect-FE && npm ci`
- `cd HRConnect-FE && npm run lint`
- `cd HRConnect-FE && npm test`
- `cd HRConnect-FE && npm run build`
- EF migration script/idempotent script against disposable PostgreSQL; smoke POST→GET→replace→DELETE qua R2 dev bucket.

## 9. Risk and Impact Analysis

- **Migration/rolling deploy:** BE cũ chỉ biết `avatar_url`; giữ cột legacy và deploy schema-compatible BE trước FE. Không xóa cột trong cùng release.
- **Shared storage:** thay đổi generic R2 service có thể ảnh hưởng CV. Ưu tiên adapter/processor avatar riêng; regression test CV storage bắt buộc nếu sửa interface.
- **Race:** hai upload hoặc upload/delete đồng thời có thể cleanup nhầm object. Dùng transaction/concurrency token, unique key và worker reference check trước delete.
- **Orphan object:** commit/compensation đều có thể fail. Recovery job + metric/backlog và reconciliation runbook là bắt buộc.
- **Cache:** URL user-id không version sẽ giữ ảnh cũ. Version chỉ đổi khi avatar đổi; object key immutable.
- **Security/memory:** decode ảnh không tin cậy có nguy cơ CPU/RAM. Giới hạn request, pixel/dimension, timeout/cancellation và re-encode metadata-free.
- **Privacy:** avatar GET đang công khai. Nếu sản phẩm muốn avatar riêng tư, đây là thay đổi policy cần quyết định trước rollout; mặc định kế hoạch giữ hành vi public hiện tại.
- **Index limitation:** GitNexus stale và API route mapping thiếu; executor phải re-run graph trước edit theo `AGENTS.md` và xác minh text callers nếu risk UNKNOWN.

## 10. Files Expected to Change

| File/area | Symbols | Reason |
| --- | --- | --- |
| `HRConnect.Domain/Entities/AppUser.cs` | `AppUser` | key/version avatar ổn định |
| `HRConnect.Domain/Entities/StorageCleanupJob.cs` (new) | cleanup entity | cleanup bền vững |
| `HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs` + migration | EF mapping | schema/backfill |
| `HRConnect.Application/Common/Models/R2Settings.cs` | avatar settings | giới hạn/TTL/public base |
| `HRConnect.Infrastructure/DependencyInjection.cs` | registrations/config | precedence, validation, worker |
| `HRConnect.Application/.../UploadAvatar/*` | command/validator/handler | contract, processing, transaction |
| `HRConnect.Application/.../DeleteAvatar/*` | command/handler | idempotent delete/outbox |
| `HRConnect.Application/Common/Interfaces/IAvatarImageProcessor.cs` (new) | processor contract | validation/normalization |
| `HRConnect.Application/Common/Interfaces/IAvatarUrlResolver.cs` (new) | resolver contract | canonical URL |
| `HRConnect.Infrastructure/Services/Storage/*Avatar*` (new) | processor/resolver/worker | ImageSharp, URL, cleanup |
| `HRConnect.Presentation/Endpoints/V1/Users/UserEndpoints.cs` | avatar routes | dedupe/status/redirect |
| Auth + Candidate/Affiliate/InternalHr/Admin profile handlers | DTO mapping | không lộ raw key |
| Avatar unit/integration tests | existing + new | failure/race/contract coverage |
| `HRConnect-FE/src/services/apiClient.ts` | asset URL helper | API-host-safe image URLs |
| `HRConnect-FE/src/services/api/userApi.ts` | DTO/client | contract mới |
| `HRConnect-FE/src/components/common/AvatarUpload.tsx` | upload UI | preview/refetch/errors |
| `HRConnect-FE/src/stores/authStore.ts` + tests | avatar state | đồng bộ toàn app |
| `.env.example` + deployment docs | configuration | production setup/runbook |

## 11. Reusable Implementation Context

```json
{
  "implementation_context": {
    "task_summary": "Rebuild BE and FE avatar flow for stable R2 storage, secure image processing, consistent API URLs, reliable cleanup and synchronized UI.",
    "acceptance_criteria": [
      "Database never persists presigned URLs for new uploads",
      "JPEG/PNG/WebP are decoded, bounded, metadata-stripped and stored as canonical WebP",
      "Upload, replace and delete remain consistent across R2 and PostgreSQL failure paths",
      "All auth/profile DTOs expose one canonical avatarUrl and never an object key",
      "Avatar updates immediately across every FE role and survives refresh/deploy",
      "Legacy avatar values remain readable during one compatibility release",
      "Backend and frontend test/build/lint suites pass"
    ],
    "evidence_provenance": 
{
  "schema_version": 2,
  "head_commit": "52bca392c873528b651d5e65106c063fa46f77b9",
  "generated_plan_path": "docs/plans/2026-10-18-gitnexus-plan-production-avatar-storage.md",
  "global_dirty_digest": {
    "algorithm": "sha256",
    "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
    "value": "0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd"
  },
  "cited_path_manifest": [
    {
      "path": ".env.example",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:42fe82c23bdd7c3d2b6eab23e791b0853c41c2e3f055d09093fe7a9f5acdd182",
      "index_digest": "sha256:42fe82c23bdd7c3d2b6eab23e791b0853c41c2e3f055d09093fe7a9f5acdd182",
      "worktree_digest": "sha256:062b5197fb7f1ad3eafb5838d064834779be65df9c1be34bc7a22c0d45347c1e",
      "untracked_digest": "absent"
    },
    {
      "path": ".github/workflows/ci-cd.yml",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:820cf3efe97ea92374e311b56cc0aff5b7aabef4dd5eb95861f2afe3fb8dfe1b",
      "index_digest": "sha256:820cf3efe97ea92374e311b56cc0aff5b7aabef4dd5eb95861f2afe3fb8dfe1b",
      "worktree_digest": "sha256:63e2f57c36d9772073a31d510540c83154c0b64fbb92648b536369e1b92920cf",
      "untracked_digest": "absent"
    },
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
      "untracked_digest": "sha256:8d6bf91756738c63b47d586b3872c7e81e6b21080c124252305981667be4c577"
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
      "head_digest": "sha256:2bc0f7acea84ca7998b6e7801d2174a7b32b2ef43623b26f7bc48b0f0b96b1b0",
      "index_digest": "sha256:2bc0f7acea84ca7998b6e7801d2174a7b32b2ef43623b26f7bc48b0f0b96b1b0",
      "worktree_digest": "sha256:f003e445885ed209baaee3148231f3421cb7589bc3c31ccdfd9143fa82efe764",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect-FE/src/components/common/AvatarUpload.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:6bfbaf9f2c6ec31746bee3203c75fba55dc0c6ec57bed1b95f1c6889fa19d1a8",
      "index_digest": "sha256:6bfbaf9f2c6ec31746bee3203c75fba55dc0c6ec57bed1b95f1c6889fa19d1a8",
      "worktree_digest": "sha256:32db81b63faa1c44a4791d0ba446baaf145e2a1615c32c9e5eeea3480a93d4d5",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect-FE/src/services/api/userApi.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:956a38d5fb10e9413e82bf6f6fdee688e11830b3408eb51e4db305e69b0af942",
      "index_digest": "sha256:956a38d5fb10e9413e82bf6f6fdee688e11830b3408eb51e4db305e69b0af942",
      "worktree_digest": "sha256:69c1c0ab2711ad2f5b2739b9dfa83b4aba073be7337fd7f52f07105f818d467e",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect-FE/src/services/apiClient.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:366a1d48fb35d05ab997a184d253ced3d85e140d721c6be5206c6efc4a719f30",
      "index_digest": "sha256:366a1d48fb35d05ab997a184d253ced3d85e140d721c6be5206c6efc4a719f30",
      "worktree_digest": "sha256:e400dcbc7d1cd724fb7d3c97725b63f72aabdf6b9a9b112a0da2eb7dce06284b",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect-FE/src/stores/authStore.test.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:3e59f28a0cb519cd8f639db8526ff59baf8a0a754904eb18246ff74b5d81efc1",
      "index_digest": "sha256:3e59f28a0cb519cd8f639db8526ff59baf8a0a754904eb18246ff74b5d81efc1",
      "worktree_digest": "sha256:56dd9ca58d22e75a4de9143390297c98f008458d89d9b4c22ac37b673c0a7210",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect-FE/src/stores/authStore.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:07e84b2ec61498239609c7869056970e9641046d386fa409bb966a00167e0c84",
      "index_digest": "sha256:07e84b2ec61498239609c7869056970e9641046d386fa409bb966a00167e0c84",
      "worktree_digest": "sha256:f9b23fe50cb3a75d4ec16e841636baae54073920de6fabc016da2087fef503b6",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Common/Interfaces/IFileStorageService.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:74ddcff38efc76533f776bb812cb9ffaec57c9ec52741eec4f0fc81e6702a9f4",
      "index_digest": "sha256:74ddcff38efc76533f776bb812cb9ffaec57c9ec52741eec4f0fc81e6702a9f4",
      "worktree_digest": "sha256:24fe72e0cd145326922ed26619e9d72fd5b709c9b641997f7b30830f16ce8f78",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Common/Models/R2Settings.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:e99efd4e1df1aa74f1490b496623f572c2a83de434341040049e20cba17667ea",
      "index_digest": "sha256:e99efd4e1df1aa74f1490b496623f572c2a83de434341040049e20cba17667ea",
      "worktree_digest": "sha256:94aa45199f7b21fdfb4f5471e04f8cee5b8e2101e6d5356b985b8f4282e066b8",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Admin/Queries/GetAdminProfile/GetAdminProfileQueryHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:b6e746c85ea8432a9b3979bb2e880e4f5991b6555a42f93f419444971a19fb1c",
      "index_digest": "sha256:b6e746c85ea8432a9b3979bb2e880e4f5991b6555a42f93f419444971a19fb1c",
      "worktree_digest": "sha256:7ab28638608429e706ee17a7a8945519d63eab7007761672a9c1505af3210cff",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Affiliates/Queries/GetAffiliateProfile/GetAffiliateProfileQueryHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:f0974f027289d34ff30f8acdff41d859098147152e84d2a5d2a2ddf5963ac0be",
      "index_digest": "sha256:f0974f027289d34ff30f8acdff41d859098147152e84d2a5d2a2ddf5963ac0be",
      "worktree_digest": "sha256:80e172fd8ae142fee03919ba4b1e65acf76a46d11ee200898dcb804734fe2a23",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Auth/Queries/GetCurrentUser/GetCurrentUserQueryHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:b569ece6c971dac2857ce922b04982b952d95febbb290595dab2dd814b02649b",
      "index_digest": "sha256:b569ece6c971dac2857ce922b04982b952d95febbb290595dab2dd814b02649b",
      "worktree_digest": "sha256:46f26a9165d7950dbf79887d48604cea97c843ae45c27c6996b185986d0a0a75",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateProfile/GetCandidateProfileQueryHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:c4d3ec91bf401bbf36eb0574aba843306af14fc597a0bb366f2a4ceb85d56e47",
      "index_digest": "sha256:c4d3ec91bf401bbf36eb0574aba843306af14fc597a0bb366f2a4ceb85d56e47",
      "worktree_digest": "sha256:a00993a81424b66118eeac692b52994524c229ce5f1f7cfd49b4f0018ad5135f",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/InternalHr/Queries/GetInternalHrProfile/GetInternalHrProfileQueryHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:96e792e4031c536aef3a0077bc3c5b5a0ae531c8d37b17373f79cfda57162fe8",
      "index_digest": "sha256:96e792e4031c536aef3a0077bc3c5b5a0ae531c8d37b17373f79cfda57162fe8",
      "worktree_digest": "sha256:d7059ece444535d78b1b3ac22b3344121700717a5dda56eeb89971c81beab595",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Users/Commands/DeleteAvatar/DeleteAvatarCommandHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:b1ddef36aa427a88c6cc850024d0d8bd1dc353ea2b9740db698944b10556ec65",
      "index_digest": "sha256:b1ddef36aa427a88c6cc850024d0d8bd1dc353ea2b9740db698944b10556ec65",
      "worktree_digest": "sha256:b3b76d5f6576008c7e464319b561a800c4ead8bff234fcfc7174ffcd191c8539",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Users/Commands/UploadAvatar/UploadAvatarCommand.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:f777d7d132a55b09d693838621665ad45c430e4e73aea36b38d8eb5eae61a8eb",
      "index_digest": "sha256:f777d7d132a55b09d693838621665ad45c430e4e73aea36b38d8eb5eae61a8eb",
      "worktree_digest": "sha256:b0ef7c3c2d989a26003e65282ac539ce76e5423ed406284ba1e9df90ed774eff",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Users/Commands/UploadAvatar/UploadAvatarCommandHandler.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:4b70c28c67c71b78de716447e871dce4ad598ba19178e5d2ac064c2f6af51ee2",
      "index_digest": "sha256:4b70c28c67c71b78de716447e871dce4ad598ba19178e5d2ac064c2f6af51ee2",
      "worktree_digest": "sha256:3bce1ae2c7186929d2cd68b39801a4e16c97aea54c1ec3ab79bd8b7891680bb7",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Users/Commands/UploadAvatar/UploadAvatarCommandValidator.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:59885c99224b214afecd2e1da1fcd050e011d94032f41682f67186c6e5b15318",
      "index_digest": "sha256:59885c99224b214afecd2e1da1fcd050e011d94032f41682f67186c6e5b15318",
      "worktree_digest": "sha256:1e535bf2a1e5b7e49f4eecb31ae9287d114bfd7c4c9f22c92868dfe0cf12d12e",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Application/HRConnect.Application.csproj",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:f5d9196ee38b33cdcc9303787cb8e297b79458c2a33d48f0608f478807ddb8e1",
      "index_digest": "sha256:f5d9196ee38b33cdcc9303787cb8e297b79458c2a33d48f0608f478807ddb8e1",
      "worktree_digest": "sha256:7d24a9300a97eeae10f8757412702579e80f8a6584ad2cfd8fb9c8b7bf71ae7b",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Domain/Entities/AppUser.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:fa1d852d3a406a1458bd50187d09dcf88157244ccdc25b5bd24c968c6acbb08d",
      "index_digest": "sha256:fa1d852d3a406a1458bd50187d09dcf88157244ccdc25b5bd24c968c6acbb08d",
      "worktree_digest": "sha256:427b287550f8a1bba087f252f4772637c961d18a883174ca42fddb9635deeff9",
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
      "head_digest": "sha256:34c6ea5f895549b5b9593ec82b53713623d006df861287b7e617ba338730fa80",
      "index_digest": "sha256:34c6ea5f895549b5b9593ec82b53713623d006df861287b7e617ba338730fa80",
      "worktree_digest": "sha256:fa52806e4d25b71946cdd9d30ac1a2220e800865ba1f076702be6ac73f0fde9a",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/HRConnect.Infrastructure.csproj",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:0fa247702a74e491146eaa3c6e862cfce871dc177ac1674db121a3477361ceab",
      "index_digest": "sha256:0fa247702a74e491146eaa3c6e862cfce871dc177ac1674db121a3477361ceab",
      "worktree_digest": "sha256:f3cb971e7fac15216492cbcb75764450ff332d61168a111ba300ddb5ea3d3a99",
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
      "head_digest": "sha256:360a5a2974c51f8527ca43c8fdc89d7e833e966a959926ec1f084bf36fdf3ecb",
      "index_digest": "sha256:360a5a2974c51f8527ca43c8fdc89d7e833e966a959926ec1f084bf36fdf3ecb",
      "worktree_digest": "sha256:dfb9af11713f1ea664d7a30d7219e2888efed49869400263ff9ce5d5812a597b",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/Services/Storage/CloudflareR2StorageService.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:da635d753e98f5afabc88a6f367e946d3084e6b48857394e3a139dfdafc4d350",
      "index_digest": "sha256:da635d753e98f5afabc88a6f367e946d3084e6b48857394e3a139dfdafc4d350",
      "worktree_digest": "sha256:370458cb7b262fd989f8ec8d97b5100fbc47ccc33c9dd38030123fbf2d5729d0",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.Presentation/Endpoints/V1/Users/UserEndpoints.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:2800517409fa28f64bfd1d27e2d5b1e02f81cf667b1700598cb9247b4dbd4759",
      "index_digest": "sha256:2800517409fa28f64bfd1d27e2d5b1e02f81cf667b1700598cb9247b4dbd4759",
      "worktree_digest": "sha256:e962199df6e77cfc868c47adc708e993cc10298ac297d455b11a1d0776d5282a",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.UnitTests/Features/Users/DeleteAvatarCommandHandlerTests.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:552859944c71fe5669e44e286fb580c9b1013dcbfb59836ec324037caff90a81",
      "index_digest": "sha256:552859944c71fe5669e44e286fb580c9b1013dcbfb59836ec324037caff90a81",
      "worktree_digest": "sha256:3cebb7def6f8a00dae7ae8d11f18f4474aa7dedebef7f1ed5f85385f99cfe261",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.UnitTests/Features/Users/UploadAvatarCommandHandlerTests.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:0e6434268d24bf22be39bbf3f058a85d0648f536a64ce14327a544fe9ae348ac",
      "index_digest": "sha256:0e6434268d24bf22be39bbf3f058a85d0648f536a64ce14327a544fe9ae348ac",
      "worktree_digest": "sha256:a7678b2dff1321e053422d904a2d5447a9e649df419f665a70e6474d93268eb7",
      "untracked_digest": "absent"
    },
    {
      "path": "HRConnect/HRConnect.UnitTests/Features/Users/UploadAvatarCommandValidatorTests.cs",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:06fc7e88ab43d01a94e35efe1fec193038dbb2286e8c74e24f32c77268ce6fb4",
      "index_digest": "sha256:06fc7e88ab43d01a94e35efe1fec193038dbb2286e8c74e24f32c77268ce6fb4",
      "worktree_digest": "sha256:9f6571be20d7363d6db5ba23f8a152069548904c3451e061b60bea9fc15c70a4",
      "untracked_digest": "absent"
    }
  ]
},
    "primary_symbols": [
      {"symbol":"UploadAvatarCommandHandler.Handle","file":"HRConnect/HRConnect.Application/Features/Users/Commands/UploadAvatar/UploadAvatarCommandHandler.cs","lines":"33-128","role":"Orchestrates upload, URL persistence, replacement cleanup and response"},
      {"symbol":"DeleteAvatarCommandHandler.Handle","file":"HRConnect/HRConnect.Application/Features/Users/Commands/DeleteAvatar/DeleteAvatarCommandHandler.cs","lines":"28-62","role":"Deletes stored avatar and clears user state"},
      {"symbol":"UserEndpoints.MapUserEndpoints","file":"HRConnect/HRConnect.Presentation/Endpoints/V1/Users/UserEndpoints.cs","lines":"18-257","role":"HTTP upload/get/delete contract"},
      {"symbol":"AvatarUpload","file":"HRConnect-FE/src/components/common/AvatarUpload.tsx","lines":"18-159","role":"Shared FE upload/delete and preview component"},
      {"symbol":"AppUser","file":"HRConnect/HRConnect.Domain/Entities/AppUser.cs","lines":"1-40","role":"Persistent avatar ownership metadata"}
    ],
    "related_symbols": [
      {"symbol":"CloudflareR2StorageService","relationship":"implements IFileStorageService","relevance":"Shared R2 primitive; avoid avatar-specific coupling and CV regressions"},
      {"symbol":"UploadAvatarCommandValidator","relationship":"validates upload command","relevance":"Currently trusts extension/MIME and must be supplemented by decode validation"},
      {"symbol":"GetCurrentUserQueryHandler","relationship":"reads AppUser.AvatarUrl","relevance":"Central auth DTO consumer"},
      {"symbol":"GetCandidateProfileQueryHandler/GetAffiliateProfileQueryHandler/GetInternalHrProfileQueryHandler/GetAdminProfileQueryHandler","relationship":"read AppUser.AvatarUrl","relevance":"Role profile consumers requiring canonical resolver"},
      {"symbol":"userApi","relationship":"calls avatar endpoints","relevance":"FE contract boundary"},
      {"symbol":"authStore","relationship":"holds displayed avatar","relevance":"Cross-shell synchronization"}
    ],
    "execution_path": [
      "Authenticate current user and enforce ACTIVE status",
      "Bound request size, decode real image bytes, normalize to metadata-free WebP",
      "Upload immutable object under avatars/{userId}/{uuid}.webp",
      "Commit AvatarObjectKey/AvatarUpdatedAt and old-key cleanup job atomically",
      "Return canonical versioned API avatar URL without storage key",
      "FE resolves the URL against API base, refetches current user/profile and updates all shells",
      "Cleanup worker safely deletes replaced/deleted objects with retry and reference guard"
    ],
    "pdg_constraints": [
      {"description":"uploadedKey currently feeds three URL representations and DB state","affected_statements":["UploadAvatarCommandHandler.cs:61","UploadAvatarCommandHandler.cs:75-90","UploadAvatarCommandHandler.cs:108-125"],"implementation_consequence":"Persist only the object key; URL generation moves to resolver"},
      {"description":"old object deletion currently precedes DB commit","affected_statements":["UploadAvatarCommandHandler.cs:95-113"],"implementation_consequence":"Commit new pointer and cleanup job before asynchronous deletion"},
      {"description":"DELETE storage side effect currently precedes DB mutation","affected_statements":["DeleteAvatarCommandHandler.cs:37-54"],"implementation_consequence":"Clear pointer plus enqueue cleanup atomically; worker deletes later"}
    ],
    "architectural_patterns": [
      {"pattern":"MediatR command handlers behind Minimal API endpoints","example_location":"HRConnect/HRConnect.Presentation/Endpoints/V1/Users/UserEndpoints.cs","usage_guidance":"Keep HTTP parsing/status mapping in Presentation and business orchestration in Application"},
      {"pattern":"Generic S3-compatible storage abstraction","example_location":"HRConnect/HRConnect.Application/Common/Interfaces/IFileStorageService.cs","usage_guidance":"Keep avatar validation and normalization in a dedicated adapter"},
      {"pattern":"BackgroundService workers registered in Infrastructure DI","example_location":"HRConnect/HRConnect.Infrastructure/DependencyInjection.cs:129-137","usage_guidance":"Use the same lifecycle pattern for durable cleanup processing"},
      {"pattern":"Central Axios API base","example_location":"HRConnect-FE/src/services/apiClient.ts:12-29","usage_guidance":"Derive image asset host from the same environment config"}
    ],
    "files_to_modify": [
      {"file":"HRConnect/HRConnect.Domain/Entities/AppUser.cs","symbols":["AppUser"],"intended_change":"Add stable avatar key/version while retaining legacy URL temporarily"},
      {"file":"HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs","symbols":["OnModelCreating"],"intended_change":"Map avatar and cleanup job columns"},
      {"file":"HRConnect/HRConnect.Infrastructure/Migrations/<timestamp>_ProductionAvatarStorage.cs","symbols":["Up","Down"],"intended_change":"Add schema and safe raw-key backfill"},
      {"file":"HRConnect/HRConnect.Application/Features/Users/Commands/UploadAvatar/UploadAvatarCommandHandler.cs","symbols":["Handle"],"intended_change":"Process, upload, transactionally switch pointer and compensate failures"},
      {"file":"HRConnect/HRConnect.Application/Features/Users/Commands/DeleteAvatar/DeleteAvatarCommandHandler.cs","symbols":["Handle"],"intended_change":"Idempotent pointer clear and durable cleanup enqueue"},
      {"file":"HRConnect/HRConnect.Presentation/Endpoints/V1/Users/UserEndpoints.cs","symbols":["MapUserEndpoints"],"intended_change":"Dedupe endpoint logic and standardize HTTP contract"},
      {"file":"HRConnect/HRConnect.Infrastructure/DependencyInjection.cs","symbols":["AddInfrastructure"],"intended_change":"Register options validation, resolver, processor and cleanup worker"},
      {"file":"HRConnect-FE/src/services/apiClient.ts","symbols":["API_BASE_URL","resolveApiAssetUrl"],"intended_change":"Resolve avatar routes against API host"},
      {"file":"HRConnect-FE/src/services/api/userApi.ts","symbols":["userApi","UploadAvatarData"],"intended_change":"Adopt production response and remove object key"},
      {"file":"HRConnect-FE/src/components/common/AvatarUpload.tsx","symbols":["AvatarUpload"],"intended_change":"Preview, progress, refetch, error and lifecycle handling"},
      {"file":"HRConnect-FE/src/stores/authStore.ts","symbols":["useAuthStore"],"intended_change":"Keep one canonical avatar state across roles"}
    ],
    "tests": [
      {"file":"HRConnect/HRConnect.UnitTests/Features/Users/UploadAvatarCommandValidatorTests.cs","scenarios":["spoofed/truncated/oversized/over-dimension input -> reject","valid JPEG/PNG/WebP -> normalized result"]},
      {"file":"HRConnect/HRConnect.UnitTests/Features/Users/UploadAvatarCommandHandlerTests.cs","scenarios":["storage failure -> DB unchanged","DB failure -> new object compensated","replace -> cleanup job after commit","response -> no internal key"]},
      {"file":"HRConnect/HRConnect.UnitTests/Features/Users/DeleteAvatarCommandHandlerTests.cs","scenarios":["no avatar -> idempotent success","delete -> clear plus job atomically","cleanup retry/dead-letter/reference guard"]},
      {"file":"HRConnect/HRConnect.IntegrationTests/Users/AvatarEndpointsTests.cs","scenarios":["auth and multipart status mapping","upload/get/replace/delete","legacy redirect","alias parity/deprecation"]},
      {"file":"HRConnect-FE/src/services/api/userApi.test.ts","scenarios":["absolute and relative API avatar URLs","new response shape"]},
      {"file":"HRConnect-FE/src/components/common/AvatarUpload.test.tsx","scenarios":["preview/success/refetch/delete","server error messages","load error fallback and object URL cleanup"]},
      {"file":"HRConnect-FE/src/stores/authStore.test.ts","scenarios":["avatar survives auth refresh","avatar removal synchronizes all consumers"]}
    ],
    "verification_commands": [
      "dotnet restore HRConnect/HRConnect.sln",
      "dotnet build HRConnect/HRConnect.sln --configuration Release --no-restore",
      "dotnet test HRConnect/HRConnect.sln --configuration Release --no-build --verbosity normal",
      "cd HRConnect-FE && npm ci",
      "cd HRConnect-FE && npm run lint",
      "cd HRConnect-FE && npm test",
      "cd HRConnect-FE && npm run build",
      "node .gitnexus/run.cjs detect-changes --scope all --repo ."
    ],
    "risks": [
      "Rolling deployment against old avatar_url contract",
      "Shared R2 abstraction regressions in CV storage",
      "Concurrent upload/delete cleanup race",
      "Orphan objects after compound infrastructure failure",
      "Image decode CPU/memory abuse",
      "Stale GitNexus route/caller evidence"
    ],
    "assumptions": [
      "Avatar viewing remains public; verify product policy and current GET authorization before implementation",
      "R2 credentials permit Put/Get/Delete and the configured bucket supports avatar objects; verify with dev smoke test",
      "Legacy avatar_url remains for one compatibility release; verify deployment order with team",
      "ImageSharp licensing is acceptable for this project; verify license and current security advisories before pinning package"
    ],
    "open_questions": [],
    "avoid": [
      "Do not repeat full repository discovery",
      "Do not replace established patterns without evidence",
      "Do not persist public or presigned URLs for new avatars",
      "Do not expose storage object keys to FE",
      "Do not delete an old object before the DB switch is durable",
      "Do not put avatar-specific rules into the CV-shared storage service",
      "Do not remove legacy avatar_url or the alias endpoint in the first rollout"
    ]
  }
}
```

## 12. Assumptions and Open Questions

### Assumptions

- [assumed] Avatar là dữ liệu public-read như GET hiện tại; upload/delete vẫn private/current-user. Executor kiểm tra authorization metadata trước khi giữ policy này.
- [assumed] Nhóm chấp nhận giữ `avatar_url` và alias upload trong một release để rollout không downtime; xác nhận release order trước migration cleanup.
- [assumed] Giấy phép ImageSharp phù hợp dự án học thuật/triển khai này; executor kiểm tra license và CVE của version sẽ pin. Nếu không phù hợp, chọn decoder managed tương đương nhưng giữ nguyên contract/limits/tests.
- [assumed] Dev R2 bucket có quyền Put/Get/Delete; smoke test bằng credential riêng, không dùng production key trong local logs.

### Open questions

Không có câu hỏi chặn implementation. Quyết định mặc định là avatar public-read, R2 private, presigned redirect ngắn hạn và một release tương thích legacy. Nếu product đổi privacy policy, cập nhật GET authorization và cache policy trước rollout.

### Deferred follow-up

- Sau một release ổn định và backfill/metrics chứng minh không còn legacy rows: migration xóa `avatar_url`, xóa POST alias và cleanup code fallback.
- Reconciliation định kỳ toàn bucket để tìm orphan ngoài cleanup queue có thể làm ở phase vận hành kế tiếp; không chặn API production nếu queue/recovery metrics hoạt động.

## 13. Definition of Done

- Database của upload mới chỉ lưu `AvatarObjectKey` và `AvatarUpdatedAt`; không lưu presigned/public URL.
- Upload hợp lệ từ mọi role hiển thị ngay ở header/profile, tồn tại sau refresh/relogin/deploy; delete biến mất đồng nhất.
- File giả mạo, hỏng, quá dung lượng/dimension bị chặn với status/message xác định; ảnh hợp lệ được normalize metadata-free.
- Replace/delete không làm DB trỏ object đã mất; cleanup retry được, có dead-letter/log/metric và không đụng key CV.
- GET avatar hoạt động với object key mới và legacy values, URL versioned không giữ ảnh cũ, presigned TTL ngắn và không lộ trong DB/log.
- Alias upload có cùng behavior với endpoint chuẩn và được đánh dấu deprecated; `ObjectKey` không còn trong public response.
- Migration được kiểm thử trên PostgreSQL với dữ liệu raw key, absolute legacy URL và null; rollout/downgrade runbook hoàn chỉnh.
- Unit, integration, FE tests, lint và Release build đều pass; R2 dev smoke POST→GET→replace→DELETE pass.
- GitNexus impact được chạy lại trước edit và `detect_changes(scope=all)` sạch/được review trước commit theo `AGENTS.md`.
