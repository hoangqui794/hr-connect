# HR Connect

**AI-Powered Recruitment & Affiliate Headhunting Platform**

HR Connect là nền tảng web hỗ trợ Agency quản lý hoạt động tuyển dụng, kết nối doanh nghiệp, ứng viên và mạng lưới cộng tác viên tuyển dụng (Affiliate/OPR).

Hệ thống tập trung thông tin tuyển dụng, hỗ trợ đánh giá CV bằng AI, theo dõi nguồn giới thiệu và quản lý quyền lợi Affiliate.

> **Dự án Capstone — SEP490, FPT University**  
> **Trạng thái:** Đang phát triển  
> **Giảng viên hướng dẫn:** Phạm Minh Trí  

---

## 👥 Nhóm Thực Hiện (Team Members)

| STT | Thành viên | Mã sinh viên | Vai trò |
|:---:|---|:---:|---|
| 1 | **Trương Hoàng Quí** | SE184355 | Leader |
| 2 | **Lê Thị Trà Mi** | SE184379 | Member |
| 3 | **Cao Hữu Trí** | SE184047 | Member |
| 4 | **Khúc Ngọc Sơn** | SE184040 | Member |
| 5 | **Nguyễn Văn Sang** | SE183276 | Member |

---

## 1. Mục Tiêu Dự Án

- Tập trung hóa thông tin doanh nghiệp, Job, ứng viên và CV.
- Hỗ trợ ba loại dịch vụ tuyển dụng trên một nền tảng.
- Nhận diện hồ sơ trùng và truy vết nguồn giới thiệu.
- Sử dụng AI hỗ trợ đối chiếu CV với Job Description (JD).
- Theo dõi tiến độ và kết quả xử lý hồ sơ.
- Quản lý Commission, Payout và báo cáo hoạt động.

---

## 2. Dịch Vụ Tuyển Dụng

| Service Type | Dịch vụ | Mô tả |
|---|---|---|
| `HEADHUNT_COD` | Tuyển dụng theo mô hình hoa hồng | Trả phí khi ứng viên nhận việc thành công |
| `CV_SOURCING` | Tìm kiếm và cung cấp hồ sơ ứng viên | Cung cấp danh sách CV đạt chuẩn theo yêu cầu |
| `CV_APPLICATION` | Tiếp nhận và xử lý hồ sơ ứng tuyển | Đăng tuyển và xử lý ứng viên nộp hồ sơ trực tiếp |

---

## 3. Đối Tượng Người Dùng (Actor)

| Actor | Vai trò chính |
|---|---|
| **Guest** | Xem thông tin nền tảng và các Job tuyển dụng công khai |
| **Platform Admin** | Quản trị toàn bộ tài khoản, phân quyền hệ thống và giám sát nền tảng |
| **Internal HR / Recruiter** | Tiếp nhận, xử lý hồ sơ, phỏng vấn và điều phối quy trình tuyển dụng |
| **Client Company User** | Doanh nghiệp đối tác tạo nhu cầu tuyển dụng và đánh giá ứng viên |
| **Candidate** | Quản lý hồ sơ cá nhân, CV và nộp hồ sơ ứng tuyển |
| **Affiliate Recruiter / OPR Hub** | Cộng tác viên giới thiệu ứng viên, theo dõi tiến độ và nhận hoa hồng |

---

## 4. Kiến Trúc Backend (.NET 8 Clean Architecture & CQRS)

Dự án Backend được tổ chức theo chuẩn **Clean Architecture (Onion)** kết hợp **CQRS (MediatR)** và **Vertical Slice**:

```
        ┌─────────────────────────┐
        │  HRConnect.Presentation │  (Web API / Endpoints / Swagger / JWT)
        └────────────┬────────────┘
                     │ phụ thuộc
        ┌────────────▼────────────┐
        │ HRConnect.Infrastructure│  (PostgreSQL, EF Core, External Services)
        └────────────┬────────────┘
                     │ phụ thuộc
        ┌────────────▼────────────┐
        │  HRConnect.Application  │  (CQRS Features, Use Cases, DTOs)
        └────────────┬────────────┘
                     │ phụ thuộc
        ┌────────────▼────────────┐
        │    HRConnect.Domain     │  (Core Entities, Business Rules)
        └─────────────────────────┘
```

### Chi tiết các tầng và cấu trúc thư mục:

```text
d:/Ki_9/HRConnect/
├── .github/workflows/
│   └── ci-cd.yml               # Pipeline CI/CD tự động (GitHub Actions)
├── .env.example                # Mẫu biến môi trường (DB Connection, JWT Secret)
├── .gitignore                  # Bỏ qua file rác và file .env
├── Dockerfile                  # Đóng gói Docker multi-stage .NET 8 (Non-root user)
├── HRConnect.sln
│
├── HRConnect.Domain/           # [CORE] Chứa logic nghiệp vụ cốt lõi
│   ├── Common/                 # BaseEntity, ValueObject, DomainEvent
│   ├── Entities/               # User, Candidate, Job, Submission, Commission...
│   ├── Enums/                  # UserRole, ServiceType, JobStatus, SubmissionStatus...
│   └── Interfaces/             # Domain Interfaces
│
├── HRConnect.Application/      # [USE CASES] Xử lý nghiệp vụ & CQRS
│   ├── Common/
│   │   ├── Exceptions/         # BadRequestException, ConflictException...
│   │   ├── Interfaces/         # IPasswordHasher, IOtpService, IPhoneNormalizer...
│   │   │   └── Repositories/   # IUserRepository, ICandidateRepository, IUnitOfWork...
│   │   └── Models/             # AuthenticationSettings, EmailResult...
│   ├── Features/               # Vertical Slice theo từng Module/Feature
│   │   └── Auth/               # Module Xác thực tài khoản
│   │       ├── Commands/       # Các tác vụ thay đổi dữ liệu (Create, Update, Delete)
│   │       │   └── RegisterCandidate/ # Lát cắt Đăng ký Ứng viên (Command, Handler, Validator)
│   │       └── Queries/        # Các tác vụ đọc dữ liệu (Read-only)
│   └── DependencyInjection.cs  # Đăng ký MediatR, FluentValidation của tầng Application
│
├── HRConnect.Infrastructure/   # [INFRASTRUCTURE] Kỹ thuật và giao tiếp bên ngoài
│   ├── Migrations/             # Quản lý Database Migrations của EF Core
│   ├── Persistence/            # Kết nối PostgreSQL (ApplicationDbContext)
│   ├── Repositories/           # UserRepository, CandidateRepository, UnitOfWork...
│   ├── Services/
│   │   ├── Email/              # ResendEmailService, ResendSettings...
│   │   └── Identity/           # PasswordHasher, OtpService, PhoneNormalizer, EmailNormalizer...
│   └── DependencyInjection.cs  # Đăng ký DbContext, PostgreSQL, Services ngoài
│
└── HRConnect.Presentation/     # [PRESENTATION] Tiếp nhận HTTP Request từ Client
    ├── Endpoints/
    │   └── V1/
    │       ├── Auth/           # Minimal API Endpoints (/api/auth/register/candidate)
    │       └── Emails/         # Minimal API Endpoints (/api/v1/emails/test-send)
    ├── Program.cs              # Nạp .env, CORS, Swagger JWT, Minimal API route map
    └── appsettings.json
```

### Cơ Chế Dependency Injection Tự Quản (DI Modules)

Trong Clean Architecture, để file `Program.cs` không bị phình to hàng trăm dòng và giữ nguyên tính đóng gói, **mỗi tầng sẽ tự chịu trách nhiệm đăng ký các dịch vụ của chính nó** thông qua file `DependencyInjection.cs`:

- **`HRConnect.Application/DependencyInjection.cs`**:
  - Cung cấp hàm mở rộng: `services.AddApplicationServices()`.
  - Tự động đăng ký: MediatR, FluentValidation, Pipeline Behaviors.
- **`HRConnect.Infrastructure/DependencyInjection.cs`**:
  - Cung cấp hàm mở rộng: `services.AddInfrastructureServices(configuration)`.
  - Tự đọc chuỗi kết nối từ `.env`, cấu hình `ApplicationDbContext` với PostgreSQL (`Npgsql`), đăng ký Repositories và các dịch vụ ngoài (PasswordHasher, JWT Generator...).
- **`HRConnect.Presentation/Program.cs`**:
  - Đóng vai trò là "nhạc trưởng", chỉ cần gọi đúng **2 dòng code ngắn gọn**:
    ```csharp
    builder.Services.AddApplicationServices();
    builder.Services.AddInfrastructureServices(builder.Configuration);
    ```

---

## 5. Quy Chuẩn Phát Triển Chức Năng Mới (CQRS)

Khi phát triển một chức năng mới, hãy tạo một thư mục con tương ứng trong `Features/<Module>/`:
- **Command**: Xử lý tạo mới, cập nhật hoặc xóa dữ liệu.
- **Query**: Xử lý truy vấn, tìm kiếm hoặc đọc dữ liệu (`AsNoTracking`).

Mỗi lát cắt (Slice) gồm 4 file cơ bản:
1. `*Command.cs` hoặc `*Query.cs`: Khai báo tham số đầu vào.
2. `*Handler.cs`: Xử lý nghiệp vụ và tương tác dữ liệu.
3. `*Validator.cs`: Kiểm tra dữ liệu hợp lệ bằng `FluentValidation`.
4. `*ResponseDto.cs`: Kết quả trả về cho Client.

---

## 6. Cấu Hình Biến Môi Trường (.env)

Dự án hỗ trợ nạp cấu hình tự động từ file `.env` qua thư viện `DotNetEnv`.

### Các bước thiết lập cho thành viên mới:
1. Sao chép file `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
2. Mở file `.env` và cập nhật thông tin PostgreSQL của bạn:
   ```env
   ASPNETCORE_ENVIRONMENT=Development
   ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=hrconnect_db;Username=postgres;Password=your_password
   JwtSettings__Secret=YourSuperSecretKeyWithAtLeast32CharactersLong!123456

   # Resend Email Service
   RESEND_API_KEY=re_your_api_key_here
   Resend__ApiKey=re_your_api_key_here
   Resend__FromEmail=onboarding@resend.dev
   Resend__FromName="HRConnect System"
   ```
> [!CAUTION]
> File `.env` chứa mật khẩu nhạy cảm và đã được cấu hình trong `.gitignore`. **Tuyệt đối không push file `.env` lên GitHub.**

---

## 7. Dịch Vụ Gửi Email (Resend Email Service)

Hệ thống tích hợp dịch vụ gửi email **Resend** theo chuẩn Clean Architecture:
- **Interface**: `IEmailService` nằm trong `HRConnect.Application/Common/Interfaces/` (sử dụng được trong bất kỳ Command/Handler/Use Case nào mà không phụ thuộc vào hạ tầng bên ngoài).
- **Implementation**: `ResendEmailService` nằm trong `HRConnect.Infrastructure/Services/` gọi trực tiếp Resend REST API thông qua `HttpClient`.
- **Testing Swagger**: Bạn có thể kiểm tra gửi mail ngay tại Endpoint `POST /api/v1/emails/test-send`.
  *(Lưu ý: Với tài khoản Resend Free dùng domain mặc định `onboarding@resend.dev`, Resend chỉ cho phép gửi đến chính email bạn đã đăng ký tài khoản Resend).*


---

## 8. Quy Trình Git Flow & CI/CD

### Quy tắc phân nhánh:
- `main`: Nhánh tích hợp chung (Production).
- `feature/<ten-chuc-nang>`: Phát triển tính năng mới.
- `fix/<ten-loi>`: Sửa lỗi hệ thống.
- `docs/<noi-dung>`: Cập nhật tài liệu (tự động bỏ qua CI/CD).

### Hành vi Pipeline GitHub Actions:
- **Khi mở Pull Request vào `main`**: Tự động kích hoạt **CI** (`dotnet restore`, `dotnet build -c Release`, `dotnet test`).
- **Khi merge vào `main`**: Tự động kích hoạt **CD** ➔ Build Docker Image và đẩy lên **GitHub Container Registry (GHCR)** để deploy Production.

---

## 9. Hướng Dẫn Chạy Dự Án (Getting Started)

### Yêu cầu cài đặt:
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [PostgreSQL](https://www.postgresql.org/) (hoặc chạy qua Docker)

### Các bước chạy:
```bash
# 1. Khôi phục dependencies
dotnet restore HRConnect/HRConnect.sln

# 2. Build dự án
dotnet build HRConnect/HRConnect.sln

# 3. Chạy API Server
dotnet run --project HRConnect/HRConnect.Presentation
```

Truy cập tài liệu API Swagger UI tại:
- `https://localhost:7xxx/swagger` hoặc `http://localhost:5xxx/swagger` (có nút **Authorize 🔒** để nhập JWT Token).
