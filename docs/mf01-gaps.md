# MF-01 (Tạo, duyệt, công bố Job): các thiếu sót cần bổ sung

> Người nhận: người phụ trách MF-01 (backend + frontend).
> Rà soát ngày 2026-10-09 trên `main` / `dev` (commit `1f226e6`), đối chiếu với `HRConnect/docs/main-flows.md` (MF-01, mục 6.3)
> và 3 tài liệu mô hình kinh doanh `HRConnect/docs/{CV_APPLICATION, CV_SOURCING, HEADHUNT_COD}*.md`.
> Mỗi mục có: hiện trạng, bằng chứng (file:dòng), việc cần làm, tiêu chí nghiệm thu.

## Phần đã ổn (không cần làm lại)

- Vòng đời `DRAFT → PENDING_REVIEW → ACTIVE ⇄ PAUSED → CLOSED`, `REJECTED` có mã lý do, lịch sử trạng thái.
- Ma trận Service Type × phạm vi hiển thị được kiểm tra ở backend (`JobAccessPolicy.IsVisibilityAllowedForServiceType`).
- Khóa đổi Service Type sau khi rời `DRAFT`; chống ghi đè đồng thời bằng `concurrencyToken`.
- Ma trận vai trò xem/nộp theo Service Type (`service_type_allowed_role`) đúng với tài liệu: Candidate chỉ nộp `CV_APPLICATION`; Affiliate chỉ xem/nộp `CV_SOURCING`, `HEADHUNT_COD`.

## Đã sửa sẵn, chưa merge: đừng làm lại

Nhánh `fix/fe-requirement-level-wrap` (chưa push) có 2 commit cho form tạo job:

1. Nút "Bắt buộc / Ưu tiên" bị rớt dòng do cột 145px quá hẹp → cột tự giãn, nút không xuống dòng.
2. Ẩn tạm phạm vi **"Nội bộ" (`INTERNAL_ONLY`)** trên form: tin nội bộ không Candidate/Affiliate nào thấy, và Internal HR chưa nộp
   hồ sơ thay ứng viên được, nên tin đó không bao giờ có hồ sơ. Job đã lưu ở `INTERNAL_ONLY` vẫn giữ lựa chọn khi sửa.
   Backend không đổi. Khi làm xong mục **B4** bên dưới thì bỏ dòng lọc trong `JobFormPage.tsx` (tìm `savedAsInternal`).

---

## A. Lỗi / sai lệch cần sửa trước

### A1. Admin không duyệt được job trên giao diện — Cao

- **Hiện trạng:** backend cho phép (Platform Admin có quyền `job.review`, `ReviewerCan` nhận cả `PLATFORM_ADMIN`), tài liệu ghi
  "Internal HR (Platform Admin làm thay được)". Nhưng frontend không có trang:
  - `HRConnect-FE/src/app/router.tsx:172` — `/admin/jobs` chuyển về `/admin/dashboard`.
  - `HRConnect-FE/src/features/admin-console/AdminApprovalsPage.tsx` chỉ có loại `CLIENT`, `AFFILIATE`, không có `JOB`.
- **Cần làm:** thêm trang duyệt job cho Admin (có thể tái sử dụng `features/jobs-mf01/JobReviewPage.tsx`) và route `/admin/jobs`,
  hoặc thêm loại `JOB` vào trang Approvals.
- **Nghiệm thu:** đăng nhập `admin@gmail.com` → thấy hàng chờ job `PENDING_REVIEW` → duyệt / từ chối có mã lý do được.

### A2. Seeder tạo job sai phạm vi hiển thị — Cao

- **Hiện trạng:** `HRConnect/HRConnect.Infrastructure/Persistence/Seed/CandidateTestJobSeeder.cs` không gán `Visibility`, nên database dùng
  mặc định `PUBLIC`. Trên database local hiện có **6 job `CV_SOURCING` và 6 job `HEADHUNT_COD` ở `PUBLIC`**, trái ma trận
  (hai loại này chỉ được `PARTNER_ONLY` / `INTERNAL_ONLY`). Seeder đi vòng qua quy tắc mà API áp dụng.
  Chú thích đầu file (dòng 18) còn ghi "CV_SOURCING: cả Ứng viên và Affiliate đều được nộp" — sai với tài liệu và với
  `service_type_allowed_role` (Candidate không nộp được `CV_SOURCING`).
- **Cần làm:** gán `Visibility` đúng theo Service Type khi seed (`CV_APPLICATION` → `PUBLIC`, hai loại kia → `PARTNER_ONLY`); sửa chú thích;
  thêm migration/SQL sửa dữ liệu seed đã có; nên thêm CHECK constraint ở database cho ma trận này để không dữ liệu nào lọt qua.
- **Nghiệm thu:** `select s.code, j.visibility, count(*) from job j join service_type s using(service_type_id) group by 1,2` không còn
  `CV_SOURCING|PUBLIC` hay `HEADHUNT_COD|PUBLIC`.

### A3. Client không được thông báo khi job được duyệt / bị từ chối — Trung bình

- **Hiện trạng:** các command `ApproveJob`, `RejectJob` (`HRConnect.Application/Features/Jobs/Commands/`) không tạo thông báo.
  Client chỉ biết khi tự mở lại danh sách. Bảng `notification` đã cho phép loại `JOB`.
- **Cần làm:** tạo notification (loại `JOB`) cho người tạo job khi duyệt / từ chối (kèm mã lý do), theo mẫu
  `INotificationRepository` đang dùng ở MF-02.
- **Nghiệm thu:** HR từ chối job → chuông thông báo của Client có tin kèm lý do; bấm vào mở đúng job.

### A4. Khung xem trước ghi sai đối tượng — Thấp

- **Hiện trạng:** `HRConnect-FE/src/features/jobs-mf01/JobFormPage.tsx:822` luôn ghi "Ứng viên sẽ thấy", kể cả với job `PARTNER_ONLY`
  (ứng viên không thấy).
- **Cần làm:** đổi tiêu đề theo phạm vi: "Ứng viên và khách sẽ thấy" (`PUBLIC`) / "Affiliate sẽ thấy" (`PARTNER_ONLY`) /
  "Chỉ nội bộ thấy" (`INTERNAL_ONLY`).

---

## B. Chức năng còn thiếu so với tài liệu

### B1. Gói đăng tin cho `CV_APPLICATION` — Cao (dịch vụ này hiện không có doanh thu)

- **Tài liệu:** `CV_APPLICATION – Service Fee Model.md` mục 4–5, 10: luồng đúng là
  *tạo job → chọn gói → phát sinh phí → kích hoạt gói → đăng tin*. Gói **FREE** và **STANDARD 1.500.000đ / job / 30 ngày**.
  Phí theo gói, không theo số hồ sơ, không theo placement (BR-CVA-04, 06, 07).
- **Hiện trạng:** chưa có bước chọn gói, chưa có bảng gói, chưa có thời hạn đăng tin; job `ACTIVE` không bao giờ hết hạn.
- **Cần làm:** bảng gói (tên, giá, số ngày, trạng thái), chọn gói khi tạo job `CV_APPLICATION`, bản ghi phí gói + Admin ghi nhận thanh toán,
  job tự hết hạn khi hết số ngày của gói. **Giá và số ngày phải cấu hình được** (BR-CVA-09).
- **Nghiệm thu:** job `CV_APPLICATION` gói STANDARD chỉ công bố sau khi gói được kích hoạt; quá 30 ngày tự chuyển trạng thái hết hạn;
  đổi giá gói không cần sửa code.

### B2. Giới hạn gói FREE — Trung bình

- **Tài liệu:** đề tài + `main-flows.md` MF-01: "1 job mở tại một thời điểm, chu kỳ mở lại 2 tháng" — đang ghi **[CHƯA CÓ CODE]**.
- **Cần làm:** chặn gửi duyệt / mở lại khi công ty gói FREE đã có job mở hoặc chưa đủ chu kỳ; báo lỗi rõ ràng trên form.
  Hai con số (1 job, 2 tháng) **phải cấu hình được**.
- **Nghiệm thu:** công ty FREE có 1 job `ACTIVE` → gửi duyệt job thứ hai bị từ chối với thông báo rõ.

### B3. Trường riêng theo Service Type trên job — Cao

- **Tài liệu:** `main-flows.md` mục 6.3: "Sourcing Target, hệ số phí, thời hạn bảo hành, gói đăng tin trên job — MF-01";
  `CV_SOURCING – Business Model.md` mục 1 (BR-CVS-02: `Hiring Quantity` và `Sourcing Target` độc lập);
  `HEADHUNT_COD…md` mục 4: lưu `FeeMultiplier` theo hợp đồng thay vì cố định 1,5.
- **Hiện trạng:** form và bảng `job` chỉ có `Quantity`.
- **Cần làm:**
  - `CV_SOURCING`: thêm **Sourcing Target** (số CV đạt chuẩn Client mua), bắt buộc khi gửi duyệt, khác với số lượng cần tuyển.
  - `HEADHUNT_COD`: cho phép ghi đè **hệ số phí** và **số ngày bảo hành** theo job (mặc định lấy từ cấu hình; MF-05 đang đọc
    `Mf05Settings` — cần ưu tiên giá trị trên job nếu có).
  - `CV_APPLICATION`: gắn gói đăng tin (mục B1).
  - Form chỉ hiện các trường đúng với Service Type đã chọn.
- **Nghiệm thu:** job `CV_SOURCING` không gửi duyệt được nếu thiếu Sourcing Target; MF-05 dùng hệ số phí của job khi có.

### B4. Tin "Nội bộ" chưa có cách nhận hồ sơ — Trung bình

- **Hiện trạng:** `service_type_allowed_role` cho `INTERNAL_HR` `can_submit = true` với `CV_SOURCING`, `HEADHUNT_COD`, nhưng chưa có
  chức năng Internal HR nộp hồ sơ thay ứng viên (`main-flows.md` MF-02 ghi **[CHƯA CÓ CODE]**). Vì vậy `INTERNAL_ONLY` đang bị ẩn
  tạm trên form (xem phần "Đã sửa sẵn").
- **Cần làm (phối hợp MF-02):** chức năng Internal HR nộp hồ sơ vào job; xong thì mở lại lựa chọn "Nội bộ".

---

## C. Cấu hình — không viết cứng con số

Quy định của nhóm: **mọi con số nghiệp vụ phải cấu hình được**, giá trị lấy từ tài liệu mô hình kinh doanh.

| Con số | Hiện trạng | Cần làm |
|---|---|---|
| Ma trận Service Type × phạm vi hiển thị | Viết cứng ở 2 nơi: `JobAccessPolicy.cs:45-60` (backend) và `HRConnect-FE/src/features/jobs-mf01/jobDisplay.ts:57-60` (frontend chép lại) | Lưu theo Service Type trong database; frontend lấy từ API thay vì chép |
| Service Type mới do Admin tạo | `JobAccessPolicy.cs:59` trả `false` cho mọi phạm vi (`_ => false`) → tạo được Service Type nhưng **không tạo nổi job nào** | Chọn một: (a) Admin chỉ sửa tên/mô tả/bật-tắt/ma trận vai trò, bỏ tạo/xóa Service Type; hoặc (b) cấu hình ma trận phạm vi trong DB như dòng trên |
| Giá/thời hạn gói, giới hạn FREE, Sourcing Target, hệ số phí | Chưa có | Làm theo B1–B3, giá trị cấu hình được |

---

## Thứ tự gợi ý

1. **A2** (dữ liệu seed sai làm test MF-02/MF-03 sai theo) → **A1** → **A3** → **A4**.
2. **B3** (trường theo Service Type) → **B1** (gói `CV_APPLICATION`) → **B2** (giới hạn FREE) → **B4** cùng người làm MF-02.
3. **C** làm cùng lúc với B1–B3.

## Quy trình

- Theo `CLAUDE.md`: chạy GitNexus `impact` trước khi sửa symbol có sẵn, `detect-changes` trước khi commit.
- Thêm test cho mỗi mục (backend `HRConnect.UnitTests`, frontend `vitest`), cập nhật trạng thái **[CHƯA CÓ CODE]** trong
  `HRConnect/docs/main-flows.md` khi xong.
- Kịch bản test tay MF-01 (tạo 3 loại job, duyệt / từ chối, ai thấy job) có thể dùng lại để nghiệm thu.
