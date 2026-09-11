# HR Connect

**AI-Powered Recruitment & Affiliate Headhunting Platform**

HR Connect là nền tảng web hỗ trợ Agency quản lý hoạt động tuyển dụng, kết nối doanh nghiệp, ứng viên và mạng lưới cộng tác viên tuyển dụng (Affiliate/OPR).

Hệ thống tập trung thông tin tuyển dụng, hỗ trợ đánh giá CV bằng AI, theo dõi nguồn giới thiệu và quản lý quyền lợi Affiliate.

> Dự án Capstone — SEP490, FPT University.
> Trạng thái: Đang phát triển.

## 1. Mục tiêu

- Tập trung hóa thông tin doanh nghiệp, Job, ứng viên và CV.
- Hỗ trợ ba loại dịch vụ tuyển dụng trên một nền tảng.
- Nhận diện hồ sơ trùng và truy vết nguồn giới thiệu.
- Sử dụng AI hỗ trợ đối chiếu CV với Job Description.
- Theo dõi tiến độ và kết quả xử lý hồ sơ.
- Quản lý Commission, Payout và báo cáo hoạt động.

## 2. Dịch vụ tuyển dụng

| Service Type | Dịch vụ |
|---|---|
| `HEADHUNT_COD` | Tuyển dụng theo mô hình hoa hồng |
| `CV_SOURCING` | Tìm kiếm và cung cấp hồ sơ ứng viên |
| `CV_APPLICATION` | Tiếp nhận và xử lý hồ sơ ứng tuyển |

Quy trình, đầu ra và điều kiện tài chính của từng dịch vụ được mô tả trong tài liệu nghiệp vụ của dự án.

## 3. Actor

| Actor | Vai trò chính |
|---|---|
| Guest | Xem thông tin nền tảng và Job công khai |
| Platform Admin | Quản trị tài khoản, quyền truy cập và giám sát nền tảng |
| Internal HR / Recruiter | Xử lý hồ sơ và điều phối tuyển dụng |
| Client Company User | Tạo nhu cầu tuyển dụng và đánh giá hồ sơ được chia sẻ |
| Candidate | Quản lý hồ sơ cá nhân và tham gia ứng tuyển |
| Affiliate Recruiter / OPR Hub | Giới thiệu ứng viên, theo dõi hồ sơ và quyền lợi |

## 4. Core Modules

1. **Company & Job Management**
   Quản lý doanh nghiệp, nhu cầu tuyển dụng và thông tin Job.

2. **Candidate, CV & Submission Management**
   Quản lý hồ sơ, tiếp nhận CV, kiểm tra trùng và ghi nhận nguồn.

3. **AI Matching & Screening Support**
   Phân tích mức độ phù hợp giữa CV và JD, cung cấp thông tin hỗ trợ sàng lọc.

4. **Recruitment Workflow & Outcome Management**
   Theo dõi quá trình xử lý hồ sơ và kết quả tuyển dụng theo dịch vụ.

5. **Affiliate, Commission & Reporting Management**
   Quản lý Affiliate, quyền lợi hoa hồng, lịch sử chi trả và báo cáo.

Các chức năng dùng chung gồm quản lý tài khoản, kiểm soát truy cập, thông báo và lịch sử xử lý.

## 5. Main Flows

| Mã | Luồng nghiệp vụ |
|---|---|
| MF-01 | Tạo, duyệt và công bố Job |
| MF-02 | Tiếp nhận hồ sơ, kiểm tra trùng và ghi nhận nguồn |
| MF-03 | AI Matching và hỗ trợ sàng lọc |
| MF-04 | Tuyển chọn và tuyển dụng ứng viên |
| MF-05 | Theo dõi hậu tuyển dụng, Commission và Payout |

Các luồng được áp dụng theo dịch vụ và điều kiện nghiệp vụ. Không mặc định mọi hồ sơ đều phát sinh Commission.

## 6. Nguyên tắc nghiệp vụ

- Candidate và CV là hai khái niệm khác nhau.
- Submission ghi nhận lần gửi hồ sơ; Application thể hiện hồ sơ ứng tuyển tại một Job.
- Người thực hiện thao tác gửi có thể khác nguồn giới thiệu.
- Việc tiếp nhận hồ sơ không tự động xác lập quyền hưởng hoa hồng.
- Commission và Payout được theo dõi riêng.
- AI chỉ hỗ trợ đánh giá; quyết định tuyển chọn thuộc về con người.
- Quyền xem dữ liệu phụ thuộc vai trò và phạm vi được cấp.
- Quy tắc kiểm tra trùng và attribution tuân theo phiên bản Business Rules đã được xác nhận.

## 7. Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | C# / ASP.NET Core |
| Frontend | Đang cập nhật |
| Database | Đang cập nhật |
| AI Matching | Đang cập nhật |
| Quản lý mã nguồn | Git / GitHub |

Phiên bản công nghệ và hướng dẫn cài đặt sẽ được cập nhật theo mã nguồn triển khai.

## 8. Cấu trúc repository dự kiến

```text
hr-connect/
├── frontend/       # Mã nguồn giao diện
├── backend/        # Solution và các project .NET
├── docs/           # Tài liệu nghiệp vụ và kỹ thuật
├── .github/        # Pull Request template và CI
├── .gitignore
├── .env.example    # Mẫu biến môi trường
└── README.md
```

Thư mục `ai-service/` chỉ được bổ sung nếu AI được triển khai thành service riêng.

## 9. Thiết lập và chạy dự án

Hướng dẫn chạy đang được hoàn thiện.

Sau khi khởi tạo mã nguồn, nhóm sẽ bổ sung:

- Phiên bản SDK và công cụ cần cài đặt.
- Cách cấu hình môi trường phát triển.
- Cách khởi tạo database.
- Lệnh chạy backend và frontend.
- Địa chỉ truy cập giao diện và tài liệu API.
- Lệnh chạy kiểm thử.

## 10. Quy trình đóng góp

### Nhánh

- `main`: Nhánh tích hợp chung.
- `feature/<ten-chuc-nang>`: Phát triển chức năng.
- `fix/<ten-loi>`: Sửa lỗi.
- `docs/<noi-dung>`: Cập nhật tài liệu.

### Quy trình làm việc

1. Cập nhật mã nguồn mới nhất từ `main`.
2. Tạo nhánh cho công việc cần thực hiện.
3. Phát triển và kiểm tra thay đổi.
4. Tạo Pull Request, mô tả nội dung và cách kiểm tra.
5. Nhờ thành viên khác review trước khi merge.

### Ví dụ commit

- `feat: add candidate submission`
- `fix: correct duplicate detection`
- `docs: update recruitment main flows`

## 11. Bảo vệ dữ liệu và cấu hình

- Không commit mật khẩu database, API key hoặc JWT secret.
- Chỉ đưa cấu hình mẫu không chứa thông tin bí mật vào repository.
- Không đưa CV thật hoặc dữ liệu cá nhân của ứng viên vào mã nguồn.
- Sử dụng dữ liệu giả lập cho phát triển và kiểm thử.
- Không ghi thông tin nhạy cảm vào log hoặc nội dung Pull Request.

## 12. Tài liệu dự án

Tài liệu được quản lý trong thư mục `docs/`, gồm:

- Problem Analysis.
- Actor.
- Objectives.
- Scope.
- Business Capabilities / Core Modules.
- Core Blueprint và Main Flows.
- Business Rules và Decision Log.
- Use Cases và Acceptance Criteria.
- Thiết kế hệ thống và hướng dẫn kiểm thử.

Các thay đổi nghiệp vụ cần được cập nhật vào tài liệu liên quan để giữ thống nhất với mã nguồn.

## 13. Nhóm thực hiện

| Thành viên | Mã sinh viên |
|---|---|
| Trương Hoàng Quí | SE184355 |
| Lê Thị Trà Mi | SE184379 |
| [Cao Hữu Trí | SE184047 |
| Khúc Ngọc Sơn | SE184040 |
| Nguyễn Văn Sang | SE183276 |

**Giảng viên hướng dẫn:** Phạm Minh Trí
