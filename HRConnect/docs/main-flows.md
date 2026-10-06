# 6. MAIN FLOWS

**Project:** HR Connect – AI-Powered Recruitment & Affiliate Headhunting Platform
**Phiên bản:** 2.2 (05/10/2026) — viết theo code của repo `hr-connect` tại commit `73cec91` (nhánh main).

**Quy ước đánh dấu:**
- **[CHƯA CÓ CODE]**: nghiệp vụ thuộc phạm vi nhưng backend chưa cài.
- **[CẦN XÁC NHẬN]**: đề xuất của nhóm, cần chốt với giảng viên hướng dẫn.

HR Connect có 5 Main Flow:

**MF-01** Tạo, duyệt, công bố Job → **MF-02** Tiếp nhận hồ sơ, kiểm tra trùng, ghi nhận nguồn → **MF-03** AI Matching và sàng lọc → **MF-04** Phỏng vấn, Offer, Nhận việc → **MF-05** Thử việc, Bảo hành, Hoa hồng, Payout

**Nguyên tắc attribution:** Affiliate được ghi nhận là nguồn của ứng viên cho một job khi lượt giới thiệu của họ là lượt đầu tiên được ứng viên đồng ý. Thời điểm do máy chủ ghi và dùng để giải quyết tranh chấp.

**Tên gọi:** tài liệu dùng **Affiliate** (không dùng "Affiliate Recruiter").

**Phân vai chung:** Client Company là bên sở hữu quyết định tuyển dụng (phỏng vấn, offer, nhận việc). Internal HR thuộc đơn vị vận hành nền tảng: duyệt job, sàng lọc với dịch vụ do nền tảng tìm người, và kiểm soát các mốc phát sinh phí. Platform Admin quản trị hệ thống và phần tài chính.

**Sơ đồ:** mỗi Main Flow có activity diagram trong thư mục `diagrams/`. Ô tô hồng, viền nét đứt trong sơ đồ là bước chưa có trong code.

---

# 6.0. KHÁC BIỆT THEO SERVICE TYPE

Năm Main Flow dùng chung một pipeline, nhưng mỗi loại dịch vụ đi qua pipeline theo cách khác nhau. Bảng này tổng hợp từ ba tài liệu mô hình kinh doanh.

| | `HEADHUNT_COD` | `CV_SOURCING` | `CV_APPLICATION` |
|---|---|---|---|
| Client mua gì | Kết quả tuyển thành công | Một số lượng CV đạt chuẩn | Quyền đăng tin trong một khoảng thời gian |
| Nguồn ứng viên | Affiliate giới thiệu | Affiliate giới thiệu | Ứng viên tự nộp |
| Chế độ hiển thị job | `PARTNER_ONLY` / `INTERNAL_ONLY` | `PARTNER_ONLY` / `INTERNAL_ONLY` | `PUBLIC` / `INTERNAL_ONLY` |
| Thông tin thêm khi tạo job (MF-01) | Số lượng cần tuyển, hệ số phí, thời hạn bảo hành | Số lượng cần tuyển và Sourcing Target (hai số độc lập) | Gói đăng tin; job chỉ công bố sau khi gói được kích hoạt |
| Sàng lọc (MF-03) | Internal HR sàng lọc và liên hệ ứng viên | Internal HR xác định CV đạt chuẩn, chọn đủ Sourcing Target để giao Client, phần dư vào nhóm dự phòng | Client xem và chọn; HR của Client liên hệ ứng viên |
| Điểm hoàn thành dịch vụ | Ứng viên đi làm thực tế (MF-04) | Giao đủ số CV đạt chuẩn (MF-03); phỏng vấn và tuyển là tùy chọn | Hết thời hạn gói; tuyển được hay không không ảnh hưởng phí |
| Thời điểm phát sinh phí | Khi xác nhận đi làm | Khi CV được giao và tính vào quota | Khi kích hoạt gói |
| Hoa hồng Affiliate | Theo từng placement, theo mốc bảo hành | Theo số CV được tính quota | Không có |
| Cam kết sau bán | Bảo hành, tuyển thay thế | Thay CV bằng CV dự phòng | Không có |

**Quy tắc riêng của `CV_SOURCING`:**

- Số lượng cần tuyển và Sourcing Target độc lập: Client cần tuyển 2 người nhưng có thể mua 10 CV.
- Một CV chỉ được tính phí và hoa hồng khi đi đủ ba bước: đạt chuẩn → giao cho Client → tính vào quota.
- CV dự phòng vẫn là CV đạt chuẩn nhưng chưa phát sinh hoa hồng; chỉ phát sinh khi được dùng để thay thế hoặc bổ sung.
- Client không chọn một ứng viên không có nghĩa CV đó không đạt chuẩn; hoa hồng của CV đã tính quota không bị thu hồi.

**Quy tắc riêng của `HEADHUNT_COD`:**

- Phí và hoa hồng tính theo từng placement, không theo job. Job cần 2 người mà mới tuyển được 1 thì chỉ phát sinh 1 khoản phí; job tiếp tục `ACTIVE` cho vị trí còn lại.
- Nhận offer nhưng không đi làm thì không phát sinh phí.

**Quy tắc riêng của `CV_APPLICATION`:**

- Số lượng hồ sơ nhận được không làm thay đổi phí; không có hồ sơ nào cũng không tự động hoàn phí.
- Ứng viên tự nộp được tuyển thành công không phát sinh phí tuyển dụng thành công và không có hoa hồng.

**Mức hỗ trợ trong code hiện tại:** job mới chỉ có trường số lượng cần tuyển (`Quantity`). Sourcing Target, hệ số phí, thời hạn bảo hành theo job, gói đăng tin, và các trạng thái đạt chuẩn / đã giao / tính quota / dự phòng đều **[CHƯA CÓ CODE]**. Riêng bảng hoa hồng và payout đã có sẵn các trường cần thiết (số tiền gốc, ảnh chụp quy tắc lúc tính, mã giao dịch, chứng từ) nhưng chưa có nghiệp vụ sử dụng.

---

# MF-01. Tạo, duyệt và công bố Job

![MF-01](diagrams/MF-01_Activity_Diagram.png)

**Mục tiêu:** Client tạo job, chọn Service Type, và job được người có thẩm quyền duyệt trước khi nhận hồ sơ.

**Actor:** Client Company User, Internal HR (Platform Admin làm thay được).

**Điều kiện:** công ty đã được Platform Admin duyệt.

**Luồng chính:**

1. Client tạo job ở trạng thái `DRAFT`: mô tả công việc, yêu cầu bắt buộc (`MUST_HAVE`) và yêu cầu ưu tiên (`SHOULD_HAVE`), Service Type, chế độ hiển thị.
2. Client gửi duyệt → `PENDING_REVIEW`.
3. Internal HR duyệt → `ACTIVE`, hoặc từ chối kèm mã lý do → `REJECTED`.
4. Job bị từ chối: Client sửa và gửi lại → `PENDING_REVIEW`.
5. Job đang chạy: Client có thể tạm dừng (`PAUSED`), mở lại (`ACTIVE`) hoặc đóng (`CLOSED`).

**Sơ đồ trạng thái Job:**

```
DRAFT → PENDING_REVIEW → ACTIVE ⇄ PAUSED
              ↓  ↑          ↓        ↓
            REJECTED      CLOSED ← ──┘
```

**Quy tắc:**

- Service Type được chọn tại job; người nộp hồ sơ ở MF-02 không chọn lại.
- Chế độ hiển thị phụ thuộc Service Type:

| Service Type | Chế độ hiển thị cho phép |
|---|---|
| `CV_APPLICATION` | `PUBLIC` hoặc `INTERNAL_ONLY` |
| `CV_SOURCING`, `HEADHUNT_COD` | `PARTNER_ONLY` hoặc `INTERNAL_ONLY` |

- Mỗi lần đổi trạng thái đều ghi lịch sử kèm người thực hiện, mã lý do và thời điểm.
- Hai người cùng sửa một job: người lưu sau bị từ chối và phải tải lại dữ liệu.
- Giới hạn gói miễn phí (1 job mở tại một thời điểm, chu kỳ mở lại 2 tháng) **[CHƯA CÓ CODE]**.

**Kết quả:** job `ACTIVE` sẵn sàng nhận hồ sơ, hoặc job `REJECTED` trả về Client để sửa.

---

# MF-02. Tiếp nhận hồ sơ, kiểm tra trùng, ghi nhận nguồn

![MF-02A](diagrams/MF-02A_Activity_Diagram.png)

![MF-02B](diagrams/MF-02B_Activity_Diagram.png)

**Mục tiêu:** tiếp nhận ứng viên và CV vào đúng job, chặn trùng trước khi vào pipeline, ghi nhận nguồn và attribution.

**Actor:** Candidate, Affiliate.

**Điều kiện:** job `ACTIVE`; vai trò của người nộp được phép nộp với Service Type của job.

## Nhánh A — Ứng viên tự nộp

Áp dụng cho job có chế độ `PUBLIC` (tức job `CV_APPLICATION`).

1. Ứng viên chọn job và cung cấp đúng một nguồn CV: chọn CV có sẵn trong kho của mình hoặc tải tệp PDF mới.
2. Hệ thống kiểm tra điều kiện: tài khoản và vai trò ứng viên còn hoạt động; hồ sơ ứng viên không bị khóa, lưu trữ hay hợp nhất.
3. Hệ thống kiểm tra trùng.
4. Không trùng: tạo lượt nộp `ACCEPTED` với nguồn `CANDIDATE`, tạo hồ sơ ứng tuyển `SUBMITTED`, xếp hàng chấm điểm AI, chuyển MF-03.

## Nhánh B — Affiliate giới thiệu

Áp dụng cho job có chế độ `PUBLIC` hoặc `PARTNER_ONLY`. Affiliate phải đã được duyệt.

1. Affiliate chọn job, nhập ứng viên mới hoặc chọn từ kho ứng viên của mình, kèm CV. Ứng viên bắt buộc có email.
2. Hệ thống chuẩn hóa email và số điện thoại, tìm ứng viên đã có, kiểm tra trùng.
3. Không trùng: tạo lượt nộp chờ xác nhận và gửi email cho ứng viên. Yêu cầu có hiệu lực 48 giờ (cấu hình được).
4. Affiliate có thể gửi lại email xác nhận, cách nhau tối thiểu 2 phút và có giới hạn số lần gửi.
5. Ứng viên đồng ý: hệ thống kiểm tra lại job còn `ACTIVE` và Affiliate còn hoạt động, rồi chuyển lượt nộp sang `ACCEPTED`, tạo hồ sơ ứng tuyển `SUBMITTED`, ghi attribution cho Affiliate, xếp hàng chấm điểm AI, chuyển MF-03.
6. Ứng viên từ chối: lượt nộp `CONSENT_REJECTED`, dừng xử lý.
7. Quá hạn không trả lời: hệ thống tự chuyển lượt nộp sang `CONSENT_EXPIRED` và lưu trữ CV đang chờ; Affiliate phải tạo lượt nộp mới.
8. Affiliate nhận thông báo kết quả xác nhận (đồng ý, từ chối hoặc hết hạn).

## Quy tắc kiểm tra trùng

- **Trùng = cùng ứng viên + cùng job.**
- Ứng viên được nhận diện bằng email hoặc số điện thoại khớp chính xác sau khi chuẩn hóa.
- Ứng viên đã có trong hệ thống nhưng nộp vào job mới thì không phải là trùng: dùng lại hồ sơ ứng viên cũ, tạo hồ sơ ứng tuyển mới.
- Khi trùng: ghi lượt nộp `BLOCKED_DUPLICATE`, không tạo hồ sơ ứng tuyển mới, giữ nguyên attribution hiện có, báo cho người nộp.
- Email và số điện thoại thuộc hai ứng viên khác nhau: từ chối lượt nộp.
- Việc trùng không phụ thuộc CV mới đẹp hơn hay đầy đủ hơn CV cũ.
- Kiểm tra trùng chạy đồng bộ, trước khi hồ sơ được nhận vào pipeline.

## Quy tắc attribution

- Attribution chỉ được ghi khi ứng viên đã đồng ý, không phải lúc Affiliate bấm nộp.
- Thời điểm do máy chủ ghi, người dùng không nhập hay sửa được.
- Trong lúc một lượt giới thiệu đang chờ xác nhận, Affiliate khác không nộp được ứng viên đó vào cùng job.
- Ứng viên tự nộp không có attribution và không phát sinh hoa hồng.

**Ví dụ:** Affiliate A giới thiệu ứng viên X vào job E, X đồng ý → attribution thuộc A. Sau đó Affiliate B giới thiệu X vào job E → bị chặn trùng, attribution của A không đổi.

## Quan hệ dữ liệu

| Khái niệm | Ý nghĩa |
|---|---|
| Candidate | Một người, nhận diện bằng email/số điện thoại |
| CV | Tệp hồ sơ của ứng viên; một ứng viên có nhiều CV |
| Submission (lượt nộp) | Một lần ai đó gửi ứng viên + CV vào một job |
| Application (hồ sơ ứng tuyển) | Hồ sơ tuyển dụng chính của ứng viên trong một job; mỗi cặp ứng viên + job chỉ có một |

## Chưa có

- Internal HR nộp hồ sơ thay ứng viên **[CHƯA CÓ CODE] [CẦN XÁC NHẬN]**.
- Khiếu nại tranh chấp trùng và Platform Admin xử lý (SF-04) **[CHƯA CÓ CODE]**.

**Kết quả:** hồ sơ ứng tuyển `SUBMITTED` kèm nguồn và attribution (nếu có), hoặc lượt nộp bị chặn/dừng.

---

# MF-03. AI Matching và sàng lọc

![MF-03](diagrams/MF-03_Activity_Diagram.png)

**Mục tiêu:** AI hỗ trợ đánh giá mức độ phù hợp giữa CV và job; con người quyết định cuối.

**Actor:** người sàng lọc (Internal HR hoặc Client Company User, tùy loại dịch vụ). **Thành phần hệ thống:** AI Matching Service.

**Ai sàng lọc [CẦN XÁC NHẬN]:**

| Service Type | Người sàng lọc | Lý do |
|---|---|---|
| `CV_APPLICATION` | Client | Client mua quyền nhận và tự chọn hồ sơ |
| `HEADHUNT_COD`, `CV_SOURCING` | Internal HR lọc trước; Client chỉ thấy hồ sơ đã đạt | Giá trị dịch vụ là hồ sơ đã được nền tảng chọn lọc |

Code: quy tắc nằm ở `ScreeningPolicy`; sai người theo loại dịch vụ thì API trả 403.

**Điều kiện:** có hồ sơ ứng tuyển `SUBMITTED` từ MF-02.

**Luồng chính:**

1. Hệ thống tự gọi AI chấm điểm CV so với mô tả job. Nếu AI service lỗi hoặc quá thời gian xử lý (15 phút), hệ thống tự thử lại với khoảng chờ tăng dần (từ 30 giây đến tối đa 15 phút) và có giới hạn số lần thử.
2. AI trả về điểm phù hợp, tier, kết quả từng yêu cầu bắt buộc/ưu tiên kèm bằng chứng trích từ CV.
3. Người sàng lọc xem kết quả; Internal HR có thể yêu cầu chấm lại.
4. Người sàng lọc quyết định (`PATCH /api/v1/jobs/{jobId}/applications/{applicationId}/status`, bắt buộc `concurrencyToken`):
   - Đạt → `SHORTLISTED`, chuyển MF-04.
   - Không đạt → `REJECTED` kèm **mã lý do bắt buộc**, ghi chú tự do không bắt buộc (bắt buộc khi chọn `OTHER`), kết thúc.

| Mã lý do loại | Ý nghĩa |
|---|---|
| `SKILL_MISMATCH` | Thiếu kỹ năng |
| `INSUFFICIENT_EXPERIENCE` | Thiếu kinh nghiệm |
| `SALARY_MISMATCH` | Lương không phù hợp |
| `LOCATION_MISMATCH` | Địa điểm không phù hợp |
| `LANGUAGE_REQUIREMENT` | Không đạt yêu cầu ngoại ngữ |
| `CANDIDATE_UNREACHABLE` | Không liên hệ được ứng viên |
| `POSITION_FILLED` | Vị trí đã tuyển đủ |
| `OTHER` | Lý do khác, phải ghi chú |

**Quy tắc:**

- AI chỉ hỗ trợ ra quyết định. AI không tự loại, không tự chọn, không quyết định kết quả phỏng vấn hay offer.
- CV thiếu bằng chứng cho một yêu cầu (ví dụ IELTS) là nội dung sàng lọc, không làm lượt nộp thành trùng hay không hợp lệ.
- Tier theo điểm: ≥80, 70–79, 60–69, <60. Ngưỡng và màu lưu trong bảng cấu hình, không viết cứng.
- Hồ sơ đang được xem xét dùng trạng thái `SCREENING`. Không dùng `NEED_MORE_INFORMATION` hay `UNDER_REVIEW` như bản cũ **[CẦN XÁC NHẬN]**. Khi người sàng lọc mở hồ sơ, giao diện gọi `POST /api/v1/jobs/{jobId}/applications/{applicationId}/start-screening`: hồ sơ `SUBMITTED` chuyển sang `SCREENING`; gọi lặp lại hoặc người không phụ trách sàng lọc gọi thì không đổi gì.
- Ai liên hệ ứng viên sau sàng lọc (API trả trường `contactOwner`):

| Service Type | Người liên hệ ứng viên |
|---|---|
| `HEADHUNT_COD` | Internal HR |
| `CV_SOURCING`, `CV_APPLICATION` | HR của Client |

- Với `HEADHUNT_COD` và `CV_SOURCING`, Client chỉ thấy hồ sơ đã từng được `SHORTLISTED`; hồ sơ chưa qua sàng lọc không có trong danh sách và trả 404 khi mở.
- Với `HEADHUNT_COD`, Client không thấy email, số điện thoại, địa chỉ và file CV của ứng viên cho tới khi hồ sơ `PLACED` (`isContactMasked = true`). `CV_SOURCING` và `CV_APPLICATION` không che vì HR của Client là người liên hệ.

**Kết quả:** `SHORTLISTED` → MF-04, hoặc `REJECTED` → kết thúc.

---

# MF-04. Phỏng vấn, Offer, Nhận việc

![MF-04](diagrams/MF-04_Activity_Diagram.png)

**Mục tiêu:** theo dõi ứng viên từ lúc được chọn đến khi thực sự đi làm.

**Actor:** Client Company User, Candidate, Internal HR.

**Phân vai:**

| Bước | Người thực hiện | Ghi chú |
|---|---|---|
| Lên lịch, phỏng vấn, ghi kết quả, quyết định hồ sơ dự bị | Client | Bộ phận tuyển dụng của Client trực tiếp làm việc với ứng viên |
| Tạo và gửi offer | Client | Lương và điều kiện làm việc do Client đưa ra |
| Xác nhận ngày bắt đầu, xác nhận đi làm, đánh dấu không nhận việc | Client | |
| Đối soát placement trước khi tính phí (`HEADHUNT_COD`) | Internal HR | **[CHƯA CÓ CODE] [CẦN XÁC NHẬN]** |
| Kiểm tra lý do khi hồ sơ bị đánh dấu không nhận việc | Internal HR | **[CHƯA CÓ CODE] [CẦN XÁC NHẬN]** |

Internal HR thuộc đơn vị vận hành nền tảng, không thuộc công ty Client, nên không lên lịch phỏng vấn, không ghi kết quả và không tạo offer. Migration `20261005090000_RestrictInternalHrRecruitmentMutations` đã thu hồi các quyền thao tác MF-04 này; Internal HR chỉ giữ `application.screen` cho bước tiền sàng lọc `HEADHUNT_COD` và `CV_SOURCING`. Vai trò kiểm soát mốc phát sinh phí vẫn là bước đề xuất: với `HEADHUNT_COD` cần một bước đối soát độc lập (với ứng viên hoặc Affiliate) trước khi chuyển sang tính phí ở MF-05.

**Điều kiện:** hồ sơ ứng tuyển `SHORTLISTED`.

## Phỏng vấn

1. Client lên lịch → hồ sơ chuyển `INTERVIEW`, lịch ở trạng thái `SCHEDULED`; hệ thống gửi thông báo cho ứng viên.
2. Lịch có thể được sửa, dời, hủy (`CANCELLED`) hoặc ghi vắng mặt (`NO_SHOW`).
3. Sau buổi phỏng vấn, ghi kết quả (lịch chuyển `COMPLETED`):

| Kết quả | Hồ sơ chuyển sang |
|---|---|
| `PASS` | `OFFER_PENDING` |
| `FAIL` | `INTERVIEW_FAILED` (kết thúc) |
| `BACKUP` | `BACKUP`, chờ quyết định |

4. Hồ sơ dự bị: được chọn → `OFFER_PENDING`; không được chọn → `BACKUP_NOT_SELECTED` (kết thúc).

**Quy tắc:** mỗi hồ sơ chỉ có một lịch đang chờ tại một thời điểm; hỗ trợ nhiều vòng phỏng vấn; Client chỉ thao tác trên ứng viên của công ty mình.

## Offer

1. Tạo offer nháp (`DRAFT`), có thể sửa.
2. Gửi offer cho ứng viên (`SENT`).
3. Ứng viên chấp nhận → offer `ACCEPTED`, hồ sơ `OFFER_ACCEPTED`.
4. Ứng viên từ chối → offer `DECLINED`, hồ sơ `OFFER_DECLINED` (kết thúc).
5. Bên tuyển rút offer kèm lý do bắt buộc → offer `WITHDRAWN`, hồ sơ quay về `OFFER_PENDING` để có thể tạo offer mới. Không rút được offer ứng viên đã chấp nhận.
6. Quá hạn trả lời → `EXPIRED`.

## Nhận việc

1. Xác nhận ngày bắt đầu dự kiến.
2. Ứng viên đi làm thực tế: Client xác nhận → hồ sơ `PLACED`, tạo Placement `STARTED`, chuyển MF-05.
3. Đã nhận offer nhưng không đi làm: đánh dấu `NOT_STARTED` kèm lý do (kết thúc).

## Rút hồ sơ

Ứng viên có thể rút hồ sơ (`WITHDRAWN`) khi hồ sơ chưa `PLACED` hoặc `CLOSED`.

## Bảng trạng thái hồ sơ ứng tuyển

| Trạng thái | Ý nghĩa | Kết thúc? |
|---|---|---|
| `SUBMITTED` | Đã được nhận vào pipeline | |
| `SCREENING` | Đang sàng lọc | |
| `SHORTLISTED` | Đạt sàng lọc | |
| `REJECTED` | Không đạt sàng lọc | Có |
| `INTERVIEW` | Đang phỏng vấn | |
| `INTERVIEW_FAILED` | Trượt phỏng vấn | Có |
| `BACKUP` | Dự bị, chờ quyết định | |
| `BACKUP_NOT_SELECTED` | Dự bị không được chọn | Có |
| `OFFER_PENDING` | Đạt phỏng vấn, chờ offer | |
| `OFFER_ACCEPTED` | Ứng viên nhận offer | |
| `OFFER_DECLINED` | Ứng viên từ chối offer | Có |
| `NOT_STARTED` | Nhận offer nhưng không đi làm | Có |
| `PLACED` | Đã đi làm | |
| `WITHDRAWN` | Ứng viên rút hồ sơ | Có |
| `CLOSED` | Hồ sơ đã đóng | Có |

**Kết quả:** `PLACED` → MF-05; các nhánh còn lại kết thúc tại MF-04. Thử việc và bảo hành không xử lý ở MF-04.

---

# MF-05. Thử việc, Bảo hành, Hoa hồng, Payout

![MF-05](diagrams/MF-05_Activity_Diagram.png)

Sơ đồ mô tả trường hợp `HEADHUNT_COD`; toàn bộ là thiết kế đề xuất.

**Mục tiêu:** theo dõi ứng viên sau khi đi làm, tính phí dịch vụ, tính và chi hoa hồng cho Affiliate.

**Actor:** Client Company User, Internal HR, Platform Admin, Affiliate.

**Giả định đơn giản hóa:** Platform Admin đảm nhiệm cả việc ghi nhận thu phí, duyệt hoa hồng và ghi nhận chi; hệ thống chưa có vai trò kế toán riêng.

**Điều kiện:** có Placement từ MF-04.

> Toàn bộ luồng này **[CHƯA CÓ CODE]**, ngoại trừ phần cấu hình Commission Rule và Commission Milestone. Nội dung dưới đây là đề xuất **[CẦN XÁC NHẬN]**, dựa trên ba tài liệu mô hình kinh doanh.

## Phí dịch vụ (Client trả cho HR Connect)

| Service Type | Cách tính | Thời điểm phát sinh |
|---|---|---|
| `HEADHUNT_COD` | Lương gross tháng × hệ số phí (mặc định 1,5), tính riêng cho từng placement | Khi xác nhận đi làm thực tế |
| `CV_SOURCING` | Theo gói CV đạt chuẩn | Khi CV được giao cho Client và tính vào quota |
| `CV_APPLICATION` | Theo gói đăng tin (job × thời gian) | Khi kích hoạt gói |

Phí dịch vụ và hoa hồng là hai khoản độc lập: phí dịch vụ đi từ Client đến HR Connect, hoa hồng đi từ HR Connect đến Affiliate. Ứng viên không trả phí nào.

## Thu phí dịch vụ

1. Khi có placement, hệ thống tạo công nợ phí dịch vụ kèm hạn thanh toán và thông báo cho Client.
2. Client thanh toán ngoài hệ thống (chuyển khoản).
3. Platform Admin đối chiếu sao kê và ghi nhận đã thu; công nợ chuyển trạng thái `PENDING` → `PAID`, quá hạn thì `OVERDUE`.

## Bảo hành

Áp dụng cho `HEADHUNT_COD`. Chạy song song với việc thu phí.

1. Từ ngày đi làm, hệ thống đếm ngày bảo hành (mặc định 60 ngày, cấu hình được) và tạo hoa hồng `PENDING` cho Affiliate có attribution.
2. Tới mỗi mốc 15, 30, 60 ngày mà không có báo cáo nghỉ việc, hệ thống tự ghi nhận phần hoa hồng tương ứng là `EARNED`. Internal HR không phải xác nhận từng mốc, chỉ xử lý ngoại lệ.
3. Ứng viên nghỉ việc trong thời hạn bảo hành: Client báo nghỉ → Internal HR xác minh ngày nghỉ với ứng viên và Client → hệ thống hủy phần hoa hồng chưa đạt mốc và mở tuyển thay thế theo chính sách bảo hành.
4. Thử việc không dùng làm mốc tính hoa hồng, vì thời gian thử việc khác nhau theo vị trí; kết quả thử việc chỉ là thông tin theo dõi **[CẦN XÁC NHẬN]**.

## Hoa hồng

**Điều kiện xét duyệt:** hoa hồng chỉ được đưa sang bước duyệt khi đồng thời (a) đã đạt mốc và (b) Client đã thanh toán phí dịch vụ. Khi Client chưa thanh toán, hoa hồng đã `EARNED` vẫn chờ, chưa chi **[CẦN XÁC NHẬN]**.

| Service Type | Cách tính hoa hồng |
|---|---|
| `HEADHUNT_COD` | Theo từng placement; ghi nhận dần 25% (ngày 15), 25% (ngày 30), 50% (ngày 60) |
| `CV_SOURCING` | Quỹ hoa hồng = phí dịch vụ × tỷ lệ chia (mặc định 60%); chia theo số CV được tính quota của từng Affiliate |
| `CV_APPLICATION` | Không có hoa hồng |

**Trạng thái hoa hồng:** `PENDING` → `EARNED` → `PAYABLE` → `PAID`; nhánh phụ `ON_HOLD`, `CANCELLED`.

- `PENDING`: đã có placement, chưa đạt mốc.
- `EARNED`: đã đạt mốc, chờ đủ điều kiện xét duyệt.
- `PAYABLE`: Platform Admin đã duyệt (kiểm tra attribution, placement, mốc, tranh chấp), chờ chi.
- `PAID`: đã ghi nhận chi.
- `ON_HOLD`: tạm giữ vì đang có tranh chấp; được xét lại khi tranh chấp có kết quả.
- `CANCELLED`: không đủ điều kiện hoặc ứng viên nghỉ trước mốc.

Mọi điều chỉnh số tiền phải lưu số cũ, số mới, lý do và người thực hiện.

## Payout

1. Việc chuyển tiền thực hiện ngoài hệ thống; HR Connect chỉ ghi số tiền, ngày chi, mã tham chiếu và chứng từ.
2. **Trạng thái payout:** `PENDING` → `COMPLETED` / `FAILED` / `CANCELLED`.
3. Affiliate xem được lịch sử payout của mình.

## Đánh giá Affiliate

Điểm chất lượng tính theo tỷ lệ lượt giới thiệu dẫn đến tuyển dụng thành công, không theo số lượng lượt nộp.

**Kết quả:** thử việc và bảo hành được theo dõi; hoa hồng được tính, duyệt và ghi nhận chi; mọi bước có audit.

---

# 6.1. SUPPORTING FLOWS

| Mã | Luồng | Hỗ trợ cho | Trạng thái |
|---|---|---|---|
| SF-01 | Client đăng ký → tạo hồ sơ công ty → gửi xác minh → Platform Admin duyệt/từ chối | MF-01 | Đã có code |
| SF-02 | Đăng ký Affiliate → Platform Admin duyệt → kích hoạt → xem job → giới thiệu ứng viên | MF-02, MF-05 | Đã có code |
| SF-03 | Ứng viên nhận email → đồng ý hoặc từ chối lượt giới thiệu | MF-02 | Đã có code; là bước bắt buộc của nhánh B |
| SF-04 | Phát hiện trùng → người nộp khiếu nại → Platform Admin xem xét danh tính, lịch sử nộp, thời điểm, bằng chứng → chấp nhận/bác bỏ → ghi audit | MF-02 | **[CHƯA CÓ CODE]** |

---

# 6.2. DANH SÁCH CẦN XÁC NHẬN VỚI GIẢNG VIÊN

**Phân vai**

1. Người sàng lọc tách theo loại dịch vụ: Client với `CV_APPLICATION`; Internal HR với `HEADHUNT_COD` và `CV_SOURCING` (MF-03).
2. Ở MF-04, Client thực hiện mọi bước tuyển dụng; Internal HR chỉ đối soát placement trước khi tính phí với `HEADHUNT_COD` và kiểm tra hồ sơ bị đánh dấu không nhận việc.
3. Platform Admin là người ghi nhận thu phí, duyệt hoa hồng, ghi nhận payout và xử lý tranh chấp; không có vai trò kế toán riêng.
4. Internal HR có cần chức năng nộp hồ sơ thay ứng viên không (MF-02).

**Tiền**

5. Mốc hoa hồng 15/30/60 ngày theo bảo hành, thay cho "qua thử việc / ký hợp đồng" trong đề tài gốc; thử việc chỉ là thông tin theo dõi.
6. Bộ trạng thái hoa hồng, payout và công nợ phí ở MF-05.
7. Hoa hồng chỉ được xét duyệt khi Client đã thanh toán phí. Nếu Client quá hạn không trả thì Affiliate có được nhận hoa hồng không.
8. Tuyển thay thế trong bảo hành: có thu thêm phí không, có bảo hành mới không, Affiliate giới thiệu người thay thế có hoa hồng không.
9. Các con số 1,5; 60 ngày; 60%; giá gói là giá trị mặc định cấu hình được, không phải số cứng.

**Quy tắc khác**

10. Attribution ghi theo lúc ứng viên đồng ý, không theo lúc Affiliate nộp (khác cách diễn đạt "người nộp trước" trong đề tài).
11. Dùng `SCREENING` thay cho `NEED_MORE_INFORMATION / UNDER_REVIEW`.

---

# 6.3. PHẦN CODE CÒN THIẾU SO VỚI TÀI LIỆU

| Hạng mục | Thuộc luồng |
|---|---|
| Sàng lọc: chuyển hồ sơ sang `SCREENING`, `SHORTLISTED`, `REJECTED`; phân quyền sàng lọc theo loại dịch vụ | MF-03 — đã có code |
| Internal HR nộp hồ sơ | MF-02 |
| Khiếu nại và xử lý tranh chấp trùng | SF-04 |
| Định tuyến người liên hệ theo Service Type, che thông tin liên hệ | MF-03 |
| Giới hạn gói miễn phí | MF-01 |
| Sourcing Target, hệ số phí, thời hạn bảo hành, gói đăng tin trên job | MF-01 |
| Trạng thái CV đạt chuẩn / đã giao / tính quota / dự phòng cho `CV_SOURCING` | MF-03 |
| Theo dõi số vị trí đã tuyển so với số lượng cần tuyển | MF-04 |
| Công nợ phí dịch vụ và ghi nhận thu phí | MF-05 |
| Đếm bảo hành, tự ghi nhận mốc, báo nghỉ việc, tuyển thay thế | MF-05 |
| Tính, duyệt hoa hồng; ghi nhận payout; đánh giá Affiliate | MF-05 |
| Thu hẹp quyền của Internal HR ở MF-04 (không lên lịch, không ghi kết quả, không tạo offer) | MF-04 — đã có code |
| Bước Internal HR đối soát placement và kiểm tra lý do không nhận việc | MF-04 |
| Đổi mã vai trò `AFFILIATE_RECRUITER` thành `AFFILIATE` | Toàn hệ thống |

---

# 6.4. ĐÁNH GIÁ NGHIỆP VỤ VÀ TÁC ĐỘNG THEO TỪNG MAIN FLOW

Cột "Đề xuất" có ghi **(đã đưa vào thiết kế)** với những mục đã được phản ánh trong mô tả luồng và sơ đồ ở bản 2.2; các mục đó vẫn chưa có code.

Mục này đánh giá các Main Flow ở góc nhìn vận hành thực tế: chỗ nào có lỗ hổng, chỗ nào người dùng thật sẽ không làm theo thiết kế, và nếu không sửa thì ảnh hưởng gì.

**Giới hạn của đánh giá:** dựa trên tài liệu và code, chưa có dữ liệu người dùng thật. Các nhận định về thói quen người dùng (offer qua Zalo/email, ứng viên ít mở email hệ thống) cần được người vận hành thực tế của SHIRE xác nhận.

**Mức độ:** **Cao** = ảnh hưởng trực tiếp tới doanh thu hoặc làm luồng không dùng được; **Trung bình** = gây tranh chấp hoặc giảm tỷ lệ sử dụng; **Thấp** = bất tiện.

## Tổng hợp tác động

| Luồng | Vấn đề lớn nhất | Tác động nếu không sửa | Mức độ |
|---|---|---|---|
| MF-01 | Mọi job đều phải chờ duyệt thủ công | Client dùng gói đăng tin rời bỏ vì chậm; Internal HR quá tải | Trung bình |
| MF-02 | Bước xác nhận 48 giờ qua email; có thể "xí chỗ" ứng viên | Mất phần lớn lượt giới thiệu; Affiliate bỏ nền tảng; tranh chấp hoa hồng | Cao |
| MF-03 | Chưa có bước sàng lọc; chưa tách theo loại dịch vụ | Luồng đứt, không hồ sơ nào đi tiếp được tới phỏng vấn | Cao |
| MF-04 | Client tự xác nhận đi làm, chưa có bước đối soát độc lập | Client né phí bằng cách tuyển ứng viên ngoài hệ thống | Cao |
| MF-05 | Toàn bộ luồng mới ở mức thiết kế; chưa chốt cách xử lý khi Client không trả phí và khi tuyển thay thế | Hệ thống chưa thu được phí và chưa chi được hoa hồng | Cao |

## MF-01. Tạo, duyệt và công bố Job

| # | Vấn đề | Tác động | Đề xuất | Mức độ |
|---|---|---|---|---|
| 1.1 | Mọi job đều phải Internal HR duyệt thủ công, kể cả job đăng tin `CV_APPLICATION` | Client mua gói đăng tin kỳ vọng đăng là lên ngay; phải chờ thì thời hạn gói bị hao. Internal HR thành nút cổ chai khi số Client tăng | Tự động công bố job `CV_APPLICATION` của công ty đã xác minh, kiểm duyệt sau; giữ duyệt trước cho `HEADHUNT_COD` và `CV_SOURCING` | Trung bình |
| 1.2 | Job không có điều khoản thương mại (hệ số phí, Sourcing Target, bảo hành, gói) | Không có căn cứ tính phí về sau; mỗi job phải thỏa thuận ngoài hệ thống | Lưu điều khoản tại job và chốt (không cho sửa) khi job `ACTIVE` | Cao |
| 1.3 | Client đóng job khi đang có ứng viên trong pipeline | Hồ sơ đang phỏng vấn bị treo; công sức của Affiliate mất mà không có lời giải thích | Khi đóng job: bắt buộc chọn cách xử lý hồ sơ đang mở và thông báo cho Affiliate liên quan | Trung bình |
| 1.4 | Chưa có giới hạn gói miễn phí | Client dùng miễn phí không giới hạn, không có lý do nâng gói | Cài giới hạn 1 job mở và chu kỳ 2 tháng theo đề tài | Trung bình |

**Tác động tới luồng khác:** thiếu điều khoản thương mại ở MF-01 (1.2) làm MF-05 không tính được phí.

## MF-02. Tiếp nhận hồ sơ, kiểm tra trùng, ghi nhận nguồn

| # | Vấn đề | Tác động | Đề xuất | Mức độ |
|---|---|---|---|---|
| 2.1 | Ứng viên phải mở email và bấm đồng ý trong 48 giờ | Ứng viên được liên hệ qua điện thoại/Zalo, ít mở email từ hệ thống lạ, email dễ vào spam. Tỷ lệ hết hạn cao; Affiliate mất công và bỏ nền tảng | Thêm kênh gửi link (SMS/Zalo); cho Affiliate tự gửi link cho ứng viên; cân nhắc kéo dài hạn | Cao |
| 2.2 | Lượt giới thiệu đang chờ khóa ứng viên với job đó | Affiliate có thể nộp hàng loạt ứng viên chưa liên hệ để giữ chỗ, chặn Affiliate đang làm việc thật | Giới hạn số lượt đang chờ của mỗi Affiliate; theo dõi tỷ lệ hết hạn và hạ điểm chất lượng | Cao |
| 2.3 | Attribution ghi theo lúc ứng viên đồng ý, không theo lúc nộp | Lệch với đề tài ("người nộp trước"). Khi tranh chấp, Affiliate nộp trước nhưng ứng viên đồng ý sau sẽ khiếu nại | Chốt một quy tắc và ghi rõ trong chính sách Affiliate; lưu cả hai mốc thời gian | Trung bình |
| 2.4 | Nhận diện trùng chỉ bằng email hoặc số điện thoại khớp chính xác | Ứng viên có nhiều email/số điện thoại; Affiliate thứ hai nhập thông tin khác là qua được. Phát sinh hai hồ sơ cho một người và tranh chấp hoa hồng | Thêm cảnh báo trùng mềm (họ tên + ngày sinh, hoặc nội dung CV) để Internal HR xem xét | Cao |
| 2.5 | Chưa có luồng khiếu nại tranh chấp | Mọi tranh chấp xử lý ngoài hệ thống, không có dấu vết | Làm SF-04 trước khi mở cho nhiều Affiliate | Trung bình |
| 2.6 | Ứng viên do Affiliate tạo không có tài khoản | Các bước sau (xem lịch phỏng vấn, phản hồi offer) giả định ứng viên đăng nhập; với nhóm này luồng bị cụt | Mời ứng viên tạo tài khoản ngay ở bước đồng ý, hoặc cho thao tác qua link | Cao |
| 2.7 | Internal HR không nộp được hồ sơ | Ứng viên do chính SHIRE tìm không vào được pipeline | Thêm nhánh Internal HR nộp, nguồn `INTERNAL`, không có hoa hồng | Trung bình |

**Tác động tới luồng khác:** 2.4 và 2.3 quyết định hoa hồng trả cho ai ở MF-05; 2.6 ảnh hưởng toàn bộ MF-04.

## MF-03. AI Matching và sàng lọc

| # | Vấn đề | Tác động | Đề xuất | Mức độ |
|---|---|---|---|---|
| 3.1 | Chưa có lệnh sàng lọc (đạt / không đạt) | Hồ sơ dừng ở `SUBMITTED`, không lên lịch phỏng vấn được. Toàn bộ MF-04 không dùng được trong thực tế | Làm ngay: chuyển `SCREENING` → `SHORTLISTED` / `REJECTED` kèm lý do | Cao |
| 3.2 | Chưa tách người sàng lọc theo loại dịch vụ | `CV_APPLICATION` bán cho Client quyền tự chọn hồ sơ; nếu chỉ Internal HR sàng lọc thì sai bản chất dịch vụ và tốn nhân lực. Ngược lại, `HEADHUNT_COD` mà Client thấy hồ sơ chưa lọc thì mất giá trị dịch vụ | `CV_APPLICATION`: Client sàng lọc. `HEADHUNT_COD`, `CV_SOURCING`: Internal HR lọc trước, Client chỉ thấy hồ sơ đã đạt **(đã đưa vào thiết kế)** | Cao |
| 3.3 | Client thấy thông tin liên hệ của ứng viên trước khi phát sinh phí | Client liên hệ thẳng ứng viên, bỏ qua nền tảng | Che email/số điện thoại với `HEADHUNT_COD` và `CV_SOURCING` cho tới bước phù hợp | Cao |
| 3.4 | "CV đạt chuẩn" của `CV_SOURCING` do bên bán tự quyết | Client không có quyền trả lại CV không đúng yêu cầu; dễ tranh chấp về chất lượng | Cho Client từ chối CV kèm lý do trong vài ngày; CV bị từ chối hợp lệ không tính quota và được thay bằng CV dự phòng | Trung bình |
| 3.5 | Điểm AI có thể được hiểu là quyết định | Người sàng lọc lọc theo điểm mà không đọc CV; ứng viên tốt nhưng CV viết khác mẫu bị loại | Hiển thị bằng chứng cạnh điểm; bắt buộc lý do khi loại hồ sơ điểm cao hoặc chọn hồ sơ điểm thấp | Thấp |

**Tác động tới luồng khác:** 3.1 chặn MF-04; 3.3 liên quan trực tiếp tới việc né phí ở MF-04.

## MF-04. Phỏng vấn, Offer, Nhận việc

| # | Vấn đề | Tác động | Đề xuất | Mức độ |
|---|---|---|---|---|
| 4.1 | Client có quyền xác nhận đi làm và đánh dấu không nhận việc | Phí `HEADHUNT_COD` chỉ phát sinh khi có xác nhận đi làm. Client có động cơ không xác nhận, hoặc đánh dấu không nhận việc rồi tuyển ứng viên bên ngoài. Mất doanh thu và Affiliate mất hoa hồng | Client vẫn là người xác nhận đi làm; thêm bước Internal HR đối soát placement trước khi tính phí và kiểm tra các hồ sơ "không nhận việc"; thêm điều khoản ứng viên đã giới thiệu thuộc quyền nền tảng trong 6–12 tháng; Affiliate được khiếu nại **(bước đối soát đã đưa vào thiết kế)** | Cao |
| 4.2 | Offer phải đi đủ các bước trên hệ thống | Doanh nghiệp thường gửi offer qua email/Zalo kèm bản ký. HR sẽ không soạn offer trên hệ thống, dữ liệu lương (căn cứ tính phí) bị thiếu hoặc nhập sai | Cho phép "ghi nhận kết quả offer" một bước, kèm tệp đính kèm; lương thỏa thuận là trường bắt buộc | Trung bình |
| 4.3 | Không có thông báo và nhắc lịch | Ứng viên và người phỏng vấn không biết lịch; tỷ lệ vắng mặt cao | Gửi email khi tạo, dời, hủy lịch và nhắc trước buổi phỏng vấn | Trung bình |
| 4.4 | Không theo dõi số vị trí đã tuyển so với số lượng cần tuyển | Job đã tuyển đủ vẫn `ACTIVE`, Affiliate tiếp tục nộp vô ích | Tự gợi ý đóng job khi tuyển đủ; hiển thị tiến độ ví dụ 1/2 | Thấp |
| 4.5 | Ứng viên nhận offer ở hai job cùng lúc | Hai Client cùng chờ một người; một placement chắc chắn hỏng | Cảnh báo Internal HR khi một ứng viên có nhiều offer đang mở | Thấp |
| 4.6 | Kết quả phỏng vấn do Client tự nhập | Client có thể ghi "trượt" rồi tuyển bên ngoài (cùng bản chất với 4.1) | Áp dụng cùng điều khoản bảo vệ ở 4.1 | Trung bình |

**Tác động tới luồng khác:** 4.1 và 4.2 quyết định MF-05 có căn cứ tính phí hay không.

## MF-05. Thử việc, Bảo hành, Hoa hồng, Payout

| # | Vấn đề | Tác động | Đề xuất | Mức độ |
|---|---|---|---|---|
| 5.1 | Toàn bộ luồng chưa có nghiệp vụ | Hệ thống chưa tạo ra doanh thu và chưa trả được hoa hồng; đây là mục tiêu chính của đề tài | Làm theo thứ tự: phí `HEADHUNT_COD` → hoa hồng theo mốc → payout → `CV_SOURCING` → gói `CV_APPLICATION` | Cao |
| 5.2 | Trộn "bảo hành" (15/30/60 ngày) với "thử việc" | Thử việc ở Việt Nam thay đổi theo vị trí (30, 60, 180 ngày). Dùng thử việc làm mốc thì hoa hồng mỗi job một kiểu và khó giải thích | Mốc hoa hồng tính theo số ngày làm việc thực tế trong thời hạn bảo hành; thử việc chỉ là thông tin theo dõi **(đã đưa vào thiết kế)** | Cao |
| 5.3 | Không có vai trò và luồng ghi nhận Client đã thanh toán | Hoa hồng bị giữ cho tới khi Client trả tiền, nhưng không ai có chức năng xác nhận việc đó; hoa hồng treo vô thời hạn | Thêm bản ghi công nợ phí dịch vụ (chờ, đến hạn, đã trả, quá hạn) do Platform Admin cập nhật **(đã đưa vào thiết kế)** | Cao |
| 5.4 | Ứng viên nghỉ việc trong bảo hành: không rõ ai báo, ai xác nhận | Client không có động cơ báo sớm nếu không được lợi; Affiliate vẫn nhận mốc hoa hồng không đáng có | Client báo nghỉ để kích hoạt tuyển thay thế; Internal HR xác nhận ngày nghỉ; phần hoa hồng chưa đạt mốc tự hủy **(đã đưa vào thiết kế)** | Trung bình |
| 5.5 | Tuyển thay thế chưa có quy tắc attribution | Không rõ ứng viên thay thế có phát sinh hoa hồng mới hay không | Ứng viên thay thế tạo placement mới không thu thêm phí; hoa hồng theo thỏa thuận riêng, ghi rõ trong Commission Rule | Trung bình |
| 5.6 | Tỷ lệ chia 60% ở `CV_SOURCING` | Sau khi trừ chi phí Internal HR sàng lọc từng CV, phần còn lại rất mỏng | Tính lại bằng số liệu vận hành thật trước khi công bố cho Affiliate | Trung bình |
| 5.7 | Affiliate bị khóa khi còn hoa hồng đang chờ | Không rõ số tiền đó xử lý thế nào; rủi ro khiếu nại | Quy định: hoa hồng đã đạt mốc vẫn chi; phần chưa đạt mốc giữ tới khi có quyết định của Platform Admin | Thấp |

## Thứ tự xử lý đề xuất

1. **Bảo vệ doanh thu (4.1, 3.3, 1.2):** chốt ai xác nhận đi làm, che thông tin liên hệ, lưu điều khoản thương mại tại job.
2. **Nối luồng (3.1, 3.2):** làm bước sàng lọc và tách theo loại dịch vụ.
3. **Giữ Affiliate (2.1, 2.2, 2.4, 2.6):** sửa bước xác nhận của ứng viên, chống xí chỗ, cải thiện nhận diện trùng.
4. **Tạo doanh thu (5.1, 5.2, 5.3):** làm MF-05 bắt đầu từ `HEADHUNT_COD`.
5. Các mục mức Trung bình và Thấp còn lại.
