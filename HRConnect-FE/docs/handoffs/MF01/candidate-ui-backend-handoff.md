# Bàn giao Backend MF-01 phục vụ giao diện Candidate

> Người nhận: Dev phụ trách MF-01 — tạo, duyệt, công bố và khám phá Job.
>
> Ngày rà soát: 2026-10-12.
>
> Phiên bản đối chiếu: nhánh `main`, commit `fde7aa3`.
>
> Phạm vi tài liệu này chỉ gồm các backend MF-01 mà giao diện Candidate đang cần. Các luồng nộp hồ sơ, CV, consent, Application và attribution thuộc MF-02; phỏng vấn, Offer và rút hồ sơ thuộc MF-04.

## 1. Phân định trách nhiệm

| Chức năng | Module sở hữu | Ghi chú |
|---|---|---|
| Candidate/Guest tìm và xem Job | **MF-01** | MF-01 quyết định Job nào đang `ACTIVE`, phạm vi hiển thị và Service Type nào Candidate được xem. |
| Lưu Job để xem lại | **MF-01** | Là quan hệ giữa Candidate và Job trong trải nghiệm khám phá việc làm. |
| Candidate đã ứng tuyển Job hay chưa | MF-02 | Dữ liệu lấy từ Submission/Application; MF-01 không tự suy luận. |
| Candidate nộp CV, chống trùng, consent | MF-02 | Không sửa trong hạng mục MF-01. |
| Lịch sử Application và AI status | MF-02/MF-03 | Không đưa vào Job repository của MF-01. |
| Rút hồ sơ, Interview, Offer | MF-04 | Không thuộc tài liệu này. |

Nếu Job detail cần hiển thị `myApplication`, MF-01 chỉ phối hợp hợp đồng response; việc xác định trạng thái phải gọi query/read model của MF-02, không truy vấn hoặc sao chép quy tắc Application vào MF-01.

## 2. Phần hiện tại đã đúng — không làm lại

### 2.1 Danh sách Job cho Candidate đã có phân quyền đúng

```http
GET /api/v1/jobs
```

- Yêu cầu đăng nhập và permission `job.view`.
- Chỉ trả Job `ACTIVE`.
- Lọc theo role, Service Type và visibility.
- Candidate không nhìn thấy Job `PARTNER_ONLY` hoặc Job thuộc Service Type không cho Candidate xem.
- Đã hỗ trợ `search`, `location`, `employmentType`, `serviceTypeId`, `salaryMin`, `salaryMax`, `page`, `pageSize`.

### 2.2 Guest đã có API Job riêng

```http
GET /api/v1/public/jobs
```

- Không cần đăng nhập.
- Cố định quyền xem theo role `CANDIDATE`.
- Chỉ trả Job `ACTIVE`, `PUBLIC` và Service Type có `can_view` cho Candidate.
- Có rate limit `public-read`.

### 2.3 Chi tiết Job đã kiểm tra phạm vi hiển thị

```http
GET /api/v1/jobs/{jobId}
```

- Guest được xem Job đúng phạm vi Candidate.
- Người đăng nhập được kiểm tra role và permission.
- Job dành riêng cho Affiliate/Internal không được lộ cho Guest/Candidate.

### 2.4 Thứ tự mặc định hiện hợp lý

Repository đang sắp xếp theo `postedAt DESC`, sau đó `jobId`. Có phân trang ở database và `pageSize` tối đa 100. Không cần thay đổi hành vi mặc định này.

## 3. Backend MF-01 cần bổ sung

## A. Bổ sung sắp xếp Job — ưu tiên cao

Danh sách hiện chỉ có thứ tự cố định theo ngày đăng. Candidate UI cần cho người dùng chủ động chọn cách sắp xếp.

Mở rộng hai API:

```http
GET /api/v1/jobs
GET /api/v1/public/jobs
```

Thêm query parameter:

```text
sortBy=POSTED_AT|SALARY
sortDirection=DESC|ASC
```

Quy tắc:

- Mặc định: `POSTED_AT DESC` để giữ tương thích.
- `SALARY DESC`: ưu tiên `salaryMax`, sau đó `salaryMin`, cuối cùng `postedAt DESC`.
- Job `salaryNegotiable=true` hoặc không có mức lương phải có thứ tự ổn định, không làm kết quả nhảy giữa các trang.
- Chỉ chấp nhận giá trị whitelist; sai giá trị trả `400` bằng thông báo tiếng Việt.
- Luôn thêm `jobId` làm khóa sắp xếp cuối để phân trang ổn định.

Tiêu chí nghiệm thu:

1. Candidate chọn “Mới nhất” nhận đúng `postedAt DESC`.
2. Candidate chọn “Lương cao nhất” nhận kết quả ổn định qua nhiều trang.
3. Guest và Candidate đăng nhập dùng cùng quy tắc sort nhưng vẫn khác phạm vi hiển thị theo quyền.
4. Có unit test cho sort, null salary và query parameter không hợp lệ.

## B. Bổ sung hạn nhận hồ sơ/hiệu lực Job — ưu tiên cao

Candidate UI cần biết Job còn nhận hồ sơ đến khi nào. `JobDto` hiện chỉ có `postedAt` và `closedAt`, chưa có hạn nộp.

Đề xuất thêm vào `job`:

```text
application_deadline timestamptz null
```

Response thêm:

```json
{
  "applicationDeadline": "2026-11-30T16:59:59Z",
  "isAcceptingApplications": true
}
```

Quy tắc business:

- `applicationDeadline` là tùy chọn khi tạo Job nếu business chưa bắt buộc mọi Job có hạn.
- Thời điểm phải lớn hơn thời điểm hiện tại khi Client gửi duyệt.
- `isAcceptingApplications` do server tính; không nhận trực tiếp từ client.
- Job chỉ nhận hồ sơ khi đồng thời:
  - trạng thái `ACTIVE`;
  - chưa quá `applicationDeadline`, nếu có;
  - role và Service Type cho phép nộp.
- MF-02 phải dùng cùng một policy/check server-side trước khi tạo Submission/Application. Không chỉ khóa nút ở frontend.
- Nếu quá hạn, API apply/submit trả lỗi nghiệp vụ rõ ràng; không trả `500`.
- Nếu hệ thống quyết định tự đóng Job khi hết hạn thì cần worker idempotent, status history và audit. Nếu không tự đóng, Job vẫn `ACTIVE` nhưng `isAcceptingApplications=false`; cần chốt một phương án duy nhất với nhóm.

Tiêu chí nghiệm thu:

1. Candidate thấy hạn nhận hồ sơ trên list và detail.
2. Job quá hạn không nhận Candidate/Affiliate submission mới.
3. Thay đổi hạn nộp dùng `concurrencyToken` và ghi audit/status history phù hợp.
4. Migration có index phục vụ truy vấn Job đang mở theo deadline.

## C. Mở rộng tìm kiếm theo tên công ty và kỹ năng — ưu tiên trung bình

Hiện `search` chỉ tìm trong `job.title` và `job.description`. Placeholder trên FE mô tả người dùng có thể tìm theo vị trí, kỹ năng và công ty, nên backend cần đồng bộ hành vi.

Mở rộng `search` để tìm không phân biệt hoa thường trong:

- Job title.
- Job description.
- Company name.
- Skill name của `job_skill`.
- Nội dung requirement nếu nhóm xác nhận cần thiết.

Quy tắc:

- Không làm thay đổi bộ lọc quyền hiện tại.
- Không tạo bản ghi trùng khi một Job khớp nhiều Skill.
- Chuẩn hóa khoảng trắng của từ khóa.
- Giới hạn chiều dài `search` để tránh query quá lớn.
- Kiểm tra query plan; bổ sung index phù hợp hoặc PostgreSQL trigram/full-text nếu dữ liệu lớn.

Tiêu chí nghiệm thu:

1. Tìm tên công ty trả đúng Job đang `ACTIVE` và được phép xem.
2. Tìm theo Skill trả mỗi Job đúng một lần.
3. Job không đúng visibility vẫn không xuất hiện dù từ khóa khớp.

## D. Saved Jobs lưu trong database — ưu tiên trung bình, có thể hoãn

Frontend hiện từng lưu Job yêu thích bằng `localStorage`. Cách này mất dữ liệu khi đổi máy/trình duyệt và không phù hợp production.

Nếu nhóm giữ chức năng “Việc làm đã lưu”, MF-01 cần tạo bảng:

```text
candidate_saved_job
- candidate_saved_job_id uuid PK
- candidate_id uuid FK -> candidate
- job_id uuid FK -> job
- created_at timestamptz
- unique(candidate_id, job_id)
```

API đề xuất:

```http
GET    /api/v1/candidates/me/saved-jobs?page=1&pageSize=20
POST   /api/v1/candidates/me/saved-jobs/{jobId}
DELETE /api/v1/candidates/me/saved-jobs/{jobId}
```

Quy tắc:

- Candidate chỉ thao tác dữ liệu của chính mình.
- Save idempotent: lưu lại cùng Job không tạo dòng trùng.
- Không cho lưu Job Candidate không có quyền xem.
- Danh sách có thể giữ Job đã `PAUSED/CLOSED` để Candidate biết Job không còn tuyển, nhưng không được cho ứng tuyển.
- Delete idempotent hoặc trả `404` nhất quán; ghi rõ trong Swagger.
- Không xóa lịch sử Saved Job khi Job đóng.

Response danh sách nên dùng DTO Job rút gọn, không tải Requirements/Skills/StatusHistories đầy đủ cho mọi item.

Nếu chưa làm hạng mục này, frontend phải ẩn chức năng Saved Job; không tiếp tục dùng `localStorage` như nguồn dữ liệu production.

## E. Tối ưu DTO danh sách Job — ưu tiên trung bình

`GET /jobs` hiện map sang `JobDto` đầy đủ, gồm Requirements và Skills. Trang danh sách chỉ cần dữ liệu thẻ Job, nên response đang nặng hơn cần thiết.

Đề xuất tách:

- `JobListItemDto`: dữ liệu thẻ Job.
- `JobDetailDto`: description, benefits, requirements, skills và dữ liệu chi tiết.

`JobListItemDto` tối thiểu:

```json
{
  "jobId": "uuid",
  "title": "string",
  "companyId": "uuid",
  "companyName": "string",
  "serviceTypeId": "uuid",
  "serviceTypeCode": "CV_APPLICATION",
  "location": "string",
  "employmentType": "FULL_TIME",
  "salaryMin": 12000000,
  "salaryMax": 18000000,
  "salaryNegotiable": false,
  "currencyCode": "VND",
  "minExperienceYears": 1,
  "maxExperienceYears": 3,
  "postedAt": "datetime",
  "applicationDeadline": "datetime|null",
  "isAcceptingApplications": true
}
```

Không được làm gãy frontend hiện tại. Có thể thêm DTO mới theo version hoặc phối hợp cập nhật FE trong cùng đợt.

## F. Notification API dùng chung — ưu tiên rất cao

Theo phân công của nhóm, MF-01 chịu trách nhiệm hạ tầng đọc và quản lý
notification dùng chung cho mọi role. Các MF khác vẫn tạo notification cho
sự kiện nghiệp vụ do chính MF đó sở hữu.

```http
GET  /api/v1/notifications?page=1&pageSize=20&type=&isRead=
GET  /api/v1/notifications/unread-count
POST /api/v1/notifications/{notificationId}/read
POST /api/v1/notifications/read-all
```

Quy tắc:

- Xác định `userId` từ access token; không nhận `userId` từ request.
- Người dùng chỉ đọc và cập nhật notification của chính mình.
- List phân trang tại database và mặc định mới nhất trước.
- `read` và `read-all` phải idempotent.
- `unread-count` chỉ đếm notification chưa đọc của user hiện tại.
- Response có `relatedEntityType`, `relatedEntityId` và route hint an toàn.
- Không lưu signed URL, OTP, consent token hoặc dữ liệu nhạy cảm trong payload.
- Bổ sung index `(user_id, is_read, created_at)` nếu query plan cần.

Phân công producer:

| Sự kiện | Module tạo notification |
|---|---|
| Job được duyệt/từ chối/đóng | MF-01 |
| Consent và Submission | MF-02 |
| Kết quả AI cần chú ý | MF-03 |
| Interview, Offer, Application lifecycle | MF-04 |

MF-01 không sao chép business của các MF khác; MF-01 chỉ cung cấp repository,
query/command và endpoint đọc/đánh dấu notification dùng chung.

## G. Contract doanh nghiệp công khai trong Job Detail — ưu tiên cao

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

## 4. Phần cần phối hợp nhưng không thuộc MF-01

Dev MF-01 không tự triển khai các trường sau trong Job aggregate:

### 4.1 `alreadyApplied` / `myApplication`

Đây là dữ liệu MF-02. Nếu Candidate Job detail cần hiển thị, hai nhóm chọn một trong hai cách:

1. MF-02 cung cấp `GET /api/v1/jobs/{jobId}/my-application`; hoặc
2. Tạo Candidate Job read model/composition query gọi cả MF-01 và MF-02.

Không thêm `alreadyApplied` vào bảng `job`.

### 4.2 Job phù hợp do AI

Danh sách “Việc làm phù hợp” liên quan MF-03 hoặc recommendation service. MF-01 chỉ cung cấp Job đủ dữ liệu và đúng quyền xem; không tự viết điểm phù hợp giả.

### 4.3 Dashboard Candidate

Số Application, CV, consent chờ xác nhận thuộc MF-02. MF-01 chỉ có thể cung cấp Job mới hoặc Job được gợi ý để dashboard tổng hợp.

## 5. Yêu cầu kỹ thuật chung

- Giữ nguyên `JobAccessPolicy` và ma trận Service Type × role trong mọi query mới.
- Không tin `role`, `candidateId`, visibility hoặc `isAcceptingApplications` do client truyền lên.
- Query danh sách phải phân trang ở database.
- Dùng `AsNoTracking()` cho read-only query.
- Mọi thay đổi Job của Client dùng `concurrencyToken`.
- Thay đổi trạng thái phải ghi status history và audit.
- Lỗi nghiệp vụ trả `400/403/404/409` phù hợp, không để lộ thành `500`.
- Swagger phải ghi rõ quyền, tham số, giá trị hợp lệ, response và các mã lỗi.
- Viết unit test cho policy, filter, sort, deadline, ownership và concurrency.

## 6. Thứ tự triển khai đề xuất

1. **Notification API dùng chung** để các MF có một kênh hiển thị thống nhất.
2. **Deadline + `isAcceptingApplications`** vì liên quan trực tiếp việc có nhận hồ sơ hay không.
3. **Sort Job** và mở rộng search theo Company/Skill.
4. **Tách DTO list/detail** để giảm payload.
5. **Saved Jobs** nếu Product xác nhận giữ chức năng.
6. Phối hợp MF-02 để hiển thị `alreadyApplied` mà không trộn ownership giữa hai module.

## 7. Kịch bản test tay bàn giao

1. Guest chỉ thấy `CV_APPLICATION`, `PUBLIC`, `ACTIVE` mà Candidate được phép xem.
2. Candidate đăng nhập thấy đúng Job theo Service Type/role.
3. Affiliate không dùng response Candidate để thấy Job `INTERNAL_ONLY`.
4. Search theo tên công ty và Skill không trả Job trùng.
5. Sort theo mới nhất và lương hoạt động ổn định khi chuyển trang.
6. Job quá deadline vẫn xem được theo quyết định business nhưng không thể nộp hồ sơ.
7. Candidate lưu Job, đăng nhập ở trình duyệt khác vẫn thấy Job đã lưu.
8. Job đã đóng trong danh sách Saved Jobs hiển thị “Đã ngừng nhận hồ sơ” và không có nút ứng tuyển.

Tài liệu thiếu sót MF-01 toàn luồng tạo/duyệt/công bố Job nằm tại `docs/mf01-gaps.md`. Tài liệu này chỉ bổ sung nhu cầu backend phát sinh từ trải nghiệm Candidate.
