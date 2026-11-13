# Hướng dẫn Test Luồng MF-05 trên Máy Cá Nhân (Cho Tester)

Tài liệu này hướng dẫn Tester tự thiết lập dữ liệu **4 Job Headhunt mới**, danh sách **tài khoản Ứng viên & các vai trò**, và các bước kiểm thử đầy đủ cho **luồng MF-05** (Nhận việc, Bảo hành, Công nợ phí, Suất thay thế, Hoàn phí khi hết hạn suất thay thế và Hoa hồng Affiliate) ngay trên máy cá nhân.

> **🤖 Nếu Tester gửi file này cho AI Assistant / Chat để tự động setup:**  
> Hãy thực hiện tuần tự các bước sau:
> 1. Kiểm tra `HRConnect/.env` — nếu chưa có, copy từ `HRConnect/.env.example`, đảm bảo `ASPNETCORE_ENVIRONMENT=Development` và `ConnectionStrings__DefaultConnection` khớp với PostgreSQL local.
> 2. Tạo/cập nhật `HRConnect-FE/.env.local` với `VITE_API_PROXY_TARGET=http://localhost:5041` và `VITE_API_URL=` (trống) để FE gọi Backend local.
> 3. Nếu `HRConnect-FE/node_modules` chưa có, chạy `npm --prefix HRConnect-FE install`.
> 4. Chạy Backend ở chế độ nền: `dotnet run --project HRConnect/HRConnect.Presentation/HRConnect.Presentation.csproj --launch-profile http` (BE sẽ tự động migrate DB, seed tài khoản qua `DemoAccountSeeder` và nạp sẵn **4 Job Headhunt MF-05** qua `Mf05HeadhuntTestJobSeeder`).
> 5. *(Tùy chọn nếu Tester muốn toàn bộ mốc `system_setting` về 1 ngày luôn)*: chạy `HRConnect/docs/seed-4-headhunt-jobs-mf05.sql` vào PostgreSQL local.
> 6. Chạy Frontend ở chế độ nền: `npm --prefix HRConnect-FE run dev` (cổng `5173`), rồi báo lại URL + danh sách tài khoản đăng nhập cho Tester.
> 7. **Không** commit/push các file `.env`, `.env.local`.

---

## 1. Chuẩn bị môi trường (Tự động nạp 4 Job Headhunt khi chạy Backend)

### Bước 1.1: Khởi chạy Backend — Tự động tạo DB, Seed tài khoản & 4 Job Headhunt
Tại thư mục gốc dự án, chạy Backend:
```powershell
dotnet run --project HRConnect/HRConnect.Presentation/HRConnect.Presentation.csproj --launch-profile http
```
Khi Backend khởi chạy ở môi trường `Development` / `Demo` / `Testing`:
1. Hệ thống **tự động chạy migration** và **seed toàn bộ tài khoản Demo/Tester** (`DemoAccountSeeder`).
2. Hệ thống **tự động nạp sẵn 4 Job Headhunt (`HEADHUNT_COD`)** qua `Mf05HeadhuntTestJobSeeder` ở trạng thái `ACTIVE`, bảo hành **`1 ngày`**, hạn thanh toán công nợ **`1 ngày`**, đầy đủ yêu cầu & kỹ năng:

| # | Tiêu đề Job | Công ty (Client sở hữu) | Địa điểm | Lương (Gross) | Bảo hành / Công nợ |
| :-: | :--- | :--- | :--- | :--- | :---: |
| 1 | **[Headhunt] Head of DevOps & Platform Engineering (Kubernetes & AWS)** | Tester Tech Solutions (`tester.client@gmail.com`) | TP. Hồ Chí Minh | 45 – 75 triệu | `1 ngày` / `1 ngày` |
| 2 | **[Headhunt] Staff Frontend Architect (React, TypeScript & Design System)** | Tester Tech Solutions (`tester.client@gmail.com`) | Hà Nội | 40 – 65 triệu | `1 ngày` / `1 ngày` |
| 3 | **[Headhunt] Senior Product Manager (E-Commerce & Omnichannel)** | Lotus Commerce (`client5@gmail.com`) | TP. Hồ Chí Minh | 42 – 70 triệu | `1 ngày` / `1 ngày` |
| 4 | **[Headhunt] Principal Backend Engineer (Java Spring Boot & Microservices)** | HR Connect Demo Company (`client@gmail.com`) | Đà Nẵng | 48 – 78 triệu | `1 ngày` / `1 ngày` |

### Bước 1.2: Cấu hình Frontend (FE) gọi API Backend Local (`http://localhost:5041`)
Mặc định nếu chưa cấu hình, Vite sẽ trỏ về `https://localhost:7289` (hoặc server Render nếu có trong `.env`). Để FE local gọi đúng vào Backend đang chạy ở Bước 1.1:

1. Tạo (hoặc cập nhật) file `HRConnect-FE/.env.local` (có thể copy từ `HRConnect-FE/.env.example`) với nội dung:
   ```env
   VITE_API_PROXY_TARGET=http://localhost:5041
   VITE_API_URL=
   ```
   *(Lưu ý: giữ `VITE_API_URL=` trống để FE dùng proxy tương đối `/api/v1` và SignalR `/hubs/notifications` trỏ thẳng về `http://localhost:5041`; file `.env.local` đã được `.gitignore` nên không bị đẩy lên Git.)*

2. Mở một terminal khác để chạy Frontend:
   ```powershell
   npm --prefix HRConnect-FE install
   npm --prefix HRConnect-FE run dev
   ```
   Truy cập trình duyệt tại **`http://localhost:5173`**. *(Nếu trước đó đang mở `npm run dev`, nhớ tắt và chạy lại sau khi sửa `.env.local`.)*

### Bước 1.3 (Tùy chọn): Cấu hình mốc 1 ngày toàn cục trong `system_setting`
4 Job trên đã tự cấu hình sẵn bảo hành & công nợ `1 ngày`. Nếu muốn ép thêm các thông số toàn cục (hạn tìm người thay thế `1 ngày`, gia hạn `1 ngày`, nhắc phí `1 ngày`) về mốc 1 ngày để test nhanh thay vì chỉnh trong `/admin/settings`, có thể chạy thêm [`seed-4-headhunt-jobs-mf05.sql`](./seed-4-headhunt-jobs-mf05.sql).

---

## 2. Danh sách Tài khoản Test (Mật khẩu chung: `111111Aa@`)

> **Mẹo:** Mỗi vai trò nên đăng nhập ở **1 trình duyệt hoặc 1 cửa sổ ẩn danh (Incognito)** riêng để không bị ghi đè phiên đăng nhập.

### 2.1. Tài khoản Ứng viên (Candidate) — Quan trọng cho MF-02 → MF-05
Khi Affiliate giới thiệu ứng viên vào Job Headhunt, hệ thống bắt buộc nhập **đúng cặp Email + Số điện thoại** của ứng viên. Dưới đây là các tài khoản Ứng viên có sẵn:

| Email đăng nhập | Số điện thoại (nhập khi giới thiệu) | Mật khẩu | Ghi chú sử dụng |
| :--- | :--- | :---: | :--- |
| `tester.candidate@gmail.com` | `0900000051` | `111111Aa@` | Tài khoản ứng viên chính cho Tester |
| `candidate@gmail.com` | `0900000001` | `111111Aa@` | Tài khoản ứng viên demo 1 |
| `candidate2@gmail.com` | `0900000011` | `111111Aa@` | Dùng để test giới thiệu ứng viên thứ 2 / suất thay thế |

**Hướng dẫn thao tác phía Ứng viên:**
1. **Xác nhận đồng ý giới thiệu (Consent):**
   - Sau khi Affiliate nộp hồ sơ giới thiệu ứng viên, ứng viên đăng nhập vào tài khoản tương ứng -> bấm **Chuông thông báo** (hoặc vào `/candidate/applications`, mục chờ xác nhận giới thiệu để mở `/candidate/submission-consents/:id`) -> chọn **Đồng ý** (trong vòng 48h).
   - *Lưu ý:* Một cặp `(Ứng viên + Job)` chỉ được giới thiệu hợp lệ **1 lần**. Nếu muốn test thêm lượt mới trên cùng 1 Job (hoặc test **Suất thay thế** khi ứng viên cũ nghỉ việc), hãy dùng tài khoản ứng viên khác (`candidate2@gmail.com`), hoặc tự đăng ký thêm tài khoản Candidate mới ở `/register`, hoặc dùng email mới chưa có tài khoản rồi mở link xác nhận trong email/console log backend.
2. **Nhận Offer & đi làm:**
   - Khi Client gửi Offer, ứng viên vào `/candidate/applications` -> mở Offer -> bấm **Chấp nhận Offer** để chuyển sang bước Client xác nhận nhận việc (`Onboarded`) và kích hoạt **MF-05**.

### 2.2. Các tài khoản vai trò khác

| Vai trò | Bộ tài khoản Tester (khuyên dùng) | Bộ tài khoản Demo khác | Mật khẩu |
| :--- | :--- | :--- | :---: |
| **Client (Doanh nghiệp)** | `tester.client@gmail.com` *(sở hữu Job 1 & 2)* | `client5@gmail.com` *(Job 3)*, `client@gmail.com` *(Job 4)*, `client2..4@gmail.com` | `111111Aa@` |
| **Affiliate (CTV)** | `tester.affiliate@gmail.com` | `affiliate@gmail.com`, `affiliate2@gmail.com` | `111111Aa@` |
| **Internal HR** | `tester.hr@gmail.com` | `internalhr@gmail.com`, `internalhr2@gmail.com` | `111111Aa@` |
| **Platform Admin** | `tester.admin@gmail.com` | `admin@gmail.com` | `111111Aa@` |

---

## 3. Kịch bản Test nhanh luồng MF-05 trên 4 Job mới

### Kịch bản 1: Nhánh hoàn thành bảo hành & Chi trả hoa hồng
1. **Affiliate** (`tester.affiliate@gmail.com`): Vào `/affiliate/jobs`, chọn Job `[Headhunt] Head of DevOps & Platform Engineering` -> bấm **Giới thiệu ứng viên** -> nhập `tester.candidate@gmail.com` / `0900000051` + tải 1 file CV PDF.
2. **Candidate** (`tester.candidate@gmail.com`): Đăng nhập -> bấm **Chuông thông báo** hoặc vào `/candidate/applications` -> mở lượt giới thiệu -> bấm **Đồng ý**.
3. **Internal HR** (`tester.hr@gmail.com`): Vào `/hr/screening` -> kiểm tra điểm AI -> bấm **Gửi Client**.
4. **Client** (`tester.client@gmail.com`): Vào `/client/candidates` -> mời phỏng vấn -> gửi Offer -> đợi Candidate chấp nhận -> bấm **Xác nhận nhận việc (Onboarded)**.
   - Lúc này hệ thống tạo **Bảo hành 1 ngày** (`/client/warranty`) và **Công nợ phí dịch vụ** (`/client/billing`).
5. **Thanh toán công nợ phí dịch vụ:**
   - **Cách 1 (Client tự thanh toán qua VNPay Sandbox):** Tại `/client/billing` bấm **Thanh toán VNPay**, chọn Ngân hàng **NCB**:
     - Số thẻ: `9704198526191432198`
     - Tên chủ thẻ: `NGUYEN VAN A`
     - Ngày phát hành: `07/15`
     - OTP: `123456`
   - **Cách 2 (Admin ghi nhận thủ công):** Admin (`tester.admin@gmail.com`) nhận thông báo realtime -> vào `/admin/payouts` -> tab **Công nợ phí** -> ghi nhận thanh toán.
6. **Hoàn thành bảo hành & Duyệt hoa hồng:**
   - Sau 1 ngày (hoặc cập nhật `end_date = NOW() - INTERVAL '1 hour'` trong bảng `warranty` để test ngay mà không phải chờ), Worker chạy sẽ chuyển bảo hành sang `PASSED`, hoa hồng Affiliate chuyển sang `EARNED` và bắn thông báo realtime cho Admin.
   - Admin vào `/admin/payouts` -> **Duyệt** và **Chi trả** hoa hồng cho Affiliate.

### Kịch bản 2: Nhánh Ứng viên nghỉ việc -> Suất thay thế -> Hoàn phí
1. Thực hiện các bước 1 → 5 ở Kịch bản 1 trên Job thứ 2 (`[Headhunt] Staff Frontend Architect`) với ứng viên `candidate@gmail.com` (`0900000001`).
2. Khi đang trong thời gian bảo hành (`WARRANTY_ACTIVE`) và **Client đã thanh toán phí dịch vụ**:
   - **Client** vào `/client/warranty` -> bấm **Báo ứng viên nghỉ việc** (chọn lý do).
   - **Internal HR** vào `/hr/warranty-tracking` -> **Xác minh báo nghỉ** (Chấp nhận).
   - Hệ thống mở **Suất tuyển người thay thế** (thời hạn 1 ngày, tự gia hạn 1 ngày).
3. Kiểm tra 2 nhánh con:
   - **Nhánh thay thế thành công:** Affiliate giới thiệu ứng viên khác (`candidate2@gmail.com` / `0900000011`) vào chính Job đó -> đi hết quy trình đến khi nhận việc -> Suất thay thế được lấp đầy.
   - **Nhánh hết hạn suất thay thế (Hoàn phí):** Để suất thay thế hết hạn (hoặc tua `expires_at = NOW() - INTERVAL '1 hour'` trong bảng `replacement_slot` — nếu chưa gia hạn thì cần qua 2 chu kỳ worker hoặc set `extended_at` kèm `expires_at` về quá khứ) -> Hệ thống tự động tạo khoản **Hoàn phí** (`REPLACEMENT_REFUND`) theo tỷ lệ cấu hình `mf05.replacement.refund_percent` (mặc định 30%, Admin đổi được tại `/admin/settings`), chi tiết ứng viên + ngày hết hạn tại `/client/billing`, và bắn thông báo realtime cho **Platform Admin**.
     - Tại `/client/warranty` (và `/hr/warranty-tracking`), cột suất hết hạn hiện badge lấy từ khoản hoàn thật: *"Sẽ hoàn {x}% phí ({số tiền})"* khi khoản hoàn còn `PENDING`, đổi thành *"Đã hoàn {x}% phí ({số tiền})"* khi đã `PAID`. Nếu chưa có khoản hoàn thì hiện *"Đang xử lý hoàn phí"*.
     - Banner phía Client ghi *"Suất tuyển thay thế đã hết hạn & được hoàn một phần phí dịch vụ theo hợp đồng"* (không còn ghi cứng 30%).
