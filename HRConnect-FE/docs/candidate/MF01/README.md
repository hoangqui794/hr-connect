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

### Contract doanh nghiệp công khai bắt buộc bổ sung

Hiện `JobDto` chỉ trả `companyId` và `companyName`. Endpoint hồ sơ doanh nghiệp hiện có là `GET /api/v1/companies/profile/me`, chỉ dành cho Client đang đăng nhập và còn chứa dữ liệu nội bộ, nên FE Candidate không được dùng endpoint này.

MF-01 cần tạo response chi tiết Job riêng (ví dụ `JobDetailDto`) cho `GET /api/v1/jobs/{jobId}` và bổ sung object chỉ đọc `company`. Danh sách `GET /api/v1/jobs` và `GET /api/v1/public/jobs` tiếp tục dùng DTO gọn với `companyId` và `companyName`. Không nên để FE gọi `/companies/profile/me`, không lấy toàn bộ entity `Company`, và không trả `taxCode` rồi yêu cầu FE tự ẩn.

Contract đề xuất:

```json
{
  "jobId": "uuid",
  "companyId": "uuid",
  "companyName": "HR Connect Demo Company",
  "company": {
    "companyId": "uuid",
    "companyName": "HR Connect Demo Company",
    "logoUrl": null,
    "industry": "Công nghệ thông tin",
    "companySize": "51-200",
    "website": "https://hrconnectvn.online",
    "address": "Thành phố Hồ Chí Minh",
    "description": "Mô tả doanh nghiệp",
    "isVerified": true
  }
}
```

Quy tắc BE:

1. Chỉ trả object `company` khi người gọi có quyền xem Job theo `JobAccessPolicy` hiện tại. Guest chỉ xem được Job `ACTIVE`, `PUBLIC` và đúng Service Type dành cho Candidate.
2. Dữ liệu lấy cùng query Job đã include `Company`; không phát sinh truy vấn riêng cho từng Job.
3. Public DTO chỉ gồm các trường trong contract trên. Tuyệt đối không có `taxCode`, contact person, hồ sơ xác minh hoặc metadata Admin.
4. `isVerified` là boolean công khai được suy ra từ trạng thái xác minh hợp lệ; không đưa toàn bộ state machine duyệt ra FE.
5. `website` phải được chuẩn hóa và chỉ cho phép `http/https`. `description` trả dạng text.
6. Nếu bổ sung logo thật, cần thêm `logoObjectKey` hoặc trường tương đương vào DB và tạo URL đọc an toàn ở backend. Không lưu presigned URL hết hạn vào DB. Khi chưa có phần storage này, trả `logoUrl = null` để FE dùng initials.
7. `JobDetailDto` giữ nguyên toàn bộ trường Job hiện tại và bổ sung `company`, vì vậy các consumer chi tiết cũ vẫn tương thích. `JobDto` của danh sách không mang phần mô tả Company để tránh tăng payload.
8. Swagger phải mô tả rõ trường công khai, nullable và ví dụ response.

Không cần một API public Company riêng trong bước này vì UI chỉ mở hồ sơ doanh nghiệp từ một Job đã được phép xem. Nếu sau này có trang danh mục doanh nghiệp độc lập, MF-01 mới tách `GET /api/v1/public/companies/{companyId}` với policy riêng.

Test BE bắt buộc:

1. Guest đọc Job Candidate công khai nhận đúng public company DTO.
2. Candidate đăng nhập nhận cùng dữ liệu công khai, không nhận thêm dữ liệu nội bộ.
3. Job `PARTNER_ONLY`, `INTERNAL_ONLY`, chưa duyệt, tạm dừng hoặc đã đóng không làm lộ Company qua quyền Guest.
4. Response JSON không chứa `taxCode`, `roleInCompany`, `isPrimaryContact` hoặc thông tin người liên hệ.
5. Company thiếu logo/website/address/description vẫn trả `200` với các trường nullable đúng schema.
6. Website có scheme không hợp lệ được trả `null` hoặc bị loại khi cập nhật profile.
7. Query danh sách Job không tạo N+1 query tới Company.

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
