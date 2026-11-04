# GitNexus Deep Plan — Production Runtime Hardening

**Ngày lập:** 04/11/2026  
**Nhánh thực hiện:** `feature/production-hardening`  
**Phạm vi:** Backend .NET, AI service v2, frontend React, Docker/Caddy, CI/CD  
**Mục tiêu:** loại bỏ các điểm yếu khiến production có thể khởi động sai cấu hình, lộ refresh token, mất job AI khi redeploy, gián đoạn khi phát hành và thiếu bằng chứng chất lượng.

## 1. Executive summary

Kế hoạch này xử lý tám nhóm vấn đề theo thứ tự rủi ro: cấu hình bảo mật và migration trước; phiên đăng nhập; giới hạn upload; độ bền hàng đợi AI; blue-green; quality gates; sau cùng là vòng import và kích thước bundle.

Kết quả mong muốn:

- Production không thể khởi động với JWT secret mẫu, URL nội bộ sai hoặc thiếu secret bắt buộc.
- Refresh token chỉ tồn tại trong cookie `HttpOnly + Secure`, không còn trong `localStorage` hay JSON response.
- File tải lên AI được đọc theo luồng và bị chặn ở cả Caddy lẫn ứng dụng.
- Migration chạy như một bước phát hành độc lập trước khi chuyển traffic.
- Bản mới được dựng ở màu không hoạt động, kiểm tra xong mới chuyển Caddy; lỗi thì giữ nguyên bản cũ.
- Job AI đã nhận không mất khi container bị thay.
- CI có kiểm tra lỗ hổng, coverage threshold, E2E smoke và bundle budget.
- Hai vòng import FE hiện có được loại bỏ bằng cách tách contract/hook dùng chung.

## 2. Baseline và bằng chứng hiện trạng

### 2.1 Bảo mật cấu hình

- `HRConnect/HRConnect.Presentation/Program.cs:254` có fallback JWT secret mẫu; production vẫn có thể khởi động nếu biến môi trường thiếu. `[source]`
- `HRConnect/HRConnect.Presentation/Program.cs:425-450` tự động chạy `MigrateAsync()` và seed trong startup web. `[source]`
- `HRConnect/HRConnect.Presentation/Endpoints/V1/Auth/AuthEndpoints.cs` trả refresh token từ login/refresh qua JSON và nhận refresh token từ request body. `[source]`
- `HRConnect-FE/src/services/authTokenStorage.ts` lưu refresh token trong `localStorage`. `[source]`

### 2.2 AI và upload

- `ai-service-v2/app/main.py:87-104` dùng `await file.read()` trước khi kiểm tra kích thước, nên request lớn có thể chiếm RAM trước lúc bị từ chối. `[source]`
- `ai-service-v2/app/scoring_jobs.py` đã có file-backed pending queue và phục hồi khi startup. `[source]`
- `deploy/compose.prod.yml` chưa mount `.data` của AI ra ổ lưu bền vững, nên file queue mất khi thay container. `[source]`

### 2.3 Phát hành

- `deploy/scripts/deploy-production.sh` hiện thay stack đang chạy bằng `docker compose up -d`; chỉ health-check sau khi thay. Đây là rolling replacement một máy, chưa phải blue-green. `[source]`
- `deploy/compose.prod.yml` khóa container name và host port cố định, chưa thể chạy đồng thời hai màu. `[source]`

### 2.4 CI và frontend

- `.github/workflows/ci.yml` đã build/test nhưng chưa có gate vulnerability, coverage threshold, E2E smoke hoặc image scan. `[source]`
- `HRConnect-FE/vite.config.ts` chưa chia vendor chunks và chưa có bundle budget. `[source]`
- GitNexus `check(cycles:true)` ngày 04/11/2026 tìm thấy **2 vòng import trong 1 component**:
  - `CandidatePages.tsx ↔ JobHuntingModeWidget.tsx`
  - `CandidatePages.tsx ↔ useCandidateAppliedJobs.ts` `[graph]`

## 3. Phạm vi và ngoài phạm vi

### Trong phạm vi

1. Fail-fast JWT và validator cấu hình production.
2. Refresh token cookie HttpOnly cho login, refresh, logout.
3. Streaming upload + request body limits.
4. Migration command/job độc lập.
5. Blue-green thật trên một Cloud Server với Caddy.
6. Persistent AI queue trên host volume.
7. Security scan, coverage, E2E smoke, bundle budget.
8. Xóa hai vòng import đã được GitNexus xác nhận.

### Ngoài phạm vi

- Đổi nhà cung cấp database, storage hay LLM.
- Kubernetes hoặc nhiều server.
- Thay toàn bộ access token sang BFF/session cookie.
- Thiết kế lại nghiệp vụ tuyển dụng hoặc schema ngoài nhu cầu migration runner.

## 4. Kiến trúc đích

```text
Browser
  ├─ access token: bộ nhớ/local storage hiện hành (giảm phạm vi thay đổi)
  └─ refresh token: Secure + HttpOnly + SameSite cookie
            │
            ▼
         Caddy :443
       ┌────┴─────────────┐
       │ active color      │
       │ blue hoặc green   │
       └────┬──────────────┘
            │
   Backend + AI v2 cùng màu
            │
   ┌────────┴─────────┐
   │ PostgreSQL        │
   │ AI queue host dir │
   └───────────────────┘

Release: pull image → migrate job → start inactive color → health/smoke
         → atomic Caddy switch → observe → stop old color → cleanup
```

## 5. Workstream A — Production configuration fail-fast

### A1. Tạo validator tập trung

**File dự kiến:**

- `HRConnect/HRConnect.Presentation/Configuration/ProductionConfigurationValidator.cs` (mới)
- `HRConnect/HRConnect.Presentation/Program.cs`
- `HRConnect/HRConnect.UnitTests/Configuration/ProductionConfigurationValidatorTests.cs` (mới)

**Thay đổi:**

- Bắt buộc `JwtSettings:Secret`, issuer, audience, connection string, service token, public URLs và VNPAY secrets khi environment là Production.
- JWT secret tối thiểu 32 bytes, không được trùng mẫu/dev placeholder.
- URL public bắt buộc HTTPS; URL service-to-service trong Docker được phép HTTP với hostname nội bộ.
- Không log giá trị secret; lỗi chỉ nêu tên key.
- Xóa fallback secret khỏi `Program.cs`; Development/Testing dùng user-secrets hoặc test configuration rõ ràng.

**Acceptance:** production thiếu/placeholder secret thoát mã khác 0 trước khi bind cổng; test bao phủ missing, placeholder, URL sai và cấu hình hợp lệ.

### A2. AI service validation

**File:** `ai-service-v2/app/config.py`, test cấu hình mới.

- Khi endpoint production được mở, bắt buộc service token và key của provider đang dùng.
- Giới hạn số worker/queue/upload phải dương và trong ngưỡng an toàn.
- Không ép provider phụ phải có key nếu không được cấu hình dùng.

## 6. Workstream B — Refresh token HttpOnly cookie

### B1. Backend contract

**File:**

- `AuthEndpoints.cs`
- helper cookie mới trong `Presentation/Endpoints/V1/Auth`
- response DTO login/refresh
- auth endpoint tests và handler tests liên quan

**Thiết kế:**

- Cookie: tên `hrconnect_refresh`, `HttpOnly`, `Secure` ở Production, `SameSite=Strict`, `Path=/api/v1/auth`, expiry khớp refresh token.
- Login và refresh ghi cookie mới; JSON chỉ trả access token, thời hạn và user.
- Refresh đọc cookie, không nhận token từ body.
- Logout đọc cookie, thu hồi token và luôn xóa cookie; logout-all cũng xóa cookie hiện tại.
- Rotation/reuse detection hiện có giữ nguyên.
- CORS chỉ cho origin cấu hình và bật credentials; không dùng wildcard khi credentials bật.

**Tương thích phát hành:** backend có thể tạm chấp nhận body token trong một release chuyển tiếp chỉ ở Development/Testing; Production chỉ cookie. Sau khi FE phát hành ổn, xóa đường tương thích.

### B2. Frontend

**File:**

- `HRConnect-FE/src/services/apiClient.ts`
- `authService.ts`
- `authTokenStorage.ts`
- generated auth types/tests

- Axios bật `withCredentials` cho API.
- Xóa key và mọi read/write refresh token trong localStorage.
- Refresh gọi body rỗng; logout không gửi refresh token.
- Dọn refresh token cũ trong lần bootstrap đầu để không để sót dữ liệu nhạy cảm.

**Acceptance:** login đặt cookie nhưng JS không đọc được; refresh hoạt động sau reload; logout xóa cookie; localStorage không còn refresh token; test rotation/reuse/logout vẫn đạt.

## 7. Workstream C — Upload limits theo nhiều lớp

### C1. AI streaming

**File:** `ai-service-v2/app/main.py`, helper/test upload.

- Đọc `UploadFile` theo chunk 64–256 KiB vào `bytearray` hoặc `SpooledTemporaryFile`.
- Ngắt ngay khi vượt `MAX_UPLOAD_SIZE_MB`; luôn đóng file.
- Kiểm tra `Content-Length` sớm nếu có, nhưng không tin nó là kiểm tra duy nhất.
- Giữ response 413 nhất quán.

### C2. Caddy

**File mới:** `deploy/caddy/Caddyfile`, template upstream active.

- `request_body max_size` cho AI route/file endpoints và backend upload endpoints.
- Trả 413 rõ ràng; health, webhook và request JSON nhỏ không bị ảnh hưởng.
- Không đặt một giới hạn toàn domain làm hỏng upload CV hợp lệ.

**Acceptance:** file đúng ngưỡng đạt; vượt ngưỡng bị chặn ở proxy hoặc app; RSS không tăng tương ứng toàn bộ file lớn.

## 8. Workstream D — Migration tách khỏi web startup

**File dự kiến:**

- `Program.cs`
- `HRConnect.Presentation/Database/DatabaseMigrationRunner.cs` (mới)
- `Dockerfile`/compose/deploy script

**Thiết kế:**

- Normal web startup không gọi migration trong Production.
- Thêm command rõ ràng, ví dụ `dotnet HRConnect.Presentation.dll --migrate`, dùng cùng image và env.
- Deploy chạy migration job một lần trước khi bật màu mới.
- Seeder demo không chạy trong production; seed reference data phải idempotent và tách khỏi demo accounts.
- Migration lỗi dừng release trước khi chuyển traffic.

**Quy tắc schema:** migration production phải backward-compatible trong cửa sổ blue-green (expand trước, contract ở release sau).

## 9. Workstream E — Blue-green deployment thật

### E1. Compose hai màu

**File:**

- `deploy/compose.prod.yml`
- `deploy/scripts/deploy-production.sh`
- script helper/test deploy
- tài liệu vận hành

**Thiết kế:**

- Bỏ `container_name` cố định.
- Mỗi màu dùng project name và port riêng:
  - blue backend/AI: `18080/18001`
  - green backend/AI: `28080/28001`
- Dùng cùng env và persistent AI data; chỉ một worker color nhận job sau switch. Màu inactive khởi động với worker disabled hoặc không nhận dispatch đến khi active.
- File trạng thái `/opt/hrconnect/deploy/state/active-color` xác định màu active.

### E2. Quy trình switch

1. Lấy image SHA bất biến.
2. Chạy migration one-shot.
3. Dựng màu inactive.
4. Health + readiness + smoke API trực tiếp vào port inactive.
5. Sinh upstream Caddy tạm, validate, rồi replace atomically và reload.
6. Kiểm tra public health qua HTTPS.
7. Chờ drain ngắn; dừng màu cũ.
8. Ghi state/release metadata và cleanup image có giới hạn.

**Rollback:** nếu lỗi trước switch, xóa inactive; nếu lỗi sau switch, trỏ Caddy lại màu cũ còn sống. Không rollback migration phá hủy; dùng expand/contract.

**Acceptance:** deploy không có cửa sổ 502; health fail không đổi active color; script test chứng minh switch/rollback/idempotency.

## 10. Workstream F — Persistent AI queue

**File:** `deploy/compose.prod.yml`, `scoring_jobs.py`, tests.

- Mount `/opt/hrconnect/deploy/data/ai-v2:/app/.data` với quyền đúng.
- Ghi queue atomically bằng temp file + fsync + rename để tránh JSON dở khi mất điện.
- Một request ID chỉ ở một trạng thái pending; callback thành công mới xóa.
- Khi blue-green: khóa/activation bảo đảm không có hai worker xử lý cùng file queue.
- Thêm test restart, file hỏng, duplicate enqueue và callback retry.

## 11. Workstream G — CI quality and security gates

### G1. Dependency và image security

**File:** `.github/workflows/ci.yml` hoặc workflow security riêng.

- `.NET`: `dotnet list package --vulnerable --include-transitive` và fail High/Critical.
- Node: `npm audit --omit=dev --audit-level=high`.
- Python: `pip-audit` trên requirements khóa.
- Trivy scan filesystem/image, fail High/Critical với allowlist có ngày hết hạn.
- GITHUB_TOKEN permissions tối thiểu; action pin theo major/commit theo chính sách nhóm.

### G2. Coverage thresholds

- Backend dùng coverlet report + threshold ban đầu lấy từ baseline đo thật; không đặt số giả gây đỏ vô nghĩa.
- FE cài coverage provider, threshold theo lines/functions/branches/statements.
- AI chạy `pytest-cov` với threshold.
- Mỗi threshold chỉ tăng; giảm cần thay đổi có giải trình trong PR.

### G3. E2E smoke

- Playwright Chromium desktop chạy tối thiểu: guest jobs, login, refresh-cookie, route protected và logout.
- CI dựng FE + backend test profile hoặc mock contract ổn định; lưu trace/screenshot khi fail.
- E2E là required gate sau unit/integration, tránh tốn thời gian khi build cơ bản đã fail.

## 12. Workstream H — Circular imports và bundle

### H1. Dọn vòng import

**File:**

- `CandidatePages.tsx`
- `candidate/JobHuntingModeWidget.tsx`
- `candidate/useCandidateAppliedJobs.ts`
- module contract/helper mới nếu cần

**Thiết kế:** tách type/constants/selectors dùng chung ra module leaf không import page; component/hook không import ngược barrel/page.

**Acceptance:** GitNexus `check(cycles:true)` trả `no_cycles`; test candidate pages đạt.

### H2. Bundle optimization

- Vite manual chunks cho React/router/query/AntD; lazy-load theo portal/role và trang nặng.
- Thêm bundle report và budget cho entry/chunk; CI fail khi vượt budget có chủ đích.
- Không chia quá nhỏ làm tăng request; đo gzip/brotli và route first-load trước/sau.

## 13. Thứ tự triển khai, kiểm thử và rollback

| Phase | Nội dung | Gate bắt buộc | Rollback |
|---|---|---|---|
| 1 | Validator production + migration runner | unit tests, startup negative tests | revert code; chưa đổi traffic |
| 2 | Refresh cookie BE/FE | auth integration + FE tests | release chuyển tiếp body fallback ngoài Production |
| 3 | Streaming upload + Caddy limits | boundary/413 tests | restore Caddy backup |
| 4 | Persistent queue | restart/corruption tests | giữ queue file, chạy image cũ |
| 5 | Blue-green | deploy script tests + staging smoke | atomic switch về màu cũ |
| 6 | Security/E2E/coverage gates | workflow syntax + local equivalent | gate mới có baseline/allowlist rõ ràng |
| 7 | Cycles/bundle | GitNexus check, FE build/test, budget | revert module split/manual chunks |

### Test matrix cuối

- `dotnet test HRConnect/HRConnect.sln -c Release`
- `npm run lint`, `npm test`, `npm run build`, E2E smoke.
- `python -m pytest` cho AI v2.
- Validate compose/Caddy/deploy scripts.
- GitNexus `detect_changes` trước từng commit và `check(cycles:true)` ở phase cuối.
- Smoke public: `/health/live`, `/health/ready`, login/refresh/logout, AI `/health`, upload boundary.

### Commit dự kiến

1. `docs(plan): production runtime hardening`
2. `fix(config): fail fast and separate migrations`
3. `feat(auth): protect refresh token with http-only cookie`
4. `fix(ai): stream uploads and persist scoring queue`
5. `feat(deploy): add zero-downtime blue-green release`
6. `ci: enforce security e2e coverage and bundle gates`
7. `refactor(fe): remove portal cycles and split heavy bundles`

### Rủi ro chính

- **Cookie/CORS sai** có thể làm mọi phiên hết hạn: test cross-origin credentials trước rollout.
- **Migration không tương thích** làm hai màu không cùng chạy: bắt buộc expand/contract.
- **Hai AI worker cùng xử lý** tạo callback trùng: inactive color không nhận job và queue có idempotency.
- **Gate CI quá gắt** làm tắc nhóm: lấy baseline thật, chỉ fail High/Critical và đặt allowlist có hạn.
- **30 GB disk** đầy do hai màu/image: cleanup sau switch, giữ tối đa active + previous và cảnh báo ngưỡng.

## Evidence ledger

- `[graph]` GitNexus index tại commit `0b48327db829c64dc53400a42a473ff6c7eb34b7`; cycle check complete, 2 cycles/1 component.
- `[source]` Các file được đọc trực tiếp từ working tree sạch trên `main` trước khi tạo nhánh.
- Trước mọi edit symbol/API sẽ chạy GitNexus `impact`/`api_impact`; trước commit chạy `detect_changes` theo `AGENTS.md`.
