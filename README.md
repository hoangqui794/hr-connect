# HR Connect

[![CI — Quality Gates](https://github.com/hoangqui794/hr-connect/actions/workflows/ci.yml/badge.svg)](https://github.com/hoangqui794/hr-connect/actions/workflows/ci.yml)
[![CD — Cloud Server](https://github.com/hoangqui794/hr-connect/actions/workflows/deploy-cloud.yml/badge.svg?branch=main)](https://github.com/hoangqui794/hr-connect/actions/workflows/deploy-cloud.yml)

**AI-Powered Recruitment & Affiliate Headhunting Platform**

HR Connect là nền tảng tuyển dụng hiện đại dành cho Agency, kết nối Doanh nghiệp đối tác (**Client Company**), Ứng viên (**Candidate**), Đội ngũ Tuyển dụng nội bộ (**Internal HR**), Quản trị viên (**Platform Admin**) và Mạng lưới Cộng tác viên (**Affiliate**). Hệ thống tự động hóa xuyên suốt từ khâu đăng tin, ký kết hợp đồng dịch vụ thương mại, tiếp nhận & xác nhận Consent ứng viên, chống trùng lặp danh tính, chấm điểm & hậu kiểm bằng chứng bằng AI (`ai-service-v2`), điều phối phỏng vấn – Offer – nhận việc, đến đối soát công nợ, thanh toán VNPay, bảo hành 30 ngày, suất tuyển thay thế và chi trả hoa hồng.

> **Dự án Capstone — SEP490, Đại học FPT**  
> **Trạng thái:** Hoàn thiện toàn luồng MF-01 → MF-05 (Production-Ready)  
> **Giảng viên hướng dẫn:** Thầy Phạm Minh Trí  

## Tài liệu dự án

- [Mục lục tài liệu chung](docs/README.md)
- [Tài liệu Backend & Đặc tả MF-01 → MF-05](HRConnect/docs/README.md)
  - [MF-01 — Quản lý Tin tuyển dụng, Hợp đồng dịch vụ & Đặt cọc](HRConnect/docs/MF01/README.md)
  - [MF-02 — Ứng tuyển, CV Builder, Affiliate Consent, Attribution & Chống trùng](HRConnect/docs/MF02/README.md)
  - [MF-03 — AI Matching, Tiền sàng lọc, Giao CV Sourcing & Gợi ý việc làm](HRConnect/docs/MF03/README.md)
  - [MF-04 — Phỏng vấn, Offer, Nhận việc (Placement) & Đối soát độc lập](HRConnect/docs/MF04/README.md)
  - [MF-05 — Phí dịch vụ, VNPay, Bảo hành, Suất thay thế, Hoa hồng & Payout](HRConnect/docs/MF05/README.md)
- [Tài liệu Frontend](HRConnect-FE/docs/README.md)
- [Tài liệu AI Service v2](ai-service-v2/README.md)

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

## 📑 Mục Lục
1. [Mục Tiêu & Ba Mô Hình Dịch Vụ Cốt Lõi](#1-mục-tiêu--ba-mô-hình-dịch-vụ-cốt-lõi)
2. [Các Vai Trò Người Dùng (Actor & Roles)](#2-các-vai-trò-người-dùng-actor--roles)
3. [Kiến Trúc Hệ Thống (Clean Architecture + CQRS + AI Microservice)](#3-kiến-trúc-hệ-thống-clean-architecture--cqrs--ai-microservice)
4. [Tổng Quan 5 Luồng Nghiệp Vụ Chính (MF-01 → MF-05) & Luồng Bổ Trợ](#4-tổng-quan-5-luồng-nghiệp-vụ-chính-mf-01--mf-05--luồng-bổ-trợ)
5. [Cơ Chế Tự Động Hóa Database (Auto Migration & Seeder)](#5-cơ-chế-tự-động-hóa-database-auto-migration--seeder)
6. [Chi Tiết Toàn Bộ File Cấu Hình (Configuration Deep-Dive)](#6-chi-tiết-toàn-bộ-file-cấu-hình-configuration-deep-dive)
7. [Hướng Dẫn Khởi Chạy Nhanh (Getting Started)](#7-hướng-dẫn-khởi-chạy-nhanh-getting-started)
8. [Quy Chuẩn Code Dành Cho Lập Trình Viên & AI Agent](#8-quy-chuẩn-code-dành-cho-lập-trình-viên--ai-agent)
9. [Bản Đồ API Endpoints Theo Phân Hệ](#9-bản-đồ-api-endpoints-theo-phân-hệ)
10. [Quy Trình Git Flow & CI/CD Pipeline](#10-quy-trình-git-flow--cicd-pipeline)

---

## 1. Mục Tiêu & Ba Mô Hình Dịch Vụ Cốt Lõi

### 1.1. Mục tiêu dự án
- Tập trung hóa toàn bộ quy trình tuyển dụng của Doanh nghiệp, Ứng viên, Affiliate và Agency trên một nền tảng duy nhất.
- Ứng dụng mô hình AI (`ai-service-v2` kết hợp LLM & Sentence-BERT) để chấm điểm độ phù hợp CV – JD, trích xuất bằng chứng kèm hậu kiểm chống ảo giác (Hallucination Verification) và gợi ý việc làm tự động.
- Minh bạch hóa quyền sở hữu nguồn giới thiệu (**Attribution**) thông qua cơ chế **Candidate Consent** qua email/in-app và hệ thống phát hiện – hợp nhất hồ sơ nghi trùng (**Candidate Duplicate Cases**).
- Tự động hóa hợp đồng thương mại điện tử (ký OTP / ký ướt), cổng thanh toán **VNPay**, đối soát nhận việc, theo dõi bảo hành 30 ngày, mở suất tuyển thay thế miễn phí (**Replacement Slot**) và quyết toán hoa hồng (**Commission & Payout**).

### 1.2. Ba mô hình dịch vụ tuyển dụng (`ServiceType`)

| Mã dịch vụ | Tên dịch vụ | Nguồn hồ sơ | Người sàng lọc | Cơ chế Phí, Bảo hành & Hoa hồng |
|---|---|---|---|---|
| **`HEADHUNT_COD`** | **Tuyển dụng trọn gói (Contingency Headhunt)** | **Affiliate** giới thiệu (bắt buộc Candidate `CONFIRMED` Consent) | **Internal HR** tiền sàng lọc; Client che thông tin liên hệ tới khi `PLACED` | Ký `ServiceAgreement`. Thu phí `BaseSalary × FeeMultiplier` khi ứng viên đi làm (`PLACED`) và qua đối soát. Bảo hành **30 ngày** (nghỉ sớm được đổi **1 Suất thay thế** miễn phí). Affiliate nhận **100% hoa hồng** khi qua 30 ngày bảo hành và phí đã `PAID`. |
| **`CV_SOURCING`** | **Tìm kiếm & Cung cấp CV đạt chuẩn** | **Affiliate** giới thiệu (bắt buộc Candidate `CONFIRMED` Consent) | **Internal HR** tiền sàng lọc & bàn giao CV (`SourcingDelivery`) theo `SourcingTarget` | Ký `ServiceAgreement`, đóng cọc (`DEPOSIT`) trước khi mở Job. Client có `ReviewDays` để chấp nhận/từ chối CV (quá hạn tự động `AUTO_ACCEPTED`). Mỗi CV được chấp nhận sinh ngay hoa hồng `EARNED` cho Affiliate; cuối kỳ quyết toán thu thêm (`SETTLEMENT`) hoặc hoàn cọc dư (`CREDIT`). |
| **`CV_APPLICATION`** | **Đăng tin & Tiếp nhận ứng tuyển trực tiếp** | **Candidate** tự nộp trực tiếp | **Client Company** trực tiếp sàng lọc | Mua gói đăng tin (`PostingPackage`: `FREE` có giới hạn hoặc trả phí `STANDARD`). Không qua bước Consent của Affiliate, không phát sinh phí tuyển dụng thành công hay hoa hồng. |

---

## 2. Các Vai Trò Người Dùng (Actor & Roles)

Hệ thống quản lý 5 nhóm vai trò (`Role`) chuẩn hóa cùng ma trận hơn **72+ quyền hạn (`Permission`)** chi tiết:

| Role Code | Tên vai trò | Mô tả quyền hạn thực tế trong hệ thống |
|---|---|---|
| `PLATFORM_ADMIN` | **Quản trị viên nền tảng** | Phê duyệt đăng ký Doanh nghiệp/Affiliate, quản lý người dùng & RBAC, cấu hình tham số nghiệp vụ động (`BusinessSettings`), xử lý ca nghi trùng danh tính (`CandidateDuplicateCases`), giải quyết khiếu nại (`Disputes`), ghi nhận thu phí/hoàn tiền, duyệt hoa hồng, tạo đợt chi trả (`Payouts`) và theo dõi Dashboard phân tích dòng tiền. |
| `INTERNAL_HR` | **Chuyên viên tuyển dụng Agency** | Duyệt Job, thương lượng & phát hành Hợp đồng dịch vụ (`ServiceAgreement`), quản lý thư viện mẫu JD (`JobTemplates`), tiền sàng lọc hồ sơ `HEADHUNT_COD` & `CV_SOURCING`, bàn giao & xác minh từ chối CV Sourcing, đối soát độc lập kết quả nhận việc (`PlacementReconciliation`) và xác minh báo nghỉ trong bảo hành. |
| `CLIENT_COMPANY_USER` | **Khách hàng Doanh nghiệp** | Tạo và quản lý Job, ký Hợp đồng dịch vụ (OTP hoặc tải bản ký ướt), thanh toán phí đăng tin/đặt cọc/phí dịch vụ qua VNPay, nghiệm thu CV Sourcing, và **trực tiếp sở hữu toàn bộ quyết định tuyển dụng từ `SHORTLISTED` trở đi** (Phỏng vấn, Offer, Xác nhận đi làm `PLACED`, Báo nghỉ bảo hành). |
| `AFFILIATE` | **Cộng tác viên tuyển dụng** | Khám phá các Job `HEADHUNT_COD` & `CV_SOURCING`, giới thiệu ứng viên mới hoặc tái sử dụng từ Kho CV Affiliate (khi được Candidate cho phép), gửi lại email Consent, theo dõi tiến độ giới thiệu đã che thông tin nhạy cảm, gửi khiếu nại Attribution và quản lý hoa hồng / lịch sử Payout. |
| `CANDIDATE` | **Ứng viên** | Quản lý hồ sơ cá nhân & tính năng liên kết danh tính, tải CV PDF hoặc tạo CV bằng **CV Builder**, nhận gợi ý việc làm AI, tự ứng tuyển vào Job `CV_APPLICATION`, xác nhận/từ chối/báo cáo giả mạo đối với lời giới thiệu của Affiliate (`SubmissionConsent`), xác nhận lịch phỏng vấn và phản hồi Offer. |

---

## 3. Kiến Trúc Hệ Thống (Clean Architecture + CQRS + AI Microservice)

Dự án được xây dựng theo kiến trúc đa tầng hiện đại:
- **Backend (`HRConnect/`):** **.NET 8 Minimal API** theo chuẩn **Clean Architecture (Onion)** kết hợp **CQRS (`MediatR`)**, **FluentValidation**, **EF Core 8 + PostgreSQL (`Npgsql`)**, **SignalR** (Realtime Notification Hub), **Cloudflare R2** (lưu trữ CV PDF & hợp đồng), **QuestPDF** (render CV Builder & hợp đồng PDF) và **VNPay Gateway**.
- **AI Service (`ai-service-v2/`):** Microservice **Python FastAPI** độc lập, kết hợp **Google Gemini** và **Sentence-BERT**, thực hiện phân tích CV – JD, trích xuất bằng chứng kèm bộ hậu kiểm văn bản (`verification.py`) và tính điểm gợi ý việc làm ngữ nghĩa.
- **Frontend (`HRConnect-FE/`):** **React 18 + TypeScript + Vite**, sử dụng **Tailwind CSS**, **Ant Design**, **TanStack React Query**, **Zustand**, **SignalR Client** và hệ thống chuyển động **`motion/react`** theo tiêu chuẩn thiết kế **`unslop`**.

### 3.1. Sơ đồ phụ thuộc Backend (Dependency Diagram)

```text
       ┌─────────────────────────────────────────┐
       │         HRConnect.Presentation          │  (Minimal APIs / SignalR Hub / Middlewares / Auth)
       └──────────────┬──────────────────────────┘
                      │ phụ thuộc
       ┌──────────────▼─────────────┐   ┌───────────────────────────┐
       │   HRConnect.Infrastructure │   │   HRConnect.Application   │ (MediatR CQRS, Validators, Policies)
       └──────────────┬─────────────┘   └─────────────┬─────────────┘
                      │ phụ thuộc                     │ phụ thuộc
       ┌──────────────▼───────────────────────────────▼─────────────┐
       │                      HRConnect.Domain                      │ (Entities, Constants, Value Objects)
       └────────────────────────────────────────────────────────────┘
```

### 3.2. Cấu trúc thư mục toàn dự án

```text
d:/Ki_9/HRConnect/
├── .github/workflows/
│   ├── ci.yml                        # CI — Quality Gates (BE Test + FE Lint/Test/Build + AI v2 Pytest + Docker)
│   └── deploy-cloud.yml              # CD — Cloud Server (Build GHCR Image + Health Check + Auto Rollback)
├── docs/                             # Tài liệu kiến trúc, Sơ đồ (.mmd/.svg), Kế hoạch & Database
├── ai-service-v2/                    # [AI MICROSERVICE] Python FastAPI + Gemini + Sentence-BERT
│   ├── app/                          # Pipeline chấm điểm, hậu kiểm bằng chứng (verification.py), semantic match
│   └── tests/                        # Bộ kiểm thử tự động pytest cho AI Service
├── HRConnect-FE/                     # [FRONTEND] React 18 + TypeScript + Vite + Tailwind + Antd + Motion
│   ├── src/
│   │   ├── app/                      # Router, AppShell, Providers
│   │   ├── components/               # Role Shells (Admin, HR, Client, Affiliate, Candidate), Motion primitives
│   │   ├── features/                 # Các phân hệ: admin-console, hr-console, client-console, jobs-mf01,
│   │   │                             #   recruitment, sourcing, finance-mf05, portal, cv-builder, auth...
│   │   ├── hooks/                    # SignalR realtime (useNotificationSignalR, notificationRefreshKeys)...
│   │   └── services/api/             # Axios API clients đồng bộ hoàn toàn với Backend
│   └── docs/                         # Tài liệu tích hợp FE theo từng Main Flow
└── HRConnect/                        # [BACKEND] .NET 8 Clean Architecture Solution
    ├── Dockerfile                    # Multi-stage Dockerfile (Non-root user)
    ├── HRConnect.sln                 # Solution quản lý 5 projects
    ├── Permission.md                 # Từ điển ma trận phân quyền chi tiết của hệ thống
    ├── docs/                         # Tài liệu đặc tả & báo cáo audit MF01 -> MF05
    ├── HRConnect.Domain/             # [DOMAIN LAYER] Entities, Constants (JobStatuses, FinanceStates...)
    ├── HRConnect.Application/        # [APPLICATION LAYER] CQRS Features (Admin, Affiliates, Auth, Candidates,
    │                                 #   CommissionRules, Disputes, Finance, Interviews, Jobs, JobTemplates,
    │                                 #   Notifications, Offers, Payments, Placements, Recruitment, Reports,
    │                                 #   SubmissionConsents, Users...)
    ├── HRConnect.Infrastructure/     # [INFRASTRUCTURE LAYER] EF Core PostgreSQL, Migrations, Seeder,
    │                                 #   Repositories, Cloudflare R2, QuestPDF, VNPay, AI Client, Background Workers
    ├── HRConnect.Presentation/       # [PRESENTATION LAYER] Minimal API Endpoints (/api/v1/*), SignalR Hub
    └── HRConnect.UnitTests/          # [TEST LAYER] Hệ thống Unit & Integration Tests toàn diện
```

---

## 4. Tổng Quan 5 Luồng Nghiệp Vụ Chính (MF-01 → MF-05) & Luồng Bổ Trợ

Chi tiết kỹ thuật đầy đủ của từng phân hệ được đặt tại thư mục `HRConnect/docs/MF01..MF05/`:

1. **[MF-01 — Tạo, Duyệt, Hợp đồng Dịch vụ & Công bố Job](HRConnect/docs/MF01/README.md):**
   - Quản lý vòng đời Job, thư viện 13 mẫu JD (`JobTemplates`), phân quyền hiển thị/nộp đơn động theo `service_type_allowed_role`.
   - Luồng thương lượng & ký Hợp đồng dịch vụ (`ServiceAgreement` qua OTP điện tử hoặc tải bản PDF ký ướt có kiểm tra `SHA-256`), thu phí gói đăng tin `CV_APPLICATION` và đặt cọc `CV_SOURCING` trước khi kích hoạt `ACTIVE`.
2. **[MF-02 — Ứng tuyển, Kho CV / CV Builder, Consent, Attribution & Chống trùng](HRConnect/docs/MF02/README.md):**
   - Hỗ trợ Candidate tải PDF hoặc dựng CV bằng **CV Builder** (render PDF chuẩn hóa trên server, lưu R2, tính `ContentSha256`).
   - Xử lý 2 nhánh nộp đơn: Candidate tự ứng tuyển (`CV_APPLICATION`) và Affiliate giới thiệu (`HEADHUNT_COD`, `CV_SOURCING`) kèm xác nhận **Consent** của ứng viên (`CONFIRM`, `DECLINE`, `REPORT_UNAUTHORIZED`).
   - Cấp quyền `Attribution` theo nguyên tắc `CANDIDATE_CONSENT_THEN_FIRST_ACCEPTED` và xử lý ca nghi trùng danh tính (`CandidateDuplicateCases`).
3. **[MF-03 — AI Matching, Tiền sàng lọc, Giao CV Sourcing & Gợi ý Việc làm](HRConnect/docs/MF03/README.md):**
   - Chấm điểm CV – JD bất đồng bộ qua `Mf03ScoringDispatcher` (retry exponential backoff) và `ai-service-v2` (có hậu kiểm chống ảo giác LLM).
   - Phân tách người sàng lọc theo dịch vụ (`ScreeningPolicy`), che thông tin liên hệ & tạo CV ẩn danh (`MaskedCvService`) cho `HEADHUNT_COD` trước khi nhận việc, điều phối bàn giao & nghiệm thu CV Sourcing (`SourcingDelivery`), và gợi ý việc làm tự động (`JobMatchWorker`).
4. **[MF-04 — Phỏng vấn, Offer, Nhận việc (`Placement`) & Đối soát Độc lập](HRConnect/docs/MF04/README.md):**
   - Thực thi mô hình **Company-Owned Hiring Flow**: Doanh nghiệp trực tiếp điều phối phỏng vấn đa vòng, gửi/thu hồi Offer có phiên bản hóa (`OfferVersion`), xác nhận ứng viên đi làm (`PLACED`) hoặc không đi làm (`NOT_STARTED`).
   - Internal HR thực hiện bước **Đối soát độc lập (`PlacementReconciliation` — UC-41)** trước khi mở khóa thu phí dịch vụ và hoàn tất bảo hành.
5. **[MF-05 — Công nợ Phí, VNPay, Bảo hành, Suất thay thế, Hoa hồng & Payout](HRConnect/docs/MF05/README.md):**
   - Quản lý công nợ `ServiceFee`, tích hợp cổng thanh toán trực tuyến **VNPay** (`POSTING_FEE`, `SOURCING_DEPOSIT`, `SERVICE_FEE`) với cơ chế đồng bộ atomic giữa IPN và Browser Return.
   - Theo dõi bảo hành 30 ngày (`Warranty`), xử lý báo nghỉ việc và mở **Suất tuyển thay thế miễn phí (`ReplacementSlot`)** (tự gia hạn 1 lần, hoàn phí một phần nếu hết hạn chưa có CV thay thế), quyết toán `CV_SOURCING`, giải quyết khiếu nại (`Dispute`) và chi trả hoa hồng (`Commission` & `Payout`).

---

## 5. Cơ Chế Tự Động Hóa Database (Auto Migration & Seeder)

> [!TIP]
> **Thành viên trong nhóm KHÔNG cần tạo bảng thủ công!** Khi khởi chạy ứng dụng Backend (`dotnet run`), `Program.cs` tự động thực thi Migration và Seeder theo cơ chế Idempotent.

1. **`await dbContext.Database.MigrateAsync()`**:
   - Tự động áp dụng toàn bộ EF Core Migrations trong schema `public` (`__EFMigrationsHistory`), khởi tạo đầy đủ các bảng nghiệp vụ, khóa ngoại, unique partial index và cấu hình PostgreSQL.
2. **`await DatabaseSeeder.SeedAsync(dbContext)`**:
   - Seed **5 vai trò hệ thống** (`CANDIDATE`, `AFFILIATE`, `CLIENT_COMPANY_USER`, `INTERNAL_HR`, `PLATFORM_ADMIN`), **72+ quyền hạn** và ma trận `RolePermission`.
   - Seed **3 loại dịch vụ** (`HEADHUNT_COD`, `CV_SOURCING`, `CV_APPLICATION`), ma trận `service_type_allowed_role`, các gói đăng tin (`PostingPackage`), quy tắc hoa hồng mặc định (`CommissionRule`), cấu hình tham số hệ thống (`BusinessSettings`), 13 mẫu JD (`JobTemplates`), 3 mẫu CV Builder (`CvTemplates`) và danh mục Ngành nghề (`Industry` 3 cấp) + Quy mô công ty (`CompanySize`).

---

## 6. Chi Tiết Toàn Bộ File Cấu Hình (Configuration Deep-Dive)

### 6.1. File `.env` và `.env.example`
Hệ thống sử dụng `DotNetEnv.Env.TraversePath().Load();` trong `Program.cs` để nạp biến môi trường từ file `.env`:

```env
ASPNETCORE_ENVIRONMENT=Development

# 1. PostgreSQL Connection
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=HRConnect;Username=postgres;Password=your_secure_password;SearchPath=public

# 2. JWT Authentication (Tối thiểu 32 ký tự)
JwtSettings__Secret=YourSuperSecretKeyWithAtLeast32CharactersLong!123456
JwtSettings__Issuer=HRConnect
JwtSettings__Audience=HRConnectApp
JwtSettings__ExpiryMinutes=60

# 3. Email Service (Resend API)
Resend__ApiKey=re_your_resend_api_key_here
Resend__FromEmail=support@vcloset.vn
Resend__FromName=HRConnect System

# 4. Cloudflare R2 Storage (CV PDF, Hợp đồng, Avatar/Logo)
R2Storage__AccountId=your_r2_account_id
R2Storage__AccessKeyId=your_r2_access_key
R2Storage__SecretAccessKey=your_r2_secret_key
R2Storage__BucketName=hrconnect-files

# 5. AI Service v2 Integration
AiService__BaseUrl=http://localhost:8000
AiService__ServiceToken=your_shared_internal_service_token

# 6. VNPay Sandbox / Production
VnPay__TmnCode=your_vnpay_tmn_code
VnPay__HashSecret=your_vnpay_hash_secret
VnPay__BaseUrl=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VnPay__ReturnUrl=http://localhost:5173/client/payments/vnpay-return
```

> [!CAUTION]
> File `.env` chứa khóa bí mật thực tế và đã nằm trong `.gitignore`. **TUYỆT ĐỐI KHÔNG commit file `.env` lên GitHub!**

### 6.2. Health Check Endpoints
- **`GET /health/live`**: Liveness probe kiểm tra tiến trình API đang hoạt động (không phụ thuộc DB).
- **`GET /health/ready`**: Readiness probe kiểm tra kết nối PostgreSQL (`200 OK` hoặc `503 Service Unavailable`).

---

## 7. Hướng Dẫn Khởi Chạy Nhanh (Getting Started)

### 7.1. Khởi chạy Backend (.NET 8)
```bash
dotnet restore HRConnect/HRConnect.sln
dotnet run --project HRConnect/HRConnect.Presentation
```
- Swagger UI (Development): **[http://localhost:5041/swagger](http://localhost:5041/swagger)**

### 7.2. Khởi chạy Frontend (React + Vite)
```bash
cd HRConnect-FE
npm install
npm run dev
```
- Giao diện Web: **[http://localhost:5173](http://localhost:5173)**

### 7.3. Khởi chạy AI Service v2 (FastAPI)
```bash
cd ai-service-v2
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 7.4. Chạy Kiểm Thử Tự Động (Automated Tests)
```bash
# 1. Backend Unit & Integration Tests
dotnet test HRConnect/HRConnect.sln

# 2. Frontend Lint, Typecheck & Unit Tests (Vitest)
cd HRConnect-FE
npm run lint
npm run build
npx vitest run

# 3. AI Service v2 Tests (Pytest)
cd ../ai-service-v2
pytest
```

---

## 8. Quy Chuẩn Code Dành Cho Lập Trình Viên & AI Agent

1. **Clean Architecture & CQRS Vertical Slices:**
   - Mọi use case đặt trong `HRConnect.Application/Features/<Module>/Commands|Queries/`.
   - **Tuyệt đối không inject `ApplicationDbContext` vào Endpoint hoặc Handler tầng Application**; mọi truy vấn đi qua Repository Interface và `IUnitOfWork`.
2. **Chuẩn Ngoại lệ (Exceptions) & Concurrency:**
   - Sử dụng `BadRequestException` (`400`), `ForbiddenException` (`403`), `NotFoundException` (`404`), `ConflictException` (`409` kèm `ErrorCode` rõ nghĩa).
   - Mọi thao tác cập nhật trạng thái quan trọng đều kiểm tra `ConcurrencyToken` và ghi `IAuditLogService`.
3. **Nguyên tắc Ponytail (Anti-Overengineering) & Chuẩn UI (`unslop` + `motion`):**
   - Giữ phạm vi thay đổi tối thiểu (Minimal Blast Radius), không cài đặt thư viện dư thừa, tái sử dụng component/DTO sẵn có và đảm bảo đồng bộ Realtime qua `notificationRefreshKeys.ts`.

---

## 9. Bản Đồ API Endpoints Theo Phân Hệ

Toàn bộ Minimal API Endpoints được định tuyến tại `HRConnect.Presentation/Endpoints/V1/`:

| Phân hệ | Nhóm Route chính | Mô tả chức năng |
|---|---|---|
| **Auth & Identity** | `/api/auth/*`, `/api/v1/candidates/me/identity/*` | Đăng ký (Candidate, Affiliate, Client), xác thực OTP, Login, Refresh Token, Quên/Đổi mật khẩu, Tách tài khoản & Liên kết email/danh tính. |
| **MF-01 — Jobs & Agreements** | `/api/v1/jobs/*`, `/api/v1/public/jobs/*`, `/api/v1/job-templates/*` | CRUD Job, gửi duyệt, duyệt/từ chối, thương lượng & ký `ServiceAgreement` (OTP / bản ký ướt), phí gói đăng tin & đặt cọc Sourcing. |
| **MF-02 — Submissions, CVs & Consents** | `/api/v1/candidates/cv/*`, `/api/v1/affiliates/jobs/{id}/submissions`, `/api/v1/submission-consents/*`, `/api/v1/admin/candidate-duplicate-cases/*` | Upload CV PDF, CV Builder có cấu trúc, Candidate tự ứng tuyển, Affiliate giới thiệu ứng viên, xác nhận Consent (Public & In-App), quản lý Attribution & xử lý ca nghi trùng danh tính. |
| **MF-03 — AI Screening & Sourcing** | `/api/v1/jobs/{id}/applications/*`, `/api/v1/jobs/{id}/sourcing/deliveries/*`, `/api/v1/candidates/me/job-matches/*`, `/api/v1/internal/ai/*` | Chấm điểm AI & callback nội bộ, tiền sàng lọc (`SCREENING`, `SHORTLISTED`, `REJECTED`), xem CV ẩn danh (`masked`), giao & nghiệm thu CV Sourcing, gợi ý việc làm tự động. |
| **MF-04 — Interviews, Offers & Placements** | `/api/v1/recruitment/interviews/*`, `/api/v1/offers/*`, `/api/v1/placements/*`, `/api/v1/hr/placement-reconciliations/*` | Lên lịch/dời/hủy/ghi kết quả phỏng vấn, quyết định hồ sơ dự phòng (`BACKUP`), tạo/gửi/phản hồi/thu hồi Offer, xác nhận đi làm (`PLACED`), đánh dấu `NOT_STARTED` & đối soát nhận việc (UC-41). |
| **MF-05 — Finance, VNPay, Warranty & Payouts** | `/api/v1/service-fees/*`, `/api/v1/payments/vnpay/*`, `/api/v1/warranties/*`, `/api/v1/replacement-slots/*`, `/api/v1/commissions/*`, `/api/v1/payouts/*`, `/api/v1/disputes/*` | Công nợ phí dịch vụ, thanh toán VNPay (Return & IPN), bảo hành 30 ngày, báo nghỉ & mở suất thay thế, quyết toán Sourcing, duyệt hoa hồng, xử lý khiếu nại Attribution & chi trả Payout. |
| **Admin Console & Reports** | `/api/v1/admin/*`, `/api/v1/reports/*` | Duyệt tài khoản Doanh nghiệp/Affiliate, quản lý User/RBAC, cấu hình `BusinessSettings` & `ServiceTypes`, Audit Logs, Báo cáo doanh thu & **Admin Dashboard Metrics** (`/api/v1/admin/dashboard/metrics`). |

---

## 10. Quy Trình Git Flow & CI/CD Pipeline

```text
 feature/xxx ───┐
                ├──> PR / Merge ──> dev (Integration) ──> Merge ──> main (Production)
     fix/xxx ───┘                    │                                │
                                     ▼                                ▼
                          CI — Quality Gates               CI — Quality Gates
                     (BE + FE + AI v2 + Docker)                       │
                                                                      ▼
                                                            CD — Cloud Server
                                             (GHCR Images + Health Check + Auto Rollback)
```

1. **Làm việc trên nhánh riêng (`feat/...`, `fix/...`, `docs/...`)** cho từng hạng mục.
2. **Chờ CI trên nhánh riêng xanh (`completed` / `success`)** trước khi merge vào `dev`.
3. **Chờ CI trên `dev` xanh** trước khi merge vào `main` để kích hoạt **CD — Cloud Server**.

---

*Tài liệu được cập nhật đồng bộ với mã nguồn thực tế của dự án HR Connect.*
