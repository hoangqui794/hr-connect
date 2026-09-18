# HR Connect

**AI-Powered Recruitment & Affiliate Headhunting Platform**

HR Connect là nền tảng tuyển dụng hiện đại dành cho Agency, kết nối Doanh nghiệp đối tác (Client Company), Ứng viên (Candidate) và Mạng lưới Cộng tác viên tuyển dụng (Affiliate Recruiter / OPR Hub). Hệ thống hỗ trợ đánh giá và khớp nối CV tự động bằng AI, truy vết nguồn giới thiệu (Attribution tracking), và tự động hóa chính sách hoa hồng (Commission & Payout).

> **Dự án Capstone — SEP490, Đại học FPT**  
> **Trạng thái:** Đang phát triển (In Active Development)  
> **Giảng viên hướng dẫn:** Thầy Phạm Minh Trí  

---

## 👥 Nhóm Thực Hiện (Team Members)

| STT | Thành viên | Mã sinh viên | Vai trò | Trách nhiệm chính |
|:---:|---|:---:|:---:|---|
| 1 | **Trương Hoàng Quí** | SE184355 | **Leader** | Quản lý dự án, Thiết kế kiến trúc Backend, AI Integration |
| 2 | **Lê Thị Trà Mi** | SE184379 | **Member** | Phân tích nghiệp vụ, Frontend Developer |
| 3 | **Cao Hữu Trí** | SE184047 | **Member** | Backend Developer, Database, DevOps & CI/CD |
| 4 | **Khúc Ngọc Sơn** | SE184040 | **Member** | Frontend Developer, UI/UX Designer |
| 5 | **Nguyễn Văn Sang** | SE183276 | **Member** | Fullstack Developer, QA & Testing |

---

## 📑 Mục Lục
1. [Mục Tiêu & Dịch Vụ Cốt Lõi](#1-mục-tiêu--dịch-vụ-cốt-lõi)
2. [Các Vai Trò Người Dùng (Actor & Roles)](#2-các-vai-trò-người-dùng-actor--roles)
3. [Kiến Trúc Hệ Thống (Clean Architecture + CQRS)](#3-kiến-trúc-hệ-thống-clean-architecture--cqrs)
4. [Cơ Chế Tự Động Hóa Database (Auto Migration & Seeder)](#4-cơ-chế-tự-động-hóa-database-auto-migration--seeder)
5. [Chi Tiết Toàn Bộ File Cấu Hình (Configuration Deep-Dive)](#5-chi-tiết-toàn-bộ-file-cấu-hình-configuration-deep-dive)
6. [Hướng Dẫn Khởi Chạy Nhanh (Getting Started)](#6-hướng-dẫn-khởi-chạy-nhanh-getting-started)
7. [Quy Chuẩn Code Dành Cho Lập Trình Viên & AI Agent](#7-quy-chuẩn-code-dành-cho-lập-trình-viên--ai-agent)
8. [Tài Liệu API & Luồng Nghiệp Vụ Auth Đã Hoàn Thiện](#8-tài-liệu-api--luồng-nghiệp-vụ-auth-đã-hoàn-thiện)
9. [Quy Trình Git Flow & CI/CD Pipeline](#9-quy-trình-git-flow--cicd-pipeline)

---

## 1. Mục Tiêu & Dịch Vụ Cốt Lõi

### 1.1. Mục tiêu dự án
- Tập trung hóa dữ liệu Doanh nghiệp, Job tuyển dụng, Ứng viên và CV trên cùng một hệ thống.
- Sử dụng mô hình AI hỗ trợ đối soát, phân tích độ phù hợp giữa CV và Job Description (JD).
- Quản lý và chống trùng lặp ứng viên thông qua hệ thống truy vết nguồn giới thiệu (Attribution).
- Tự động hóa tính toán hoa hồng (Commission), điều kiện nghiệm thu thử việc (Warranty/Probation) và thanh toán cho Affiliate (Payout).

### 1.2. Ba mô hình dịch vụ tuyển dụng
| Mã dịch vụ | Tên dịch vụ | Mô tả hoạt động |
|---|---|---|
| `HEADHUNT_COD` | **Tuyển dụng theo phí hoa hồng (Contingency)** | Thu phí khi ứng viên nhận việc và vượt qua thời gian bảo hành (Probation period). |
| `CV_SOURCING` | **Tìm kiếm & Cung cấp hồ sơ** | Agency và Affiliate lọc danh sách ứng viên đạt chuẩn gửi cho Doanh nghiệp phỏng vấn. |
| `CV_APPLICATION` | **Tiếp nhận hồ sơ ứng tuyển trực tiếp** | Đăng tin Job công khai, tiếp nhận CV ứng viên nộp qua cổng thông tin. |

---

## 2. Các Vai Trò Người Dùng (Actor & Roles)

Hệ thống quản lý 5 nhóm vai trò (`Role`) chuẩn hóa:

| Role Code | Tên vai trò | Mô tả quyền hạn |
|---|---|---|
| `PLATFORM_ADMIN` | **Quản trị viên nền tảng** | Toàn quyền kiểm soát tài khoản, phê duyệt hồ sơ Doanh nghiệp/Affiliate, cấu hình hệ thống và giám sát giao dịch. |
| `INTERNAL_HR` | **Chuyên viên tuyển dụng Agency** | Tiếp nhận yêu cầu tuyển dụng từ Doanh nghiệp, điều phối phỏng vấn, kiểm duyệt hồ sơ và duyệt hoa hồng cho Affiliate. |
| `CLIENT_COMPANY_USER` | **Khách hàng Doanh nghiệp** | Tạo yêu cầu Job tuyển dụng, xem hồ sơ ứng viên do Agency gửi tới, phản hồi kết quả phỏng vấn và duyệt offer. |
| `AFFILIATE_RECRUITER` | **Cộng tác viên tuyển dụng** | Giới thiệu ứng viên (nộp CV qua link affiliate/portal), theo dõi trạng thái ứng viên và nhận hoa hồng khi thành công. |
| `CANDIDATE` | **Ứng viên** | Quản lý hồ sơ cá nhân, CV, tìm kiếm và nộp đơn ứng tuyển các Job công khai, theo dõi tiến độ ứng tuyển. |

---

## 3. Kiến Trúc Hệ Thống (Clean Architecture + CQRS)

Dự án Backend xây dựng trên nền tảng **.NET 8 Web API** áp dụng nghiêm ngặt nguyên lý **Clean Architecture (Onion)**, kết hợp mẫu kiến trúc **CQRS (MediatR)** và phân chia chức năng theo lát cắt dọc (**Vertical Slice Architecture**).

### 3.1. Sơ đồ phụ thuộc (Dependency Diagram)

```
       ┌─────────────────────────────────────────┐
       │         HRConnect.Presentation          │  (Web API / Endpoints / Swagger / JWT Auth)
       └──────────────┬──────────────────────────┘
                      │ phụ thuộc
       ┌──────────────▼─────────────┐   ┌───────────────────────────┐
       │   HRConnect.Infrastructure │   │   HRConnect.Application   │ (MediatR CQRS, Validators)
       └──────────────┬─────────────┘   └─────────────┬─────────────┘
                      │ phụ thuộc                     │ phụ thuộc
       ┌──────────────▼───────────────────────────────▼─────────────┐
       │                      HRConnect.Domain                      │ (Pure Entities, Rules, Enums)
       └────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Quy tắc phụ thuộc một chiều (Dependency Rule):**
> - `HRConnect.Domain`: Tầng trung tâm, **tuyệt đối KHÔNG phụ thuộc** vào bất kỳ project nào khác, không phụ thuộc thư viện bên ngoài (trừ C# Core).
> - `HRConnect.Application`: Chỉ phụ thuộc vào `HRConnect.Domain`. Chứa toàn bộ business use case, interfaces, validation. Không phụ thuộc vào database hay HTTP.
> - `HRConnect.Infrastructure`: Phụ thuộc vào `HRConnect.Application` và `HRConnect.Domain`. Triển khai database (EF Core, Npgsql), dịch vụ ngoài (Email, Cloudinary, AI...).
> - `HRConnect.Presentation`: Tầng khởi động ứng dụng, định tuyến API, Middleware.

### 3.2. Cấu trúc thư mục chi tiết

```text
d:/Ki_9/HRConnect/
├── .github/workflows/
│   └── ci-cd.yml                     # Pipeline GitHub Actions (CI: test, CD: buildx Docker GHCR)
├── .env.example                      # Template cấu hình biến môi trường
├── .gitignore                        # Cấu hình bỏ qua các file nhạy cảm và build rác
├── README.md                         # Tài liệu hướng dẫn chuẩn cho Team & AI
│
└── HRConnect/
    ├── Dockerfile                    # Multi-stage Dockerfile cho .NET 8 (Non-root user)
    ├── .dockerignore                 # Tối ưu hóa dung lượng build Docker
    ├── HRConnect.sln                 # Solution quản lý 5 projects
    ├── Permission.md                 # Từ điển ma trận phân quyền chi tiết của hệ thống
    │
    ├── HRConnect.Domain/             # [DOMAIN LAYER] Nghiệp vụ cốt lõi
    │   ├── Common/                   # BaseEntity, ValueObject, DomainEvent
    │   ├── Entities/                 # AppUser, Candidate, Job, Submission, Commission, Role...
    │   └── Enums/                    # UserRole, ServiceType, JobStatus, SubmissionStatus...
    │
    ├── HRConnect.Application/        # [APPLICATION LAYER] Business Logic & CQRS Slices
    │   ├── Common/
    │   │   ├── Exceptions/           # BadRequestException, ConflictException, ForbiddenException...
    │   │   ├── Interfaces/           # IEmailService, IPasswordHasher, IOtpService, IUnitOfWork...
    │   │   │   └── Repositories/     # IUserRepository, ICandidateRepository, IRoleRepository...
    │   │   └── Models/               # AuthenticationSettings, JwtSettings, EmailResult...
    │   ├── Features/                 # Vertical Slices phân chia theo phân hệ chức năng
    │   │   └── Auth/                 # Phân hệ Xác thực & Tài khoản
    │   │       ├── Commands/         # Đăng ký Candidate, Affiliate, Client, VerifyOtp, Login...
    │   │       └── Queries/          # Các truy vấn dữ liệu đọc (Read-only)
    │   └── DependencyInjection.cs    # Tự động đăng ký MediatR, FluentValidation, Pipeline Behaviors
    │
    ├── HRConnect.Infrastructure/     # [INFRASTRUCTURE LAYER] Công nghệ & Dịch vụ ngoài
    │   ├── Migrations/               # Toàn bộ file Database Migrations của EF Core
    │   ├── Persistence/              # ApplicationDbContext, DatabaseSeeder (Tự động seed Data)
    │   ├── Repositories/             # Triển khai Repository Pattern (UserRepository, CandidateRepository...)
    │   ├── Services/
    │   │   ├── Admin/                # AdminApprovalService (Duyệt Affiliate, Client)
    │   │   ├── Email/                # ResendEmailService (REST API Resend)
    │   │   └── Identity/             # PasswordHasher (BCrypt), OtpService, JwtTokenGenerator...
    │   └── DependencyInjection.cs    # Đăng ký DbContext, PostgreSQL Npgsql, Repositories, Services
    │
    ├── HRConnect.Presentation/       # [PRESENTATION LAYER] Web API & Endpoints
    │   ├── Endpoints/
    │   │   └── V1/
    │   │       ├── Auth/             # Minimal API Endpoints (/api/auth/*)
    │   │       └── Emails/           # Minimal API Endpoints (/api/v1/emails/*)
    │   ├── Properties/
    │   │   └── launchSettings.json   # Cấu hình Port: HTTP 5041, HTTPS 7289, Swagger UI
    │   ├── appsettings.json          # Cấu hình Logging, OTP policy
    │   ├── appsettings.Development.json
    │   └── Program.cs                # Nhạc trưởng: nạp .env, CORS, Auth, Swagger, Auto-Migrate/Seed
    │
    └── HRConnect.UnitTests/          # [TEST LAYER] 126+ Automated Unit Tests
        ├── Common/                   # Test helpers, Mock factories
        ├── Features/Auth/            # Test toàn bộ Command, Handler, Validator, Login, OTP
        └── Services/                 # Test PasswordHasher, OtpService, TokenGenerator
```

---

## 4. Cơ Chế Tự Động Hóa Database (Auto Migration & Seeder)

> [!TIP]
> **Thành viên mới trong nhóm KHÔNG cần phải tự tạo bảng hay chạy bất kỳ script SQL nào!**

Khi khởi chạy ứng dụng Backend (`dotnet run`), hệ thống tại file `Program.cs` đã được lập trình sẵn quy trình tự động 2 bước:

```csharp
// Tự động kiểm tra và áp dụng Migration + Seed Data khi khởi động
using var scope = app.Services.CreateScope();
var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
await dbContext.Database.MigrateAsync();
await DatabaseSeeder.SeedAsync(dbContext);
```

### Chi tiết hành vi tự động:
1. **`await dbContext.Database.MigrateAsync()`**:
   - Tự động kết nối vào PostgreSQL server được khai báo trong `.env`.
   - Tự động tạo mới cơ sở dữ liệu nếu chưa có.
   - Tự động tạo bảng lịch sử `__EFMigrationsHistory` nằm trong schema `public`.
   - Tự động áp dụng toàn bộ các bản Migration để sinh ra hơn **40+ bảng** với đầy đủ khóa chính UUID, khóa ngoại, quan hệ ràng buộc và index.
2. **`await DatabaseSeeder.SeedAsync(dbContext)`**:
   - **Seed Roles**: Tự động kiểm tra và nạp **5 vai trò hệ thống** (`CANDIDATE`, `AFFILIATE_RECRUITER`, `CLIENT_COMPANY_USER`, `INTERNAL_HR`, `PLATFORM_ADMIN`).
   - **Seed Permissions**: Tự động kiểm tra và nạp **72+ quyền hạn** chia theo 11 phân hệ chức năng từ file chuẩn `HRConnect/Permission.md`.
   - **Seed Role-Permissions**: Tự động gán toàn bộ ma trận quyền hạn cho từng vai trò tương ứng.
   - Cơ chế hoạt động là **Idempotent (an toàn)**: Nếu bảng đã có dữ liệu rồi, seeder sẽ tự động bỏ qua, không gây lỗi trùng lặp.

---

## 5. Chi Tiết Toàn Bộ File Cấu Hình (Configuration Deep-Dive)

Để dự án vận hành mượt mà cả ở môi trường phát triển cục bộ (Local), Docker và CI/CD, hệ thống sử dụng các file cấu hình sau:

### 5.1. File `.env` và `.env.example`
File `.env` là nơi lưu trữ toàn bộ thông tin nhạy cảm (Chuỗi kết nối DB, Khóa bí mật JWT, API Key Email...). 
Hệ thống sử dụng thư viện `DotNetEnv.Env.TraversePath().Load();` trong `Program.cs` để tự động dò tìm file `.env` từ thư mục hiện tại ngược lên thư mục cha.

```env
# ==============================================================================
# HRConnect Environment Configuration Template
# ==============================================================================

# 1. Môi trường chạy của ASP.NET Core (Development | Staging | Production)
ASPNETCORE_ENVIRONMENT=Development

# 2. Thông tin cơ sở dữ liệu PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=HRConnect
DB_USER=postgres
DB_PASSWORD=your_secure_password

# 3. Chuỗi kết nối PostgreSQL (EF Core Npgsql đọc tự động)
# Lưu ý: Luôn chỉ định SearchPath=public để bảng nằm đúng schema chuẩn
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=HRConnect;Username=postgres;Password=your_secure_password;SearchPath=public

# 4. Cấu hình JWT Authentication
# Secret bắt buộc phải có độ dài tối thiểu 32 ký tự (256-bit key)
JwtSettings__Secret=YourSuperSecretKeyWithAtLeast32CharactersLong!123456
JwtSettings__Issuer=HRConnect
JwtSettings__Audience=HRConnectApp
JwtSettings__ExpiryMinutes=60

# 5. Dịch vụ gửi Email (Resend API)
RESEND_API_KEY=re_your_resend_api_key_here
Resend__ApiKey=re_your_resend_api_key_here
Resend__FromEmail=support@vcloset.vn
Resend__FromName=HRConnect System
```

> [!CAUTION]
> File `.env` chứa mật khẩu thực tế của máy bạn và đã được đưa vào `.gitignore`. **TUYỆT ĐỐI KHÔNG commit file `.env` lên GitHub!**

### 5.2. File `HRConnect.Presentation/appsettings.json`
Lưu các cấu hình không nhạy cảm của ứng dụng:
- **`Logging`**: Mức độ ghi log hệ thống (`Information`, lọc bớt cảnh báo thừa từ Microsoft framework).
- **`Authentication:Otp`**:
  - `Length: 6`: Mã OTP gồm 6 chữ số ngẫu nhiên.
  - `ExpirationMinutes: 15`: Mã OTP có hiệu lực trong vòng 15 phút kể từ lúc gửi qua email.

### 5.3. File `HRConnect.Presentation/Properties/launchSettings.json`
Quy định cổng mạng (Port) khi chạy ở môi trường phát triển cục bộ:
- **HTTP**: `http://localhost:5041`
- **HTTPS**: `https://localhost:7289`
- **Swagger Documentation URL**: `http://localhost:5041/swagger`

### 5.4. File `HRConnect/Dockerfile` & `.dockerignore`
Được thiết kế theo tiêu chuẩn Multi-stage build nhằm tối ưu tốc độ build và kích thước image:
- **Stage 1 (`base`)**: Sử dụng base image siêu nhẹ `mcr.microsoft.com/dotnet/aspnet:8.0`, mở cổng `8080`.
- **Stage 2 (`build`)**: Sử dụng `mcr.microsoft.com/dotnet/sdk:8.0`. Để tối ưu cache layer, Dockerfile copy toàn bộ các file `.csproj` của cả 5 project (bao gồm cả `HRConnect.UnitTests.csproj`) trước khi chạy `dotnet restore "HRConnect.sln"`.
- **Stage 3 (`publish`)**: Build và publish duy nhất project `HRConnect.Presentation` sang thư mục `/app/publish`.
- **Stage 4 (`final`)**: Copy file biên dịch từ stage publish, chuyển quyền sang tài khoản an toàn không có đặc quyền root (`USER $APP_UID`) để ngăn ngừa tấn công leo thang đặc quyền container.

### 5.5. File `.github/workflows/ci-cd.yml`
Pipeline tự động hóa kiểm thử và đóng gói triển khai (GitHub Actions):
- **Triggers**: Kích hoạt khi có `push` hoặc `pull_request` vào 2 nhánh chính `main` và `dev`.
- **Job `build-and-test` (CI)**: Tự động chạy `dotnet restore`, `dotnet build -c Release`, và chạy toàn bộ 126+ unit tests bằng `dotnet test`. Nếu có bất kỳ test nào fail, pipeline lập tức chặn không cho merge.
- **Job `deploy` (CD)**: Khi code được merge thành công vào nhánh `main`, hệ thống tự động build Docker image bằng `docker/setup-buildx-action` và đẩy (push) trực tiếp lên **GitHub Container Registry (GHCR)** dưới tên tag `latest` và mã commit SHA.

### 5.6. File `HRConnect.Infrastructure/DependencyInjection.cs` (Cấu Hình Hạ Tầng & Dịch Vụ)
Đây là **file cấu hình trung tâm của toàn bộ tầng Hạ tầng (Infrastructure Layer)**. Để đảm bảo tính đóng gói của Clean Architecture, `Program.cs` chỉ cần gọi duy nhất:
```csharp
builder.Services.AddInfrastructureServices(builder.Configuration);
```
File này cung cấp phương thức mở rộng `AddInfrastructureServices` chịu trách nhiệm cấu hình toàn bộ 6 nhóm thành phần sau:

```csharp
public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
```

1. **Kết nối PostgreSQL & EF Core (`services.AddDbContext<ApplicationDbContext>`)**:
   - Đọc chuỗi kết nối `connectionString` từ `configuration.GetConnectionString("DefaultConnection")` (được bind tự động từ file `.env`).
   - Cấu hình provider Npgsql: `options.UseNpgsql(connectionString, o => o.MigrationsHistoryTable("__EFMigrationsHistory", "public"))`.
   - **Lưu ý sống còn:** Tham số `MigrationsHistoryTable("__EFMigrationsHistory", "public")` bắt buộc EF Core luôn quản lý bảng lịch sử migration trong schema `public`, tránh lỗi lệch schema khi chạy trên Docker hoặc môi trường PostgreSQL khác nhau.
2. **Cấu hình Dịch vụ Gửi Email (`services.AddHttpClient<IEmailService, ResendEmailService>`)**:
   - Sử dụng **Options Pattern**: `services.Configure<ResendSettings>(...)` để nạp API Key và email người gửi.
   - Sử dụng **Typed HttpClient**: Đăng ký `ResendEmailService` với `HttpClientFactory` gắn sẵn `BaseAddress = new Uri("https://api.resend.com/")`. Cách này giúp quản lý vòng đời socket tối ưu, chống hiện tượng cạn kiệt socket (Socket Exhaustion) khi gửi email hàng loạt.
3. **Cấu hình Authentication, OTP & JWT Settings**:
   - Bind cấu hình `AuthenticationSettings` (độ dài OTP 6 số, hạn 15 phút) từ `appsettings.json`.
   - Bind cấu hình `JwtSettings` (Secret, Issuer, Audience, ExpiryMinutes) từ `.env`.
4. **Đăng ký Dịch vụ Identity & Bảo mật (`Singleton` Lifetime)**:
   - `IPasswordHasher -> PasswordHasher`: Băm và so khớp mật khẩu bằng thuật toán an toàn BCrypt.
   - `IOtpService -> OtpService`: Sinh mã OTP ngẫu nhiên bằng `RandomNumberGenerator` chuẩn mật mã học.
   - `IPhoneNormalizer -> PhoneNormalizer`: Chuẩn hóa số điện thoại theo định dạng chuẩn quốc tế E.164 (+84).
   - `IEmailNormalizer -> EmailNormalizer`: Chuẩn hóa email về chữ thường và loại bỏ khoảng trắng.
   - `IJwtTokenGenerator -> JwtTokenGenerator`: Tạo mã Access Token (JWT) và Refresh Token chứa các Claims và Permissions.
   - *(Vì các dịch vụ này hoàn toàn không giữ trạng thái riêng (Stateless), việc đăng ký `AddSingleton` giúp tiết kiệm bộ nhớ và đạt hiệu năng tối đa).*
5. **Đăng ký Toàn Bộ Repositories & UnitOfWork (`Scoped` Lifetime)**:
   - Đăng ký interface với implementation tương ứng: `IUserRepository -> UserRepository`, `ICandidateRepository -> CandidateRepository`, `IAffiliateApplicationRepository -> AffiliateApplicationRepository`, `ICompanyRepository -> CompanyRepository`, `IRoleRepository -> RoleRepository`, `IRefreshTokenRepository -> RefreshTokenRepository`, `IEmailOutboxRepository -> EmailOutboxRepository`...
   - Đăng ký `IUnitOfWork -> UnitOfWork` để quản lý giao dịch dữ liệu tập trung.
   - *(Bắt buộc dùng `Scoped` để mỗi HTTP Request có một phiên làm việc riêng biệt cùng chia sẻ chung một instance `ApplicationDbContext`).*
6. **Đăng ký Dịch vụ Nghiệp vụ Quản trị (`Scoped` Lifetime)**:
   - `IAdminApprovalService -> AdminApprovalService`: Điều phối nghiệp vụ phê duyệt/từ chối đơn đăng ký của Affiliate Recruiter và Client Company, cấp quyền hoạt động và gửi email thông báo.

> [!TIP]
> **HƯỚNG DẪN CHO DEV & AI:**  
> Mỗi khi tạo mới một Repository hoặc một dịch vụ hạ tầng bên ngoài (ví dụ: Cloudinary Service, S3 Service, Notification Hub...), bạn **PHẢI** vào file này để khai báo `services.AddScoped<IMyRepository, MyRepository>()`. Tuyệt đối không khai báo thủ công rải rác bên trong `Program.cs`.

### 5.7. File `HRConnect.Application/DependencyInjection.cs` (Nạp Tự Động CQRS & Validation)
Tương tự tầng Infrastructure, tầng Application có file `DependencyInjection.cs` riêng để tự quản lý:
```csharp
public static IServiceCollection AddApplicationServices(this IServiceCollection services)
{
    // 1. Quét toàn bộ Assembly để tự động đăng ký tất cả MediatR Handlers (Commands & Queries)
    services.AddMediatR(cfg =>
        cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

    // 2. Quét toàn bộ Assembly để tự động đăng ký tất cả FluentValidation Validators
    services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

    return services;
}
```
👉 Khi bạn hoặc AI tạo thêm một Command/Query mới hoặc một Validator mới trong thư mục `Features/`, **bạn KHÔNG cần phải đăng ký thủ công**, MediatR và FluentValidation sẽ tự động phát hiện thông qua kỹ thuật Assembly Scanning!

---

## 6. Hướng Dẫn Khởi Chạy Nhanh (Getting Started)

### Yêu cầu môi trường:
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (Kiểm tra bằng lệnh: `dotnet --version` >= 8.0.xxx)
- [PostgreSQL](https://www.postgresql.org/) version 15+ đang chạy (trên máy local hoặc Docker container)

### 🚀 Khởi chạy chỉ với 4 bước:

#### Bước 1: Clone mã nguồn về máy
```bash
git clone https://github.com/hoangqui794/hr-connect.git
cd hr-connect
```

#### Bước 2: Thiết lập file môi trường `.env`
Sao chép template cấu hình:
```bash
# Trên Windows PowerShell:
Copy-Item .env.example HRConnect/.env

# Hoặc trên Linux/macOS/Git Bash:
cp .env.example HRConnect/.env
```
Mở file `HRConnect/.env` vừa tạo, cập nhật `DB_PASSWORD` và chuỗi `ConnectionStrings__DefaultConnection` cho khớp với mật khẩu PostgreSQL trên máy bạn.

#### Bước 3: Chạy ứng dụng Backend
```bash
# Khôi phục dependencies cho toàn bộ solution
dotnet restore HRConnect/HRConnect.sln

# Khởi chạy API Server
dotnet run --project HRConnect/HRConnect.Presentation
```

#### Bước 4: Trải nghiệm API trên Swagger UI
Mở trình duyệt truy cập:
👉 **[http://localhost:5041/swagger](http://localhost:5041/swagger)**

Tại giao diện Swagger, bạn có thể thực hiện đăng ký tài khoản, xác thực OTP và nhấn vào nút **Authorize 🔒** để dán JWT token kiểm tra các API bảo mật.

### 🧪 Chạy Kiểm Thử Tự Động (Unit Tests)
Để đảm bảo tất cả các chức năng hoạt động hoàn hảo và không bị hồi quy lỗi:
```bash
dotnet test HRConnect/HRConnect.sln
```
*(Kết quả chuẩn: Toàn bộ **126/126 test cases** Passed 100%).*

---

## 7. Quy Chuẩn Code Dành Cho Lập Trình Viên & AI Agent

> [!IMPORTANT]
> **DÀNH CHO CÁC THÀNH VIÊN VÀ CÔNG CỤ TRỢ LÝ AI (Cursor, Copilot, Antigravity, Claude, ChatGPT):**  
> Bất kỳ ai khi viết mã nguồn mới vào repository này **BẮT BUỘC** phải tuân theo các quy tắc thiết kế dưới đây để bảo toàn tính nhất quán của kiến trúc Clean Architecture.

### 7.1. Cấu trúc Vertical Slice theo chuẩn CQRS
Mỗi tính năng thay đổi dữ liệu hoặc truy vấn phải nằm trong thư mục `HRConnect.Application/Features/<ModuleName>/Commands/<ActionName>/` hoặc `Queries/<ActionName>/`.

Một lát cắt chuẩn (Feature Slice) gồm 4 file cơ bản:
1. `*Command.cs` (hoặc `*Query.cs`): Implement `IRequest<TResponse>`. Khai báo dữ liệu đầu vào.
2. `*CommandHandler.cs`: Implement `IRequestHandler<TCommand, TResponse>`. Chứa business logic, gọi Repository, UnitOfWork.
3. `*CommandValidator.cs`: Kế thừa `AbstractValidator<TCommand>` (FluentValidation). Tuyệt đối không hardcode validate thủ công trong Controller.
4. `*Response.cs`: DTO trả về cho Client.

### 7.2. Quy tắc Thao tác Dữ liệu & Repository Pattern
- **Tuyệt đối KHÔNG inject `ApplicationDbContext` vào Controller/Endpoints hay tầng Application**.
- Mọi thao tác truy xuất dữ liệu phải thông qua Repository Interface (`IUserRepository`, `ICandidateRepository`...) nằm trong `HRConnect.Application/Common/Interfaces/Repositories/`.
- Triển khai cụ thể của Repository nằm trong `HRConnect.Infrastructure/Repositories/`.
- Khi cần cập nhật dữ liệu, luôn gọi `await _unitOfWork.SaveChangesAsync(cancellationToken)` để đảm bảo tính toàn vẹn Transaction.

### 7.3. Quy tắc Quản lý Ngoại Lệ (Exception Standards)
Trong Handler, không trả về mã lỗi HTTP thô. Hãy ném các Exception chuẩn trong `HRConnect.Application/Common/Exceptions/`:
- `BadRequestException`: Dữ liệu không hợp lệ hoặc vi phạm điều kiện nghiệp vụ ➔ Endpoint map về **HTTP 400 Bad Request**.
- `ConflictException`: Dữ liệu đã tồn tại (email, số điện thoại, tax code...) ➔ Endpoint map về **HTTP 409 Conflict**.
- `ForbiddenException`: Chưa kích hoạt email, đang chờ duyệt, bị từ chối hoặc không có quyền ➔ Endpoint map về **HTTP 403 Forbidden**.
- `NotFoundException`: Không tìm thấy bản ghi dữ liệu ➔ Endpoint map về **HTTP 404 Not Found**.

### 7.4. Quy tắc Cơ sở Dữ liệu & Migration
- Tên bảng và tên cột trong PostgreSQL được đặt theo chuẩn `snake_case` (ví dụ: `app_user`, `created_at`, `refresh_token`).
- Khóa chính luôn sử dụng kiểu `Guid` (UUID).
- Mọi bảng chính đều kế thừa `BaseAuditableEntity` (có sẵn `created_at`, `updated_at`, `is_deleted`).
- Khi thêm hoặc sửa Entity trong `HRConnect.Domain/Entities/`, phải tạo Migration mới bằng lệnh:
  ```bash
  dotnet ef migrations add <TenMigrationNganGon> --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation
  ```

### 7.5. Quy tắc Đăng ký Dịch vụ (Dependency Injection)
- Không gom toàn bộ dịch vụ vào `Program.cs`.
- Tầng Application tự đăng ký trong `HRConnect.Application/DependencyInjection.cs`.
- Tầng Infrastructure tự đăng ký DbContext, Repositories và external services trong `HRConnect.Infrastructure/DependencyInjection.cs`.

---

## 8. Tài Liệu API & Luồng Nghiệp Vụ Auth Đã Hoàn Thiện

Hệ thống đã triển khai hoàn chỉnh module xác thực tài khoản đa đối tượng:

### 8.1. Danh sách API Endpoints

| Phương thức | Đường dẫn Endpoint | Mô tả | Yêu cầu xác thực |
|:---:|---|---|:---:|
| `POST` | `/api/auth/register/candidate` | Đăng ký tài khoản Ứng viên (tự động link với CV nếu email đã có sẵn) | Public |
| `POST` | `/api/auth/register/affiliate` | Đăng ký tài khoản Cộng tác viên Affiliate Recruiter | Public |
| `POST` | `/api/auth/register/client` | Đăng ký tài khoản Khách hàng Doanh nghiệp kèm thông tin công ty | Public |
| `POST` | `/api/auth/verify-otp` | Xác thực mã OTP 6 số gửi qua email để hoàn tất bước xác minh | Public |
| `POST` | `/api/auth/login` | Đăng nhập bằng Email/Password, cấp JWT Token + Refresh Token + Permissions | Public |
| `POST` | `/api/auth/refresh-token` | Làm mới Access Token đã hết hạn bằng Refresh Token hợp lệ | Public |
| `POST` | `/api/v1/emails/test-send` | Endpoint kiểm tra kết nối dịch vụ gửi email | Public |

### 8.2. Luồng xác thực 2 bước (Two-stage Approval Workflow)
1. **Đối với Candidate**:
   - `POST /register/candidate` ➔ Hệ thống tạo User trạng thái `PENDING`, gửi OTP 6 số qua email.
   - `POST /verify-otp` ➔ Xác thực thành công: Gán Role `CANDIDATE`, trạng thái chuyển sang `ACTIVE`, người dùng có thể đăng nhập ngay.
2. **Đối với Affiliate Recruiter & Client Company User**:
   - `POST /register/affiliate` hoặc `/register/client` ➔ Tạo User và Đơn đăng ký (`PENDING`).
   - `POST /verify-otp` ➔ Xác thực OTP thành công: Email đã được xác minh (`email_verified = true`), đơn chuyển sang `UNDER_REVIEW`, gửi email thông báo Chờ Admin phê duyệt. Lúc này **chưa cấp quyền Role hoạt động**.
   - **Cơ chế chặn đăng nhập an toàn**: Khi gọi `POST /login`, hệ thống kiểm tra nếu tài khoản đang ở trạng thái `PENDING` hoặc đơn bị `REJECTED` ➔ Lập tức chặn bằng mã **HTTP 403 Forbidden** kèm thông báo rõ ràng: *"Tài khoản của bạn đang chờ Quản trị viên xét duyệt"* hoặc *"Đơn đăng ký của bạn đã bị từ chối"*. Chỉ khi Platform Admin phê duyệt đơn (`AdminApprovalService.ApproveAffiliateAsync`), tài khoản mới được chuyển sang `ACTIVE` và cấp Role hoạt động.

---

## 9. Quy Trình Git Flow & CI/CD Pipeline

Nhóm tuân thủ quy tắc quản lý mã nguồn nghiêm ngặt:

```text
 feature/xxx ───┐
                ├──> PR ──> dev (Staging Integration) ──> PR ──> main (Production)
     fix/xxx ───┘                                                   │
                                                                    ▼
                                                            GitHub Actions CD
                                                       (Buildx & Push Image GHCR)
```

### Quy tắc làm việc trên Git:
1. **Tuyệt đối không commit trực tiếp vào `main` hoặc `dev`**.
2. Khi phát triển tính năng mới, tạo nhánh từ `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/<ten-tinh-nang>
   ```
3. Sau khi hoàn thành và chạy `dotnet test` thành công:
   ```bash
   git add .
   git commit -m "feat(module): mo ta ngan gon ve tinh nang"
   git push origin feature/<ten-tinh-nang>
   ```
4. Tạo **Pull Request (PR)** trên GitHub vào nhánh `dev`.
5. Đợi pipeline CI kiểm tra thành công (Green Tick) và ít nhất 1 thành viên review code trước khi thực hiện Merge.

---

*Tài liệu được cập nhật định kỳ theo tiến độ dự án. Mọi thắc mắc vui lòng liên hệ nhóm phát triển HR Connect.*
