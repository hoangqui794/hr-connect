# HR Connect

[![CI — Quality Gates](https://github.com/hoangqui794/hr-connect/actions/workflows/ci.yml/badge.svg)](https://github.com/hoangqui794/hr-connect/actions/workflows/ci.yml)
[![CD — Cloud Server](https://github.com/hoangqui794/hr-connect/actions/workflows/deploy-cloud.yml/badge.svg?branch=main)](https://github.com/hoangqui794/hr-connect/actions/workflows/deploy-cloud.yml)

**AI-Powered Recruitment & Affiliate Headhunting Platform**

HR Connect là nền tảng tuyển dụng đa mô hình dành cho Agency, kết nối Doanh nghiệp đối tác (**Client Company**), Ứng viên (**Candidate**), Đội ngũ Tuyển dụng nội bộ (**Internal HR**), Quản trị viên (**Platform Admin**) và Mạng lưới Cộng tác viên (**Affiliate**). Hệ thống tự động hóa xuyên suốt từ khâu đăng tin, ký kết hợp đồng dịch vụ thương mại, tiếp nhận & xác nhận Consent ứng viên 48 giờ, chống trùng lặp danh tính 2 lớp, chấm điểm & hậu kiểm bằng chứng bằng AI (`ai-service-v2` với trọng số động), điều phối phỏng vấn – Offer – nhận việc – đối soát độc lập, đến thanh toán **VNPay**, bảo hành 30 ngày, suất tuyển thay thế miễn phí và quyết toán chi trả hoa hồng.

> **Dự án Capstone — SEP490, Đại học FPT**  
> **Trạng thái:** Hoàn thiện toàn luồng MF-01 → MF-05 (Production-Ready, Blue/Green Deployed)  
> **Giảng viên hướng dẫn:** Thầy Phạm Minh Trí  

## Tài liệu dự án (Single Source of Truth)

- **[Đặc tả Kiến trúc Hệ thống Toàn diện (`docs/architecture.md`)](docs/architecture.md)**
- **[Đặc tả Luồng Nghiệp vụ End-to-End & Sequence Diagrams (`HRConnect/docs/main-flows.md`)](HRConnect/docs/main-flows.md)**
- [Mục lục tài liệu chung (`docs/README.md`)](docs/README.md)
- [Bản đồ API & Đường đi code Backend (`HRConnect/docs/BACKEND-FLOWS-AND-API-GUIDE.md`)](HRConnect/docs/BACKEND-FLOWS-AND-API-GUIDE.md)
- [Tài liệu Đặc tả chuyên sâu MF-01 → MF-05 (`HRConnect/docs/README.md`)](HRConnect/docs/README.md)
  - [MF-01 — Quản lý Tin tuyển dụng, Hợp đồng dịch vụ & Đặt cọc](HRConnect/docs/MF01/README.md)
  - [MF-02 — Ứng tuyển, CV Builder, Affiliate Consent, Attribution & Chống trùng 2 lớp](HRConnect/docs/MF02/README.md)
  - [MF-03 — AI Matching (Dynamic Weights), Tiền sàng lọc, Giao CV Sourcing & Gợi ý việc làm](HRConnect/docs/MF03/README.md)
  - [MF-04 — Phỏng vấn, Offer, Nhận việc (`Placement`) & Đối soát độc lập](HRConnect/docs/MF04/README.md)
  - [MF-05 — Phí dịch vụ, VNPay, Bảo hành, Suất thay thế, Hoa hồng, Khiếu nại & Payout](HRConnect/docs/MF05/README.md)
- [Tài liệu AI Service v2 (`ai-service-v2/README.md`)](ai-service-v2/README.md)
- [Tài liệu Frontend (`HRConnect-FE/docs/README.md`)](HRConnect-FE/docs/README.md)

---

## 👥 Nhóm Thực Hiện (Team Members)

| STT | Thành viên | Mã sinh viên | Vai trò | Trách nhiệm chính |
|:---:|---|:---:|:---:|---|
| 1 | **Trương Hoàng Quí** | SE184355 | **Leader** | Quản lý dự án, Phân tích nghiệp vụ, Database, AI Integration |
| 2 | **Lê Thị Trà Mi** | SE184379 | **Member** | Phân tích nghiệp vụ, Backend Developer, Frontend Developer |
| 3 | **Cao Hữu Trí** | SE184047 | **Member** | Phân tích nghiệp vụ, Backend Developer, Thiết kế kiến trúc Backend, Database, DevOps & CI/CD |
| 4 | **Khúc Ngọc Sơn** | SE184040 | **Member** | Phân tích nghiệp vụ, Backend Developer, Frontend Developer |
| 5 | **Nguyễn Văn Sang** | SE183276 | **Member** | Frontend Developer, UI/UX Designer |

---

## 1. Mục Tiêu & Ba Mô Hình Dịch Vụ Cốt Lõi

### 1.1. Mục tiêu dự án
- Tập trung hóa toàn bộ quy trình tuyển dụng của Doanh nghiệp, Ứng viên, Affiliate và Agency trên một nền tảng duy nhất.
- Ứng dụng microservice **`ai-service-v2`** (kết hợp Multi-Provider LLM Google Gemini / OpenAI / Anthropic và Sentence-BERT) để chấm điểm CV – JD tất định (deterministic), hậu kiểm câu trích dẫn chống ảo giác (`verification.py`), cho phép Admin tinh chỉnh trọng số động ngay trên giao diện hệ thống và gợi ý việc làm tự động.
- Bảo vệ quyền ghi nhận nguồn giới thiệu (**First-Confirmed Attribution**) qua cơ chế **Candidate Consent** 48 giờ và hệ thống phát hiện – hợp nhất hồ sơ nghi trùng 2 lớp (**Email/SĐT chuẩn hóa** + **SHA-256 CV & HMAC-SHA256 Họ tên**).
- Tự động hóa hợp đồng thương mại điện tử (ký OTP hoặc tải bản PDF ký ướt kiểm tra SHA-256), cổng thanh toán **VNPay**, đối soát nhận việc độc lập, bảo hành 30 ngày, mở suất tuyển thay thế miễn phí (**Replacement Slot**) và quyết toán hoa hồng (**Commission & Payout**).

### 1.2. Ba mô hình dịch vụ tuyển dụng (`ServiceType`)

| Mã dịch vụ | Tên dịch vụ | Nguồn hồ sơ | Người sàng lọc | Cơ chế Phí, Bảo hành & Hoa hồng |
|---|---|---|---|---|
| **`HEADHUNT_COD`** | **Tuyển dụng trọn gói (Contingency Headhunt)** | **Affiliate** giới thiệu (bắt buộc Candidate `CONFIRMED` Consent) | **Internal HR** tiền sàng lọc; che thông tin liên hệ với Client tới khi `PLACED` | Ký `ServiceAgreement`. Thu phí `BaseSalary × FeeMultiplier` khi ứng viên đi làm (`PLACED`) và qua đối soát (`CONFIRMED`). Bảo hành **30 ngày** (nghỉ sớm được mở tối đa **1 Suất thay thế** miễn phí). Affiliate nhận **100% hoa hồng** khi qua 30 ngày bảo hành và phí đã `PAID`. |
| **`CV_SOURCING`** | **Tìm kiếm & Cung cấp CV đạt chuẩn** | **Affiliate** giới thiệu (bắt buộc Candidate `CONFIRMED` Consent) | **Internal HR** tiền sàng lọc & bàn giao CV (`SourcingDelivery`) theo `SourcingTarget` | Ký `ServiceAgreement`, thu tiền cọc (`DEPOSIT`) trước khi mở Job. Client có `ReviewDays` để chấp nhận/từ chối CV (quá hạn tự động `AUTO_ACCEPTED`). Mỗi CV đạt chuẩn sinh ngay hoa hồng `EARNED` cho Affiliate; cuối kỳ quyết toán thu thêm (`SETTLEMENT`) hoặc hoàn cọc dư (`CREDIT`). |
| **`CV_APPLICATION`** | **Đăng tin & Tiếp nhận ứng tuyển trực tiếp** | **Candidate** tự nộp trực tiếp | **Client Company** trực tiếp sàng lọc | Chọn gói đăng tin (`PostingPackage`: `FREE` có giới hạn hoặc trả phí `STANDARD`). AI vẫn tự động chấm điểm hỗ trợ Client; không qua bước Consent của Affiliate, không phát sinh phí tuyển thành công hay hoa hồng. |

---

## 2. Các Vai Trò Người Dùng (Actor & Roles)

Hệ thống quản lý 5 vai trò (`Role`) chuẩn hóa cùng ma trận **74+ quyền hạn (`Permission`)** có thể phân quyền động:

| Role Code | Tên vai trò | Trách nhiệm thực tế trong hệ thống |
|---|---|---|
| `PLATFORM_ADMIN` | **Quản trị viên nền tảng** | Phê duyệt đăng ký Doanh nghiệp/Affiliate, quản lý người dùng & RBAC động, cấu hình 37 tham số nghiệp vụ & trọng số AI (`BusinessSettings`), đối chiếu yêu cầu khôi phục email & hợp nhất hồ sơ nghi trùng (`CandidateDuplicateCases`), xử lý tranh chấp (`Disputes`), ghi nhận thu phí/hoàn tiền, duyệt hoa hồng, chi trả `Payout` và giám sát Audit Trail / Báo cáo. |
| `INTERNAL_HR` | **Chuyên viên tuyển dụng Agency** | Duyệt tin tuyển dụng, thương lượng & phát hành `ServiceAgreement`, quản lý thư viện mẫu JD (`JobTemplates`), tiền sàng lọc hồ sơ `HEADHUNT_COD` & `CV_SOURCING` (kèm ghi chú nhận xét gửi Client), bàn giao & thẩm định từ chối CV Sourcing, đối soát nhận việc (`PlacementReconciliation`), điều chỉnh ngày đi làm trong 7 ngày và xác minh báo nghỉ bảo hành / hủy suất thay thế. |
| `CLIENT_COMPANY_USER` | **Khách hàng Doanh nghiệp** | Tạo và quản lý Job, ký `ServiceAgreement` (OTP hoặc tải PDF ký ướt), thanh toán phí đăng tin/đặt cọc/phí dịch vụ qua VNPay, nghiệm thu CV Sourcing, điều phối toàn bộ quy trình tuyển dụng từ `SHORTLISTED` theo thanh tiến trình 5 bước (Phỏng vấn đa vòng, Offer hợp nhất & lịch sử điều chỉnh, Xác nhận đi làm `PLACED`), báo nghỉ bảo hành và gửi yêu cầu hủy suất thay thế. |
| `AFFILIATE` | **Cộng tác viên tuyển dụng** | Xem Job `HEADHUNT_COD` & `CV_SOURCING` kèm ước tính hoa hồng minh bạch, giới thiệu ứng viên mới hoặc tái sử dụng từ Kho CV (khi ứng viên cấp quyền), gửi lại email Consent, theo dõi tiến độ giới thiệu, gửi khiếu nại Attribution và quản lý hoa hồng / lịch sử Payout. |
| `CANDIDATE` | **Ứng viên** | Quản lý hồ sơ cá nhân, xác thực email phụ để liên kết hồ sơ cũ, tải CV PDF hoặc tạo CV bằng **CV Builder**, bật/tắt quyền cho phép Affiliate tái sử dụng CV đối tác gửi kèm, nhận gợi ý việc làm AI, tự ứng tuyển `CV_APPLICATION`, phản hồi Consent (`CONFIRM`, `DECLINE`, `REPORT_UNAUTHORIZED`), xác nhận lịch phỏng vấn và phản hồi Offer. |

---

## 3. Kiến Trúc Hệ Thống & Công Nghệ Thực Tế

Chi tiết đầy đủ xem tại [`docs/architecture.md`](docs/architecture.md).

- **Backend (`HRConnect/`):** **.NET 8 Minimal API** theo chuẩn **Clean Architecture** + **CQRS (`MediatR` 14.2)**, **FluentValidation**, **EF Core 8 + PostgreSQL (`Npgsql`)**, **SignalR** (`/hubs/notifications`), **Cloudflare R2** (`AWSSDK.S3`), **SkiaSharp + PdfPig** (render PDF cho CV Builder, Hợp đồng dịch vụ & CV ẩn danh có nhúng font tiếng Việt), **VNPay Gateway** và **11 Hosted Background Workers**.
- **AI Service (`ai-service-v2/`):** Microservice **Python FastAPI**, kết hợp **Multi-Provider LLM** (`google-genai` Gemini, `openai`, `anthropic`) + **Sentence-BERT** (`sentence-transformers`) + **`PyMuPDF`**, hàng đợi bền vững trên đĩa hỗ trợ Blue/Green deployment và nhận trọng số động từ Backend.
- **Frontend (`HRConnect-FE/`):** **React 18 + TypeScript + Vite**, **Tailwind CSS**, **Ant Design 5**, **TanStack React Query v5**, **Zustand**, **SignalR Client** và **`motion/react`**.
- **Hạ tầng Triển khai (`deploy/`):** Docker Compose đa môi trường, **Caddy Reverse Proxy** và script **Blue/Green Zero-Downtime Deployment** (`deploy-production.sh`) tự động kiểm tra `/health/live`, `/health/ready`, `/health` và tự động rollback khi sự cố.

---

## 4. Cấu Hình Biến Môi Trường (`.env`)

### 4.1. Backend (`HRConnect/.env` — mẫu đầy đủ tại [`HRConnect/.env.example`](HRConnect/.env.example))

```env
ASPNETCORE_ENVIRONMENT=Development

# 1. PostgreSQL Connection
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=HRConnect;Username=postgres;Password=your_secure_password;SearchPath=public

# 2. JWT & CORS
JwtSettings__Secret=REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_BYTES
JwtSettings__Issuer=HRConnect
JwtSettings__Audience=HRConnectApp
JwtSettings__ExpiryMinutes=60
Cors__AllowedOrigins__0=http://localhost:5173

# 3. Email (Resend) & Candidate Consent URL
Resend__ApiKey=your_resend_api_key
Resend__FromEmail=no-reply@hrconnectvn.online
Resend__FromName=HR Connect
SUBMISSION_CONSENT_URL_BASE=http://localhost:5173/submission-consent

# 4. Cloudflare R2 Object Storage
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
PUBLIC_API_BASE_URL=https://api.example.com

# 5. VNPay Online Payment
VNPAY_TMN_CODE=your_vnpay_tmn_code
VNPAY_HASH_SECRET=your_vnpay_hash_secret
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:5173/client/billing/vnpay-return
VNPAY_EXPIRE_MINUTES=15

# 6. MF-03 AI Service v2 Integration
MF03_BASE_URL=http://127.0.0.1:8001
HRCONNECT_SERVICE_TOKEN=your_shared_internal_service_token
Mf03Integration__MaxDispatchAttempts=5
Mf03Integration__InitialRetryDelaySeconds=30
Mf03Integration__MaxRetryDelaySeconds=900

# 7. Cross-Profile Candidate Duplicate Detection (SHA-256 CV + HMAC-SHA256 Name)
CANDIDATE_IDENTITY_DEDUP_ENABLED=true
CANDIDATE_IDENTITY_DEDUP_SHADOW_MODE=false
CANDIDATE_IDENTITY_HMAC_KEY_VERSION=v1
CANDIDATE_IDENTITY_HMAC_KEY=REPLACE_WITH_BASE64_32_BYTE_KEY
```

> [!CAUTION]
> Tuyệt đối không commit file `.env` chứa khóa thật lên GitHub. Ở môi trường Production, `ProductionConfigurationValidator` sẽ kiểm tra fail-fast toàn bộ biến bắt buộc trước khi mở cổng nhận traffic, và Database Migration được chạy độc lập qua cờ `--migrate`.

---

## 5. Hướng Dẫn Khởi Chạy & Kiểm Thử Tự Động

### 5.1. Khởi chạy Local
```bash
# 1. Backend (.NET 8 — tự động chạy Migration & DatabaseSeeder ở Development)
dotnet restore HRConnect/HRConnect.sln
dotnet run --project HRConnect/HRConnect.Presentation

# 2. AI Service v2 (Python FastAPI — cổng 8001 khớp với MF03_BASE_URL)
cd ai-service-v2
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# 3. Frontend (React + Vite — cổng 5173)
cd ../HRConnect-FE
npm install
npm run dev
```

### 5.2. Chạy Kiểm Thử Tự Động (Quality Gates)
```bash
# Backend Unit & Repository Tests
dotnet test HRConnect/HRConnect.sln

# Frontend Lint, Typecheck, Build & Vitest
cd HRConnect-FE
npm run lint
npm run build
npx vitest run

# AI Service v2 Pytest
cd ../ai-service-v2
pytest -q
```

---

## 6. Bản Đồ Nhóm API Endpoints Thực Tế (`/api/v1/*`)

| Phân hệ | Nhóm Route thực tế trong `HRConnect.Presentation` | Mô tả chức năng |
|---|---|---|
| **Auth & Identity** | `/api/v1/auth/*`, `/api/v1/candidates/me/email-identities/*`, `/api/v1/candidates/me/identity-claims/*` | Đăng ký 3 luồng, xác thực OTP, Login/Refresh Cookie, đổi/quên mật khẩu, xác thực email phụ & yêu cầu khôi phục hồ sơ cũ. |
| **MF-01 — Jobs & Agreements** | `/api/v1/jobs/*`, `/api/v1/public/jobs/*`, `/api/v1/internal/jobs/*`, `/api/v1/job-templates/*` | CRUD Job, mẫu JD, duyệt/từ chối Job, thương lượng & ký `ServiceAgreement` (OTP hoặc tải PDF ký ướt), phí gói đăng tin & đặt cọc Sourcing. |
| **MF-02 — CVs, Submissions & Duplicates** | `/api/v1/candidates/cv/*`, `/api/v1/candidates/me/affiliate-cvs/*`, `/api/v1/jobs/{jobId}/apply`, `/api/v1/jobs/{jobId}/candidate-submissions`, `/api/v1/submission-consents/*`, `/api/v1/admin/candidate-duplicate-cases/*` | Upload PDF, CV Builder, bật/tắt quyền tái sử dụng CV đối tác, tự ứng tuyển, Affiliate giới thiệu, phản hồi Consent 48h, Attribution & hợp nhất ca nghi trùng danh tính. |
| **MF-03 — AI Screening & Sourcing** | `/api/v1/jobs/{jobId}/applications/*`, `/api/v1/recruitment/applications/*`, `/api/v1/jobs/{jobId}/sourcing/deliveries/*`, `/api/v1/candidates/me/job-matches/*`, `/api/v1/internal/ai-results` | Callback & retry chấm điểm AI, tiền sàng lọc (kèm ghi chú nhận xét HR), CV ẩn danh (`cv/masked`), bàn giao/nghiệm thu/thay thế CV Sourcing & gợi ý việc làm. |
| **MF-04 — Interviews, Offers & Placements** | `/api/v1/recruitment/applications/{id}/interviews`, `/api/v1/interviews/*`, `/api/v1/offers/*`, `/api/v1/placements/*`, `/api/v1/internal-hr/placement-reconciliations/*`, `/api/v1/admin/placement-reconciliations/*` | Phỏng vấn đa vòng, quyết định hồ sơ dự phòng (`BACKUP`), Offer phiên bản hóa, xác nhận đi làm (`PLACED`), sửa ngày đi làm & đối soát nhận việc độc lập. |
| **MF-05 — Finance, VNPay, Warranty & Payouts** | `/api/v1/service-fees/*`, `/api/v1/payments/vnpay/*`, `/api/v1/warranties/*`, `/api/v1/replacement-slots/*`, `/api/v1/client/replacement-slots/*`, `/api/v1/commissions/*`, `/api/v1/payouts/*`, `/api/v1/disputes/*` | Công nợ & tổng hợp KPI phí, thanh toán VNPay (IPN & Return), bảo hành 30 ngày, báo nghỉ, mở/yêu cầu hủy/hủy suất thay thế, quyết toán Sourcing, khiếu nại Attribution & chi trả Payout. |
| **Admin Console & Reports** | `/api/v1/admin/*`, `/api/v1/admin/authorization/*`, `/api/v1/admin/settings/*`, `/api/v1/reports/*` | Phê duyệt Doanh nghiệp/Affiliate, quản lý User & RBAC, cấu hình động `BusinessSettings` (bao gồm trọng số AI), Audit Trail, Dashboard Metrics & Báo cáo doanh thu. |

---

## 7. Quy Trình Git Flow & CI/CD Pipeline

```text
 feat|fix|docs/xxx ──► Push & Chờ CI xanh ──► Merge vào dev & Chờ CI xanh ──► Merge vào main
                                                                                    │
                                                                                    ▼
                                                                           CD — Cloud Server
                                                                 (GHCR Build + Blue/Green Switch + Rollback)
```

1. Luôn phát triển trên nhánh riêng (`feat/...`, `fix/...`, `docs/...`), chạy GitNexus `impact` trước khi sửa symbol và `detect-changes --scope all` trước khi commit.
2. Không tự ý `git push` hoặc merge vào `dev` / `main` khi chưa qua đầy đủ kiểm thử và quy trình nhánh bảo vệ.
