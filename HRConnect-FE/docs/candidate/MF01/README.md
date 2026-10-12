# MF-01 — Candidate Jobs và Notification UI

## Chức năng hiện đã có để gắn UI

- Guest/Candidate xem danh sách Job công khai và chi tiết Job.
- Candidate đi từ Job detail sang flow ứng tuyển MF-02.
- FE đã có route `/candidate/jobs` và `/candidate/jobs/:jobId` cùng service Job hiện tại.
- Hệ thống đã có entity notification và nhiều module đã tạo notification nghiệp vụ.

Dev cần đối chiếu Swagger/BE hiện tại trước khi gắn vì contract Job có thể tiếp tục được chỉnh theo business MF-01.

## UI cần hoàn thiện

### `/candidate/jobs`

- Search tên Job, kỹ năng hoặc Company.
- Filter location, employment type và service label phù hợp Candidate.
- Pagination backend; giữ filter trên URL.
- Chỉ hiển thị Job public, còn nhận hồ sơ và đúng policy.
- Empty state phân biệt chưa có Job với không khớp bộ lọc.

### `/candidate/jobs/:jobId`

- Hiển thị mô tả, yêu cầu, quyền lợi, thông tin doanh nghiệp tuyển dụng, location, hình thức, salary công khai và hạn nhận hồ sơ.
- Job đóng/hết hạn phải vô hiệu hóa nút ứng tuyển và có lời giải thích.
- Không trả/hiện phí dịch vụ, commission rule hoặc ghi chú nội bộ.

#### Khối “Thông tin doanh nghiệp tuyển dụng”

Đặt sau nội dung Job hoặc ở cột bên cạnh trên màn desktop. Trên màn nhỏ, khối này nằm sau quyền lợi và trước hành động ứng tuyển cuối trang.

Hiển thị:

- Logo doanh nghiệp; nếu chưa có logo thì dùng chữ cái đầu của tên doanh nghiệp, không gọi dịch vụ avatar bên thứ ba.
- Tên doanh nghiệp.
- Nhãn “Đã xác minh” khi backend trả `isVerified = true`.
- Ngành nghề và quy mô.
- Địa chỉ công khai.
- Website với liên kết mở ở tab mới và có `rel="noopener noreferrer"`.
- Phần giới thiệu doanh nghiệp dạng plain text, giữ xuống dòng và không render HTML từ backend.

Không hiển thị:

- Mã số thuế, hồ sơ pháp lý và tài liệu xác minh.
- Tên, email, số điện thoại của người liên hệ nội bộ.
- `roleInCompany`, `isPrimaryContact`, ghi chú Admin hoặc lịch sử duyệt.
- Các trạng thái nội bộ ngoài thông tin “Đã xác minh”.

Trạng thái UI:

- Không có logo: hiển thị initials ổn định theo tên doanh nghiệp.
- Trường tùy chọn rỗng: ẩn riêng dòng đó, không tạo một khối chứa nhiều dấu `—`.
- Response cũ hoặc dữ liệu Company chưa đầy đủ: vẫn cho xem Job và `companyName`; khối doanh nghiệp chỉ hiển thị các trường thực sự có dữ liệu.
- Job hoặc doanh nghiệp không còn đủ điều kiện công khai: backend trả `404`; FE không tiết lộ nguyên nhân nội bộ.

### Notification trong Candidate Shell

- Gắn unread count, danh sách phân trang, đánh dấu đọc và đánh dấu tất cả đã đọc.
- Deep-link theo entity: consent → MF-02 consent; application → application detail; interview/offer → MF-04.
- Không hard-code số thông báo hoặc dùng raw payload làm nội dung.

## Contract backend còn phải chốt/cập nhật

Khi sửa BE, cập nhật ngay endpoint thực tế, permission, DTO, sort/filter/pagination và response mẫu vào mục này; sau đó sửa `src/services/api/mf01`.

FE cần backend trả đủ:

- `canView/canApply` hoặc trạng thái công khai giúp UI biết Job còn hành động được không.
- Notification title/body/time/read state và target có thể điều hướng.
- Ownership chặt chẽ; không trả notification của user khác.

## Test UI

1. Search/filter/pagination giữ sau refresh.
2. Job private/draft/hết hạn không xuất hiện sai policy.
3. Job đóng hiển thị lý do và không mở apply.
4. Job detail hiển thị đúng public company DTO; không có `taxCode` hoặc dữ liệu người liên hệ trong response.
5. Company thiếu các trường tùy chọn vẫn hiển thị gọn, không làm hỏng trang Job.
6. Website không hợp lệ không được tạo thành liên kết có thể bấm.
7. Guest không thể dùng Job detail để đọc doanh nghiệp của Job private/partner-only.
8. Unread count khớp danh sách sau mark read/read all.
9. Notification deep-link đúng route của MF-02/MF-04.
