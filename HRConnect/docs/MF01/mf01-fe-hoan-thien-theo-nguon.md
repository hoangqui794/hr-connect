# MF-01 (Giao diện): hoàn thiện theo thông lệ của các trang tuyển dụng và luật lao động

> **Dành cho:** dev giao diện MF-01. Phần backend và **nguồn căn cứ** xem [`mf01-be-hoan-thien-theo-nguon.md`](mf01-be-hoan-thien-theo-nguon.md). Mã mục H1–H5 dùng chung với tài liệu backend.
> **Ngày:** 2026-10-15.
> **Điều kiện:** pull `main` mới nhất. Mỗi mục chỉ gắn được khi backend của mục đó đã xong. Không dùng dữ liệu giả trong code giao diện (chỉ dùng trong file test).

Ký hiệu: 🔴 làm trước · 🟠 cần làm · 🟡 việc nhỏ.

---

## H1. 🔴 Báo cáo tin tuyển dụng

### H1.a Nút "Báo cáo tin" (ứng viên, Affiliate)

- **Vị trí:** cuối trang chi tiết tin, ở `features/jobs-mf01/PublicJobPages.tsx` (trang tin công khai và trang tin trong app) và trang tin của ứng viên `features/portal/candidate/CandidateJobPages.tsx`. Dạng link nhỏ có icon cờ, giống Indeed và TopCV: "Báo cáo tin tuyển dụng".
- **Chỉ hiện khi** tài khoản có quyền `job.report` (`hasPermission` trong `stores/authStore.ts`). Khách chưa đăng nhập bấm vào thì chuyển sang trang đăng nhập rồi quay lại tin.
- **Modal báo cáo:**
  - Radio chọn lý do: `ASKS_FOR_MONEY` "Đòi nộp tiền, phí, đặt cọc", `FAKE_COMPANY` "Công ty không có thật hoặc mạo danh", `MISLEADING_INFO` "Thông tin lương, địa điểm, công việc sai sự thật", `DISCRIMINATION` "Phân biệt giới tính, độ tuổi…", `ALREADY_CLOSED` "Tin đã tuyển xong nhưng vẫn mở", `OTHER` "Lý do khác".
  - Ô ghi chú, **bắt buộc khi chọn "Lý do khác"**, tối đa 2000 ký tự, có bộ đếm.
  - Thêm dòng nhắc: "HR Connect không bao giờ yêu cầu ứng viên nộp tiền để ứng tuyển."
- **Sau khi gửi:** "Cảm ơn bạn. HR Connect sẽ xem xét và thông báo kết quả." Nếu API trả **409 `JOB_REPORT_ALREADY_OPEN`** thì hiện "Bạn đã báo cáo tin này, chúng tôi đang xem xét." và không cho gửi lại.

### H1.b Màn "Báo cáo tin" (Internal HR, Admin)

- Route `/hr/job-reports` và `/admin/job-reports`, thêm vào `app/router.tsx` và `routes/AppRoutes.tsx`. Mục menu **"Báo cáo tin"** trong `HrLayout.tsx` và `AdminLayout.tsx`, có badge số tin đang có báo cáo mở. Chỉ hiện với quyền `job.review`.
- **Danh sách gom theo tin:** tên tin, công ty, số báo cáo đang mở, các lý do (nhãn), ngày báo cáo gần nhất. Tin có `reportFlagged` lên đầu, có nhãn đỏ "Nhiều báo cáo".
- **Bấm vào một tin:**
  - Hiện chi tiết tin, dùng lại `JobDetailPanel`.
  - Hiện danh sách báo cáo: lý do, ghi chú, thời gian. Không hiện tên người báo cáo cho Client.
  - Hai nút: **"Gỡ tin"** (`UNPUBLISH`, màu đỏ, hỏi xác nhận, bắt buộc ghi chú vì Client sẽ đọc) và **"Giữ tin"** (`KEEP`, bắt buộc ghi chú nội bộ).
- Ở trang duyệt job (`JobReviewPage.tsx`), tin có `reportFlagged` hiện nhãn "Có báo cáo", bấm vào thì mở màn này.

---

## H2. 🟠 Đóng job khi còn hồ sơ đang xử lý

Ở `ClientJobsListPage.tsx`, nút **"Đóng tin"** hiện mở `ReasonModal`. Sửa thành:

1. Khi mở modal, gọi `GET /jobs/{id}/close-impact` và hiện **trước khi Client xác nhận**:
   > Tin này còn **4 hồ sơ đang xử lý** (3 mới nộp, 1 đang phỏng vấn) và **1 lịch phỏng vấn**. Khi đóng tin, các hồ sơ này sẽ dừng và ứng viên, cộng tác viên giới thiệu sẽ được thông báo.
2. Có hồ sơ đang mở thì bắt buộc tick **"Tôi hiểu, đóng các hồ sơ đang xử lý"**, rồi gửi `openApplicationsAction: "CLOSE_ALL"`.
3. Có `pendingOffers > 0` (hoặc API trả **409 `JOB_HAS_PENDING_OFFERS`**) thì **khóa nút đóng**, kèm câu: "Còn offer đang chờ ứng viên trả lời. Hãy rút offer trước khi đóng tin." và link sang màn offer.
4. Không có hồ sơ đang mở thì giữ nguyên luồng đóng tin như hiện tại.
5. Đóng xong hiện "Đã đóng tin và dừng 4 hồ sơ. Ứng viên đã được thông báo."

---

## H3. 🟠 Sửa nhỏ tin đang tuyển

- Ở chi tiết tin của Client (trạng thái `ACTIVE` hoặc `PAUSED`), thêm nút **"Sửa nhanh"**.
- Mở Drawer **chỉ gồm các ô được sửa**: Mô tả công việc, Quyền lợi, Thời gian làm việc, Ghi chú lương, Hạn nhận hồ sơ. Hạn nhận hồ sơ **chỉ cho chọn ngày sau** ngày hiện tại của tin, gửi theo UTC như form tạo job.
- Đầu Drawer ghi rõ: "Tin vẫn đang tuyển trong lúc sửa. Muốn đổi tên vị trí, địa điểm, lương hoặc yêu cầu, vui lòng đóng tin và đăng tin mới."
- Gửi `PATCH /jobs/{id}/live-edit` kèm `concurrencyToken`. Lỗi **400 `FIELD_NOT_EDITABLE_WHEN_ACTIVE`** thì hiện lỗi ngay dưới ô tương ứng. Lỗi **409** thì báo "Tin vừa được cập nhật, vui lòng tải lại."
- **Phía HR** (`JobReviewPage.tsx`):
  - Thêm tab **"Đã sửa sau duyệt"** (`status=EDITED`).
  - Mỗi tin hiện thời gian sửa và nội dung trước, sau (lấy từ lịch sử trạng thái hoặc audit).
  - Nút **"Đã xem"** gọi `acknowledge-edit`. Thấy vi phạm thì chuyển sang màn H1.b để gỡ tin.

---

## H4. 🟡 Lý do từ chối mới

Thêm vào `REJECT_REASONS` và `REASON_CODE_LABEL` trong `features/jobs-mf01/jobDisplay.ts`:

| Mã | Nhãn |
|---|---|
| `REJECTED_TERMS_NOT_AGREED` | Chưa thống nhất điều khoản thương mại (**backend đã có**, giao diện đang thiếu) |
| `REJECTED_DISCRIMINATORY_CONTENT` | Nội dung phân biệt đối xử (giới tính, độ tuổi…) |
| `CLOSED_POLICY_VIOLATION` | Gỡ tin do vi phạm chính sách (hiện ở lịch sử trạng thái) |
| `EDITED_WHILE_ACTIVE` | Sửa khi đang tuyển (hiện ở lịch sử trạng thái) |

Khi chọn `REJECTED_DISCRIMINATORY_CONTENT`, hiện gợi ý cho HR: "Chỉ từ chối khi yêu cầu giới tính hoặc độ tuổi không xuất phát từ đặc thù công việc (BLLĐ 2019, Điều 3 khoản 8)."

---

## H5. 🟡 Việc nhỏ

- **H5.1:** form tạo job đã gửi hạn nộp theo UTC, không cần sửa. Chỉ cần kiểm tra lại các form khác có gửi ngày (ví dụ "Sửa nhanh" ở H3) cũng gửi theo UTC.
- **H5.2:** hệ số phí mặc định là cấu hình phía backend. Giao diện không ghi cứng số này: khung chốt điều khoản đã đọc số mặc định từ API.

---

## Tiêu chí nghiệm thu giao diện

1. Ứng viên thấy link "Báo cáo tin tuyển dụng" ở cuối tin. Gửi được báo cáo. Gửi lại khi báo cáo cũ còn mở thì thấy thông báo "đang xem xét". Client không thấy nút báo cáo.
2. HR thấy menu "Báo cáo tin" có badge. Tin nhiều báo cáo nằm trên cùng. Gỡ tin và giữ tin đều bắt buộc ghi chú. Gỡ xong tin biến mất khỏi trang tìm việc.
3. Client đóng tin còn hồ sơ thì thấy số hồ sơ bị ảnh hưởng **trước khi** xác nhận. Còn offer đang chờ thì nút đóng bị khóa.
4. "Sửa nhanh" chỉ có các ô được phép. Tin vẫn ở trạng thái Đang tuyển sau khi sửa. HR thấy tin trong tab "Đã sửa sau duyệt".
5. Trang duyệt có đủ lý do từ chối mới. Lịch sử trạng thái hiện đúng nhãn tiếng Việt cho các mã mới.
6. Không có danh sách lý do hay số liệu nào ghi cứng ngoài bảng nhãn ở `jobDisplay.ts`. Dùng được bằng bàn phím. Giao diện không vỡ ở chiều rộng 390 px.
7. Có test (Vitest) cho các hàm API mới trong `jobsApi.test.ts`.

## Thứ tự gợi ý

H4 (nhỏ, làm ngay vì backend đã có `REJECTED_TERMS_NOT_AGREED`) → **H1** → **H2** → H3.
